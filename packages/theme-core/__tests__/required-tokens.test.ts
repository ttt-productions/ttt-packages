import { describe, it, expect } from 'vitest';
import { REQUIRED_TOKENS } from '../src/required-tokens';

describe('REQUIRED_TOKENS', () => {
  it('is an array', () => {
    expect(Array.isArray(REQUIRED_TOKENS)).toBe(true);
  });

  it('is non-empty', () => {
    expect(REQUIRED_TOKENS.length).toBeGreaterThan(0);
  });

  it('contains "--brand-primary"', () => {
    expect(REQUIRED_TOKENS).toContain('--brand-primary');
  });

  it('contains "--brand-secondary"', () => {
    expect(REQUIRED_TOKENS).toContain('--brand-secondary');
  });

  it('contains "--brand-accent"', () => {
    expect(REQUIRED_TOKENS).toContain('--brand-accent');
  });

  it('all tokens are CSS custom property names (starting with "--")', () => {
    for (const token of REQUIRED_TOKENS) {
      expect(token.startsWith('--')).toBe(true);
    }
  });

  it('all tokens are non-empty strings', () => {
    for (const token of REQUIRED_TOKENS) {
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
    }
  });

  it('contains no duplicate tokens', () => {
    const unique = new Set(REQUIRED_TOKENS);
    expect(unique.size).toBe(REQUIRED_TOKENS.length);
  });
});
