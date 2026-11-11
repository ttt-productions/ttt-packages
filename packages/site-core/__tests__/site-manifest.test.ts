import { describe, expect, it } from 'vitest';
import { buildSiteManifest } from '../src/site-manifest.js';
import { site } from './fixtures/site.js';

describe('buildSiteManifest', () => {
  const manifest = buildSiteManifest(site);

  it('names the site, starts at its home page and carries its colours and language', () => {
    expect(manifest).toMatchObject({
      name: 'Example Site',
      short_name: 'Example',
      description: 'An example site.',
      start_url: '/',
      background_color: '#abcdef',
      theme_color: '#123456',
      lang: 'en-US',
    });
  });

  it('lists the 192 and 512 app icons and the maskable 512 icon', () => {
    expect(manifest.icons).toEqual([
      { src: '/icon-192.png', sizes: '192x192', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', purpose: 'any' },
      { src: '/icon-maskable-512.png', sizes: '512x512', purpose: 'maskable' },
    ]);
  });

  it('always opens the site in the browser, with its bar', () => {
    expect(manifest.display).toBe('browser');
    expect(manifest).not.toHaveProperty('display_override');
  });

  it('never sets an Apple web-app capability or a keywords list', () => {
    expect(manifest).not.toHaveProperty('appleWebApp');
    expect(manifest).not.toHaveProperty('keywords');
  });
});
