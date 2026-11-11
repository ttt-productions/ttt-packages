import { siteOrigin, type SiteDefinition } from './site-definition.js';

export const SITE_MANIFEST_PATH = '/manifest.webmanifest';

const TITLE_SEPARATOR = ' · ';

const RENDERED_PAGE_ADDRESS = './';

interface SiteMetadataImage {
  url: string;
  width: number;
  height: number;
  alt: string;
}

interface SiteMetadataIcon {
  url: string;
  sizes?: string;
}

export interface SiteMetadata {
  metadataBase: URL;
  title: { default: string; template: string };
  description: string;
  authors: Array<{ name: string }>;
  alternates: { canonical: './' };
  openGraph: {
    type: 'website';
    siteName: string;
    title: string;
    description: string;
    url: './';
    locale: string;
    images: SiteMetadataImage[];
  };
  twitter: {
    card: 'summary_large_image';
    title: string;
    description: string;
    images: SiteMetadataImage[];
  };
  icons: { icon: SiteMetadataIcon[]; apple: SiteMetadataIcon[] };
  manifest: string;
}

export function buildSiteMetadata(site: SiteDefinition): SiteMetadata {
  const picture = (): SiteMetadataImage => ({
    url: site.sharePicture.path,
    width: site.sharePicture.width,
    height: site.sharePicture.height,
    alt: site.sharePicture.alt,
  });
  return {
    metadataBase: new URL(siteOrigin(site)),
    title: { default: site.name, template: `%s${TITLE_SEPARATOR}${site.name}` },
    description: site.description,
    authors: [{ name: site.name }],
    alternates: { canonical: RENDERED_PAGE_ADDRESS },
    openGraph: {
      type: 'website',
      siteName: site.name,
      title: site.name,
      description: site.description,
      url: RENDERED_PAGE_ADDRESS,
      locale: site.locale.replace(/-/g, '_'),
      images: [picture()],
    },
    twitter: {
      card: 'summary_large_image',
      title: site.name,
      description: site.description,
      images: [picture()],
    },
    icons: {
      icon: [
        { url: site.icons.favicon },
        { url: site.icons.icon192, sizes: '192x192' },
        { url: site.icons.icon512, sizes: '512x512' },
      ],
      apple: [{ url: site.icons.appleTouchIcon }],
    },
    manifest: SITE_MANIFEST_PATH,
  };
}

export function absolutePageTitle(site: SiteDefinition, page: string): { absolute: string } {
  return { absolute: `${page}${TITLE_SEPARATOR}${site.name}` };
}
