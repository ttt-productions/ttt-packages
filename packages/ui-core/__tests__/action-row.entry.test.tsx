import { describe, it, expect } from 'vitest';
import { ActionRow } from '../src/react/components/action-row';
import * as reactEntry from '../src/react/index';

describe('ActionRow', () => {
  it('is exported from the react entry', () => {
    expect(reactEntry.ActionRow).toBe(ActionRow);
  });
});
