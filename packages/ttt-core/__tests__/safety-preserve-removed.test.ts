import { describe, it, expect } from 'vitest';
import * as schemas from '../src/schemas';
import * as root from '../src/index';

describe('preserve-as-evidence has no contract', () => {
  it('ships no preserve target or input schema — evidence is held by the case openers', () => {
    for (const name of ['PreserveTargetSchema', 'PreserveAsEvidenceInputSchema']) {
      expect(name in schemas, name).toBe(false);
      expect(name in root, name).toBe(false);
    }
  });
});
