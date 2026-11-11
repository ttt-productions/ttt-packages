import { describe, expect, it } from 'vitest';
import { buildSiteRobots, buildSiteSitemap } from '../src/crawler-files.js';
import { site } from './fixtures/site.js';

describe('buildSiteRobots', () => {
  it('keeps every crawler out of the disallowed prefixes and points at the sitemap and host', () => {
    expect(buildSiteRobots(site, ['/admin'])).toEqual({
      rules: [{ userAgent: '*', disallow: ['/admin'] }],
      sitemap: 'https://example.test/sitemap.xml',
      host: 'https://example.test',
    });
  });

  it('never sets an Apple web-app capability or a keywords list', () => {
    const robots = buildSiteRobots(site, []);
    expect(robots).not.toHaveProperty('appleWebApp');
    expect(robots).not.toHaveProperty('keywords');
  });
});

describe('buildSiteSitemap', () => {
  const lastModified = new Date(1_700_000_000_000);

  it('lists each route at its address on the canonical site, the home page at the bare site URL', () => {
    expect(
      buildSiteSitemap(
        site,
        [{ path: '/', changeFrequency: 'daily', priority: 1 }, { path: '/terms' }],
        lastModified,
      ),
    ).toEqual([
      { url: 'https://example.test', lastModified, changeFrequency: 'daily', priority: 1 },
      { url: 'https://example.test/terms', lastModified },
    ]);
  });

  it('refuses a route that is not a site path', () => {
    expect(() => buildSiteSitemap(site, [{ path: 'terms' }], lastModified)).toThrow(
      'is not a site path',
    );
  });

  it('never sets an Apple web-app capability or a keywords list', () => {
    const [entry] = buildSiteSitemap(site, [{ path: '/' }], lastModified);
    expect(entry).not.toHaveProperty('appleWebApp');
    expect(entry).not.toHaveProperty('keywords');
  });
});
