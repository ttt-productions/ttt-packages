import { describe, it, expect } from 'vitest';
import { deriveAgeBracket } from '../src/utils/age-derivation.js';
import * as utils from '../src/utils/index.js';

describe('deriveAgeBracket', () => {
  it('is exported from the utils entry', () => {
    expect(utils.deriveAgeBracket).toBe(deriveAgeBracket);
  });
});
