import { describe, it, expect } from 'vitest';
import { tttKeys } from '../src/ttt-keys';

describe('tttKeys scopes', () => {
  const scopes = [
    'craftSkills', 'thresholdLibrary', 'hallLibrary', 'auditionBoard',
    'commissionListings', 'pledgePayments', 'futurePlans',
    'rulesAndAgreements', 'violations',
  ] as const;

  for (const scope of scopes) {
    it(`tttKeys.${scope}.all starts with ["${scope}"]`, () => {
      expect((tttKeys as any)[scope].all[0]).toBe(scope);
    });

    it(`tttKeys.${scope}.detail("id") includes scope and id`, () => {
      const result = (tttKeys as any)[scope].detail('test-id');
      expect(result[0]).toBe(scope);
      expect(result).toContain('test-id');
    });

    it(`tttKeys.${scope}.list() returns [scope, "list"]`, () => {
      const result = (tttKeys as any)[scope].list();
      expect(result[0]).toBe(scope);
      expect(result[1]).toBe('list');
    });

    it(`tttKeys.${scope}.custom("a", "b") includes scope and parts`, () => {
      const result = (tttKeys as any)[scope].custom('a', 'b');
      expect(result[0]).toBe(scope);
      expect(result).toContain('a');
      expect(result).toContain('b');
    });
  }
});
