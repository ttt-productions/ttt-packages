import { siteOrigin, siteUrlFor, type SiteDefinition } from './site-definition.js';

export type SitemapChangeFrequency =
  'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';

export interface SitemapRoute {
  path: string;
  changeFrequency?: SitemapChangeFrequency;
  priority?: number;
}

export interface SitemapEntry {
  url: string;
  lastModified: Date;
  changeFrequency?: SitemapChangeFrequency;
  priority?: number;
}

export interface SiteRobots {
  rules: Array<{ userAgent: string; disallow: string[] }>;
  sitemap: string;
  host: string;
}

export function buildSiteRobots(
  site: SiteDefinition,
  disallowedPrefixes: readonly string[],
): SiteRobots {
  const origin = siteOrigin(site);
  return {
    rules: [{ userAgent: '*', disallow: [...disallowedPrefixes] }],
    sitemap: `${origin}/sitemap.xml`,
    host: origin,
  };
}

export function buildSiteSitemap(
  site: SiteDefinition,
  routes: readonly SitemapRoute[],
  lastModified: Date = new Date(),
): SitemapEntry[] {
  return routes.map(({ path, changeFrequency, priority }) => ({
    url: siteUrlFor(site, path),
    lastModified,
    ...(changeFrequency === undefined ? {} : { changeFrequency }),
    ...(priority === undefined ? {} : { priority }),
  }));
}
