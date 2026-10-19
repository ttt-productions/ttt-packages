import { describe, it, expect } from 'vitest';
import { THEME_NAMES, isThemeName } from '../src/themes.js';
import * as root from '../src/index.js';

describe('the package root', () => {
  it('exports the theme-name check beside the theme set', () => {
    expect(root.isThemeName).toBe(isThemeName);
    expect(root.THEME_NAMES).toBe(THEME_NAMES);
  });
});
