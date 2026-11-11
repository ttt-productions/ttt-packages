import type { SiteDefinition } from '../../src/site-definition.js';

export const site: SiteDefinition = {
  name: 'Example Site',
  shortName: 'Example',
  description: 'An example site.',
  url: 'https://example.test/',
  homePath: '/',
  sharePicture: { path: '/images/share.png', width: 1200, height: 630, alt: 'Example picture' },
  icons: {
    favicon: '/favicon.ico',
    appleTouchIcon: '/apple-touch-icon.png',
    icon192: '/icon-192.png',
    icon512: '/icon-512.png',
    maskableIcon512: '/icon-maskable-512.png',
  },
  themeColor: '#123456',
  backgroundColor: '#abcdef',
  locale: 'en-US',
};
