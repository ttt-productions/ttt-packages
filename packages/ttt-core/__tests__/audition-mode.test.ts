import { describe, expect, it } from 'vitest';
import { AuditionModeSchema, AuditionSchema } from '../src/doc-schemas/commissions.js';

describe('audition mode', () => {
  it('is open or curated, nothing else', () => {
    expect(AuditionModeSchema.options).toEqual(['open', 'curated']);
    expect(AuditionModeSchema.safeParse('closed').success).toBe(false);
  });

  it('is the declaration the stored audition reads', () => {
    expect(AuditionSchema.shape.mode.unwrap()).toBe(AuditionModeSchema);
  });
});
