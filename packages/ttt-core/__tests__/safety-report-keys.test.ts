import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { REPORT_CANONICAL_KEY_VERSION } from '../src/doc-schemas/safety/report.js';
import { COLLECTIONS, NESTED_SUBCOLLECTIONS } from '../src/paths/collections.js';
import { canonicalTargetKey, reportGroupKey, reportId } from '../src/safety/report-keys.js';

const sha = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');
const lp = (s: string) => `${Buffer.byteLength(s, 'utf8')}:${s}`;

const baseTarget = {
  itemType: 'square-streetz-post' as const,
  canonicalParentPath: `${COLLECTIONS.SQUARE_STREETZ_FEED}/${NESTED_SUBCOLLECTIONS.ACTIVE_POSTS}/${NESTED_SUBCOLLECTIONS.SOCIAL_POSTS}`,
  canonicalItemId: 'post-1',
  revision: 1700000000000,
};

describe('canonicalTargetKey', () => {
  it('hashes the length-prefixed version, item type, parent path, item id, and revision', () => {
    const expected = sha(
      [
        REPORT_CANONICAL_KEY_VERSION,
        baseTarget.itemType,
        baseTarget.canonicalParentPath,
        baseTarget.canonicalItemId,
        String(baseTarget.revision),
      ]
        .map(lp)
        .join(''),
    );
    expect(canonicalTargetKey(baseTarget)).toBe(expected);
  });

  it('length-prefixes by UTF-8 bytes, so a multi-byte id hashes its byte count', () => {
    const target = { ...baseTarget, canonicalItemId: 'é-post' };
    const expected = sha(
      lp(REPORT_CANONICAL_KEY_VERSION) +
        lp(target.itemType) +
        lp(target.canonicalParentPath) +
        '7:é-post' +
        lp(String(target.revision)),
    );
    expect(canonicalTargetKey(target)).toBe(expected);
  });

  it('keys two targets apart when their parts join to the same text', () => {
    const a = canonicalTargetKey({
      itemType: 'guild-chat-message',
      canonicalParentPath: 'synthetic:chat:a',
      canonicalItemId: 'b:c',
      revision: 0,
    });
    const b = canonicalTargetKey({
      itemType: 'guild-chat-message',
      canonicalParentPath: 'synthetic:chat:a:b',
      canonicalItemId: 'c',
      revision: 0,
    });
    expect(a).not.toBe(b);
  });

  it('is a 64-character hex digest that changes with every part', () => {
    const key = canonicalTargetKey(baseTarget);
    expect(key).toMatch(/^[0-9a-f]{64}$/);
    for (const changed of [
      { ...baseTarget, revision: baseTarget.revision + 1 },
      { ...baseTarget, itemType: 'audition' as const },
      { ...baseTarget, canonicalItemId: 'post-2' },
      { ...baseTarget, canonicalParentPath: 'other/path' },
    ])
      expect(canonicalTargetKey(changed)).not.toBe(key);
  });
});

describe('reportId', () => {
  it('hashes the length-prefixed version, reporter, and target key', () => {
    const ctk = canonicalTargetKey(baseTarget);
    const expected = sha([REPORT_CANONICAL_KEY_VERSION, 'reporter-1', ctk].map(lp).join(''));
    expect(reportId({ reporterUid: 'reporter-1', canonicalTargetKey: ctk })).toBe(expected);
  });

  it('gives one id per reporter and target revision', () => {
    const ctk = canonicalTargetKey(baseTarget);
    const nextRevision = canonicalTargetKey({ ...baseTarget, revision: baseTarget.revision + 1 });
    const id = reportId({ reporterUid: 'reporter-1', canonicalTargetKey: ctk });
    expect(reportId({ reporterUid: 'reporter-1', canonicalTargetKey: ctk })).toBe(id);
    expect(reportId({ reporterUid: 'reporter-2', canonicalTargetKey: ctk })).not.toBe(id);
    expect(reportId({ reporterUid: 'reporter-1', canonicalTargetKey: nextRevision })).not.toBe(id);
  });
});

describe('reportGroupKey', () => {
  it('groups every reporter of one target revision under its target key', () => {
    const ctk = canonicalTargetKey(baseTarget);
    expect(reportGroupKey(ctk)).toBe(ctk);
  });
});
