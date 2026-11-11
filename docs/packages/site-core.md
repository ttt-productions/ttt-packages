# @ttt-productions/site-core

A site's page metadata, built from one site definition: what an app's Next.js `layout.tsx`,
`manifest.ts`, `robots.ts` and `sitemap.ts` return.

## Owns

- **`SiteDefinition`** — the one description of a site the app hands in: name, short name,
  description, canonical site URL, home path, the share picture (path, 1200×630 by type, alt), the
  icon paths (favicon, Apple touch icon, 192, 512, maskable 512), theme and background colours, and
  locale (a BCP 47 tag such as `en-US`). Every value is required by the type. The two colours are
  plain colour strings, because a manifest and the `theme-color` tag cannot resolve a CSS token; an
  app declares its site definition's module to repo-guards' colour guard (`siteDefinitionModule`),
  which allows those two values there and nowhere else.
- **The builders**, each a plain function returning a plain object structurally assignable to the
  Next.js type its file returns:
  - `buildSiteMetadata(site)` → `Metadata`: the title as a default plus a template, so a page's own
    title reads "<page> · <site>"; description; `metadataBase`; the canonical and the Open Graph
    address; Open Graph and a large-image Twitter card with the one picture; icons; authors written
    from the site name; and the link to the generated manifest (`SITE_MANIFEST_PATH`, where Next
    serves `manifest.ts`).
  - The canonical and the Open Graph address are `'./'`: Next resolves that form against the path
    of the page being rendered, on `metadataBase`, for metadata a page inherits from the root layout
    too. So every page names its own absolute address as canonical, never the home page. A page that
    sets its own `openGraph` replaces the layout's whole object, address included, and states its own.
  - `absolutePageTitle(site, page)` → a title for a page the layout's template does not reach (a
    page in the root layout's own segment, such as `not-found.tsx`), in the same "<page> · <site>"
    form.
  - `buildSiteViewport()` → `Viewport`: device width, initial scale 1, `viewportFit: 'cover'`.
  - `buildSiteManifest(site)` → `MetadataRoute.Manifest`, always `display: 'browser'`.
  - `buildSiteRobots(site, disallowedPrefixes)` → `MetadataRoute.Robots`: one rule for every
    crawler, the app's disallowed prefixes, and the sitemap and host on the canonical site URL.
  - `buildSiteSitemap(site, routes, lastModified?)` → `MetadataRoute.Sitemap`: each route's address
    on the canonical site URL, with its optional change frequency and priority.
  - `siteUrlFor(site, path)` — the one way a site path becomes an absolute address: the home path is
    the bare site URL, any other path is appended to it, and a path not starting with `/` throws.

## Guarantees

- The site always opens in the browser, with its bar: the manifest's `display` is `browser` and the
  builder takes no other, and no builder emits an Apple web-app capability (`appleWebApp`).
- Zoom is never capped: the viewport sets no `maximumScale` and no `userScalable`.
- No builder writes a keywords list.

## Boundary

- No dependencies and no import of `next` or any other framework; the root is server-safe. The
  return types are the package's own, shaped so Next's types accept them.
- It holds no site's name, route, copy, colour or picture: every value comes from the app's site
  definition and lists. Which paths crawlers skip and which routes the sitemap lists are the app's.
- A page's own metadata (its title, a per-page share picture) stays in that page.
