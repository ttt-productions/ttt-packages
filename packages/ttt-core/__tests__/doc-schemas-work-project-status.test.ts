import { describe, it, expect } from 'vitest';
import { FullWorkProjectSchema } from '../src/doc-schemas/work-project';

describe('a Work\'s status', () => {
  it('is open until its first Hall publish, then published', () => {
    expect([...FullWorkProjectSchema.shape.status.options]).toEqual(['open', 'published']);
  });
});
