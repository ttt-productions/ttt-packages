import { describe, expect, it } from 'vitest';
import { buildSiteViewport } from '../src/site-viewport.js';

describe('buildSiteViewport', () => {
  it('fits the device width at scale 1 and covers the screen', () => {
    expect(buildSiteViewport()).toEqual({
      width: 'device-width',
      initialScale: 1,
      viewportFit: 'cover',
    });
  });

  it('never caps zoom', () => {
    const viewport = buildSiteViewport();
    expect(viewport).not.toHaveProperty('maximumScale');
    expect(viewport).not.toHaveProperty('userScalable');
  });
});
