import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { REPO_ROOT } from './leak-utils';

// ENG-002 — the neutral content type ("the picker could not tell what this file is")
// has ONE declaration: media-schemas' NEUTRAL_CONTENT_TYPE. The picker (file-input),
// the transfer gate (upload-core), the accept-time verdict (media-schemas), and the
// object stores (media-processing-core) all import it. A re-typed string literal is a
// second copy that can drift from the gates that must agree on it.

const DECLARATION = 'packages/media-schemas/src/helpers.ts';
const LITERAL = /(["'])application\/octet-stream\1/;
const LITERALS = new RegExp(LITERAL.source, 'g');

// The same bytes declared for a different concept, in a package that cannot import
// media-schemas. Each entry is that concept's one declaration, with why it is not a copy;
// the file may hold exactly that one literal, so a second one there is still caught.
const OTHER_CONCEPTS: Readonly<Record<string, string>> = {
  'packages/chat-schemas/src/internal-contract.ts':
    "CHAT_PARKED_DELIVERY_REPORT_CONTENT_TYPE — a signed chat report's wire body type (raw bytes the receiver must not parse before verifying), not a file's type; chat-schemas is a pure schema package that depends on no other schema package",
};

function listSource(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return listSource(path);
    return /\.(ts|tsx)$/.test(entry) && !entry.endsWith('.d.ts') ? [path] : [];
  });
}

const packagesDir = join(REPO_ROOT, 'packages');
const sourceFiles = readdirSync(packagesDir).flatMap((pkg) => listSource(join(packagesDir, pkg, 'src')));
const rel = (file: string) => relative(REPO_ROOT, file).split(sep).join('/');
const countLiterals = (file: string) => (readFileSync(join(REPO_ROOT, file), 'utf8').match(LITERALS) ?? []).length;

describe('boundary: one neutral content type', () => {
  it('declares it exactly once, in media-schemas', () => {
    expect(LITERAL.test(readFileSync(join(REPO_ROOT, DECLARATION), 'utf8'))).toBe(true);
  });

  it('re-types the literal nowhere else in package source', () => {
    const copies = sourceFiles
      .map(rel)
      .filter((file) => file !== DECLARATION)
      .filter((file) => countLiterals(file) > (file in OTHER_CONCEPTS ? 1 : 0));
    expect(copies, `import NEUTRAL_CONTENT_TYPE from @ttt-productions/media-schemas instead:\n  ${copies.join('\n  ')}`).toEqual([]);
  });

  it('keeps no stale entry for another concept: each still declares the value it is listed for, exactly once', () => {
    const stale = Object.keys(OTHER_CONCEPTS).filter((file) => !existsSync(join(REPO_ROOT, file)) || countLiterals(file) !== 1);
    expect(stale).toEqual([]);
  });
});
