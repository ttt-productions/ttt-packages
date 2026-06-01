import { describe, it, expect } from 'vitest';
import { RELATED_ID_PREFIXES, buildRelatedId } from '../src/paths/related-ids';

describe('related-ids', () => {
  it('builds prefixed ids for each entity', () => {
    expect(buildRelatedId('user', 'u1')).toBe('user_u1');
    expect(buildRelatedId('workProject', 'wp1')).toBe('workProject_wp1');
    expect(buildRelatedId('workRealm', 'wr1')).toBe('workRealm_wr1');
  });

  it('exposes the canonical prefixes', () => {
    expect(RELATED_ID_PREFIXES.user).toBe('user_');
    expect(RELATED_ID_PREFIXES.workProject).toBe('workProject_');
    expect(RELATED_ID_PREFIXES.workRealm).toBe('workRealm_');
  });
});
