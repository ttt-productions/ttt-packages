import { describe, it, expect } from 'vitest';
import { ShowMoreToggle } from '../src/react/components/show-more-toggle';
import * as reactEntry from '../src/react/index';

describe('ShowMoreToggle — the one show-more disclosure control', () => {
  it('is exported from the react entry', () => {
    expect(reactEntry.ShowMoreToggle).toBe(ShowMoreToggle);
  });
});
