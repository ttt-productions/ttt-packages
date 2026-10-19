import { describe, it, expect } from 'vitest';
import * as schemasBarrel from '../src/schemas/index.js';

describe('short links are never deleted', () => {
  it('ships no delete input', () => {
    expect('DeleteShortLinkInputSchema' in schemasBarrel).toBe(false);
  });
});
