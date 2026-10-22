import { describe, expect, it } from 'vitest';
import { createPostcssConfig } from '../src/node/postcss.js';

describe('createPostcssConfig', () => {
  it('runs Tailwind CSS through its PostCSS plugin with no options', () => {
    expect(createPostcssConfig()).toEqual({ plugins: { '@tailwindcss/postcss': {} } });
  });

  it('gives each caller its own config object', () => {
    expect(createPostcssConfig()).not.toBe(createPostcssConfig());
  });
});
