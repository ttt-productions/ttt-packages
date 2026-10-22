import { describe, it, expect } from 'vitest';
import { REQUIRED_TOKENS } from '../src/required-tokens.js';

describe('REQUIRED_TOKENS brand contract', () => {
  it('includes --brand-primary', () => {
    expect(REQUIRED_TOKENS).toContain('--brand-primary');
  });

  it('includes --brand-secondary', () => {
    expect(REQUIRED_TOKENS).toContain('--brand-secondary');
  });

  it('includes --brand-accent', () => {
    expect(REQUIRED_TOKENS).toContain('--brand-accent');
  });
});
