import { describe, expect, it } from 'vitest';
import { AuditionModeSchema, AuditionSchema } from '../src/doc-schemas/commissions.js';

// An audition takes entries one of two ways, declared once; every schema that carries the mode
// reads that one declaration.
describe('audition mode', () => {
  it('is open or curated, nothing else', () => {
    expect(AuditionModeSchema.options).toEqual(['open', 'curated']);
    expect(AuditionModeSchema.safeParse('closed').success).toBe(false);
  });

  it('is the declaration the stored audition reads', () => {
    expect(AuditionSchema.shape.mode.unwrap()).toBe(AuditionModeSchema);
  });
});
