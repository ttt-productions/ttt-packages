export interface SiteViewport {
  width: 'device-width';
  initialScale: 1;
  viewportFit: 'cover';
}

export function buildSiteViewport(): SiteViewport {
  return { width: 'device-width', initialScale: 1, viewportFit: 'cover' };
}
