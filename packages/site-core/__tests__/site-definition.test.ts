import { describe, expect, it } from 'vitest';
import { siteUrlFor } from '../src/site-definition.js';
import { site } from './fixtures/site.js';

describe('siteUrlFor', () => {
  it('addresses the home page at the bare site URL and every other path under it', () => {
    expect(siteUrlFor(site, '/')).toBe('https://example.test');
    expect(siteUrlFor(site, '/hall')).toBe('https://example.test/hall');
  });

  it('drops trailing slashes from the canonical site URL', () => {
    expect(siteUrlFor({ ...site, url: 'https://example.test///' }, '/hall')).toBe(
      'https://example.test/hall',
    );
  });

  it('refuses a path that does not start at the site root', () => {
    expect(() => siteUrlFor(site, 'hall')).toThrow('is not a site path');
  });

  it('refuses a canonical site URL that is not a URL', () => {
    expect(() => siteUrlFor({ ...site, url: 'example' }, '/hall')).toThrow();
  });
});
