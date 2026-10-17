import { describe, expect, it } from 'vitest';
import { packageSource, packagesTree } from './workspace';

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

const sourceFiles = packageSource(['code']);
const countLiterals = (file: string) => (packagesTree.file(file).code.match(LITERALS) ?? []).length;

describe('boundary: one neutral content type', () => {
  it('declares it exactly once, in media-schemas', () => {
    expect(LITERAL.test(packagesTree.file(DECLARATION).code)).toBe(true);
  });

  it('re-types the literal nowhere else in package source', () => {
    const copies = sourceFiles
      .map((file) => file.path)
      .filter((file) => file !== DECLARATION)
      .filter((file) => countLiterals(file) > (file in OTHER_CONCEPTS ? 1 : 0));
    expect(copies, `import NEUTRAL_CONTENT_TYPE from @ttt-productions/media-schemas instead:\n  ${copies.join('\n  ')}`).toEqual([]);
  });

  it('keeps no stale entry for another concept: each still declares the value it is listed for, exactly once', () => {
    const stale = Object.keys(OTHER_CONCEPTS).filter((file) => !packagesTree.exists(file) || countLiterals(file) !== 1);
    expect(stale).toEqual([]);
  });
});
