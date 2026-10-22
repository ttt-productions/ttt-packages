import { describe, it, expect } from 'vitest';
import { THEME_NAMES, isThemeName } from '../src/themes.js';

describe('THEME_NAMES', () => {
  it('declares the light, dark, and high-contrast themes', () => {
    expect([...THEME_NAMES].sort()).toEqual(['dark', 'high-contrast', 'light']);
  });

  it('recognises each declared theme', () => {
    for (const theme of THEME_NAMES) expect(isThemeName(theme)).toBe(true);
  });

  it('rejects anything outside the set, including next-themes\' "system"', () => {
    for (const value of ['system', 'Dark', '', null, undefined, 1]) {
      expect(isThemeName(value)).toBe(false);
    }
  });
});
