import { describe, expect, it } from 'vitest';
import { absolutePageTitle, buildSiteMetadata } from '../src/site-metadata.js';
import { site } from './fixtures/site.js';

describe('buildSiteMetadata', () => {
  const metadata = buildSiteMetadata(site);
  const picture = { url: '/images/share.png', width: 1200, height: 630, alt: 'Example picture' };

  it('titles the site by its name and every page "<page> · <site>"', () => {
    expect(metadata.title).toEqual({ default: 'Example Site', template: '%s · Example Site' });
  });

  it('resolves relative addresses against the canonical site URL', () => {
    expect(metadata.metadataBase.href).toBe('https://example.test/');
  });

  it('names each rendered page its own canonical and shared address, never the home page', () => {
    expect(metadata.alternates).toEqual({ canonical: './' });
    expect(metadata.openGraph.url).toBe('./');
  });

  it('writes the description and the authors from the site definition', () => {
    expect(metadata.description).toBe('An example site.');
    expect(metadata.authors).toEqual([{ name: 'Example Site' }]);
  });

  it('shares the one picture through Open Graph and a large-image Twitter card', () => {
    expect(metadata.openGraph).toEqual({
      type: 'website',
      siteName: 'Example Site',
      title: 'Example Site',
      description: 'An example site.',
      url: './',
      locale: 'en_US',
      images: [picture],
    });
    expect(metadata.twitter).toEqual({
      card: 'summary_large_image',
      title: 'Example Site',
      description: 'An example site.',
      images: [picture],
    });
  });

  it('links the favicon, the app icons, the Apple touch icon and the generated manifest', () => {
    expect(metadata.icons).toEqual({
      icon: [
        { url: '/favicon.ico' },
        { url: '/icon-192.png', sizes: '192x192' },
        { url: '/icon-512.png', sizes: '512x512' },
      ],
      apple: [{ url: '/apple-touch-icon.png' }],
    });
    expect(metadata.manifest).toBe('/manifest.webmanifest');
  });

  it('never sets an Apple web-app capability or a keywords list', () => {
    expect(metadata).not.toHaveProperty('appleWebApp');
    expect(metadata).not.toHaveProperty('keywords');
  });
});

describe('absolutePageTitle', () => {
  it('reads "<page> · <site>" where the layout template does not reach', () => {
    expect(absolutePageTitle(site, 'Page not found')).toEqual({
      absolute: 'Page not found · Example Site',
    });
  });
});
