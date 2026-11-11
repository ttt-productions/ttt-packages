import type { SiteDefinition } from './site-definition.js';

interface SiteManifestIcon {
  src: string;
  sizes: string;
  purpose: 'any' | 'maskable';
}

export interface SiteManifest {
  name: string;
  short_name: string;
  description: string;
  start_url: string;
  display: 'browser';
  background_color: string;
  theme_color: string;
  lang: string;
  icons: SiteManifestIcon[];
}

export function buildSiteManifest(site: SiteDefinition): SiteManifest {
  return {
    name: site.name,
    short_name: site.shortName,
    description: site.description,
    start_url: site.homePath,
    display: 'browser',
    background_color: site.backgroundColor,
    theme_color: site.themeColor,
    lang: site.locale,
    icons: [
      { src: site.icons.icon192, sizes: '192x192', purpose: 'any' },
      { src: site.icons.icon512, sizes: '512x512', purpose: 'any' },
      { src: site.icons.maskableIcon512, sizes: '512x512', purpose: 'maskable' },
    ],
  };
}
