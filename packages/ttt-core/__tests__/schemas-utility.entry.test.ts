import { describe, it, expect } from 'vitest';
import { SeedDmcaPolicyInputSchema } from '../src/schemas/utility';
import * as schemasBarrel from '../src/schemas';

describe('public-document seed inputs (one per public document, intentionally empty)', () => {
  it('SeedDmcaPolicyInputSchema ships on the schemas entry the callables import from', () => {
    expect(schemasBarrel.SeedDmcaPolicyInputSchema).toBe(SeedDmcaPolicyInputSchema);
  });
});
