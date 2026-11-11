# Adopt @ttt-productions/site-core 0.0.2

**What:** A new shared package that builds a site's page metadata, viewport, manifest, robots rules and sitemap from one site definition, and never lets the site open without the browser bar.
**Severity:** medium

- **Package and version:** `@ttt-productions/site-core` 0.0.2 (new).
- **Release:** `./scripts/release-multiple.sh theme-core ui-core mobile-core firebase-helpers query-core q-core site-core dev-standards repo-guards patch`, after the package's manual first publish of 0.0.1.
- **What changed:** site-level page metadata is now a package (`docs/packages/site-core.md`). The app
  hands in one `SiteDefinition` (name, short name, description, canonical site URL, home path, a
  1200×630 share picture with its alt, the favicon, Apple touch, 192, 512 and maskable 512 icon
  paths, theme and background colours, locale), and the builders return what Next's metadata files
  return: `buildSiteMetadata`, `buildSiteViewport`, `buildSiteManifest` (always
  `display: 'browser'`), `buildSiteRobots`, `buildSiteSitemap`, plus `absolutePageTitle` for a page
  the layout's title template does not reach and `siteUrlFor` for an absolute site address.
- **What the app must change:**
  - Install the package.
  - Declare the site definition once, with the app's own values.
  - `src/app/layout.tsx`: `export const metadata = buildSiteMetadata(site)` and
    `export const viewport = buildSiteViewport()`, replacing the hand-written title, description,
    keywords, authors, canonical, social-sharing tags, icons and manifest link. No keywords list and
    no Apple web-app capability remain. The canonical and the Open Graph address become each page's
    own address rather than the home page's; a page that set its own canonical to its own address
    can drop it.
  - Add `src/app/manifest.ts` returning `buildSiteManifest(site)`, and delete
    `public/site.webmanifest`: the manifest is generated and opens the site in the browser, with its
    bar.
  - Add any icon or share picture the definition requires that `public/` does not hold yet: the 192,
    512 and maskable 512 app icons, the Apple touch icon, and a 1200×630 share picture.
  - `src/app/robots.ts` and `src/app/sitemap.ts`: return `buildSiteRobots(site, …)` and
    `buildSiteSitemap(site, …)` with the app's own lists from `src/lib/public-routes.ts`.
  - Page titles: each page states only its own short title, so the tab reads "<page> · <site>"; a
    page in the root layout's own segment (`not-found.tsx`) uses `absolutePageTitle(site, …)`.
- **Done when:** The lockfiles name `@ttt-productions/site-core` 0.0.2 or later, and ttt-prod's
  `layout.tsx`, `manifest.ts`, `robots.ts` and `sitemap.ts` return the builders' results with no
  `public/site.webmanifest` left.
