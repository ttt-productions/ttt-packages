export interface SiteSharePicture {
  path: string;
  width: 1200;
  height: 630;
  alt: string;
}

export interface SiteIcons {
  favicon: string;
  appleTouchIcon: string;
  icon192: string;
  icon512: string;
  maskableIcon512: string;
}

export interface SiteDefinition {
  name: string;
  shortName: string;
  description: string;
  url: string;
  homePath: string;
  sharePicture: SiteSharePicture;
  icons: SiteIcons;
  themeColor: string;
  backgroundColor: string;
  locale: string;
}

export function siteOrigin(site: SiteDefinition): string {
  return new URL(site.url).href.replace(/\/+$/, '');
}

export function siteUrlFor(site: SiteDefinition, path: string): string {
  if (!path.startsWith('/')) throw new Error(`siteUrlFor: "${path}" is not a site path`);
  const origin = siteOrigin(site);
  return path === site.homePath ? origin : `${origin}${path}`;
}
