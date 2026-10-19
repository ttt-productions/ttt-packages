import { describe, it, expect } from 'vitest';
import { ShowMoreToggle } from '../src/react/components/show-more-toggle.js';
import * as reactEntry from '../src/react/index.js';

describe('ShowMoreToggle — the one show-more disclosure control', () => {
  it('is exported from the react entry', () => {
    expect(reactEntry.ShowMoreToggle).toBe(ShowMoreToggle);
  });
});
