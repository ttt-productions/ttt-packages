import { describe, expect, it } from 'vitest';
import { packageSource, packagesTree } from './workspace';
import { SLOW_TEST_TIMEOUT_MS } from '../timeouts';

const DECLARATION = 'packages/media-schemas/src/helpers.ts';
const LITERAL = /(["'])application\/octet-stream\1/;
const LITERALS = new RegExp(LITERAL.source, 'g');

const OTHER_CONCEPTS: Readonly<Record<string, string>> = {
  'packages/chat-schemas/src/internal-contract.ts':
    "CHAT_PARKED_DELIVERY_REPORT_CONTENT_TYPE — a signed chat report's wire body type (raw bytes the receiver must not parse before verifying), not a file's type; chat-schemas is a pure schema package that depends on no other schema package",
};

const sourceFiles = packageSource(['code']);
const countLiterals = (file: string) => {
  const view = packagesTree.file(file);
  if (!view.text.includes('application/octet-stream')) return 0;
  return (view.code.match(LITERALS) ?? []).length;
};

describe('boundary: one neutral content type', () => {
  it('declares it exactly once, in media-schemas', () => {
    expect(LITERAL.test(packagesTree.file(DECLARATION).code)).toBe(true);
  });

  it(
    're-types the literal nowhere else in package source',
    () => {
      const copies = sourceFiles
        .map((file) => file.path)
        .filter((file) => file !== DECLARATION)
        .filter((file) => countLiterals(file) > (file in OTHER_CONCEPTS ? 1 : 0));
      expect(
        copies,
        `import NEUTRAL_CONTENT_TYPE from @ttt-productions/media-schemas instead:\n  ${copies.join('\n  ')}`,
      ).toEqual([]);
    },
    SLOW_TEST_TIMEOUT_MS,
  );

  it('keeps no stale entry for another concept: each still declares the value it is listed for, exactly once', () => {
    const stale = Object.keys(OTHER_CONCEPTS).filter(
      (file) => !packagesTree.exists(file) || countLiterals(file) !== 1,
    );
    expect(stale).toEqual([]);
  });
});
