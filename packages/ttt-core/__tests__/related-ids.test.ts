import { describe, it, expect } from 'vitest';
import { RELATED_ID_PREFIXES, buildRelatedId } from '../src/paths/related-ids';
import { MentionTypeSchema } from '../src/media/atoms';

describe('related-ids', () => {
  it('builds prefixed ids for each entity', () => {
    expect(buildRelatedId('user', 'u1')).toBe('user_u1');
    expect(buildRelatedId('workProject', 'wp1')).toBe('workProject_wp1');
    expect(buildRelatedId('workRealm', 'wr1')).toBe('workRealm_wr1');
    expect(buildRelatedId('commission', 'c1')).toBe('commission_c1');
    expect(buildRelatedId('audition', 'a1')).toBe('audition_a1');
  });

  it('exposes the canonical prefixes', () => {
    expect(RELATED_ID_PREFIXES.user).toBe('user_');
    expect(RELATED_ID_PREFIXES.workProject).toBe('workProject_');
    expect(RELATED_ID_PREFIXES.workRealm).toBe('workRealm_');
    expect(RELATED_ID_PREFIXES.commission).toBe('commission_');
    expect(RELATED_ID_PREFIXES.audition).toBe('audition_');
  });

  it('every kind a post can mention has a related-id prefix', () => {
    expect(Object.keys(RELATED_ID_PREFIXES).sort()).toEqual([...MentionTypeSchema.options].sort());
  });

  it('no prefix is the start of another, so ids of different kinds never collide', () => {
    const prefixes = Object.values(RELATED_ID_PREFIXES);
    for (const a of prefixes) {
      for (const b of prefixes) {
        if (a !== b) expect(b.startsWith(a)).toBe(false);
      }
    }
  });
});
