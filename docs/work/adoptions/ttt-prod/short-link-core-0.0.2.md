# Adopt @ttt-productions/short-link-core 0.0.2

**What:** A new shared short-link package: the link document and its id, the create and lookup cores, and the redirect page.
**Severity:** medium

- **Package and version:** `@ttt-productions/short-link-core` 0.0.2 (new).
- **Release:** `./scripts/release-multiple.sh short-link-core ui-core q-core patch`.
- **What changed:** ttt-prod's short-link mechanism is now a package (`docs/packages/short-link-core.md`):
  - `.` — `generateShortLinkId` (a secure random source over the package's own length, alphabet
    and attempt constants), `shortLinkIdSchema`, `createShortLinkSchema({ type, metadata })` for the
    stored link, and `isInAppDestination`. A link stores no full URL (`shortUrl` is gone): the app
    builds the address where it shows it, from its site URL and its short-link route.
  - `./server` — `runShortLinkCreate` (returns the destination's existing link or creates one, in the
    caller's transaction, as its last reads then its write) and `runShortLinkLookup` (counts the click
    and answers the destination for any caller, or `null`).
  - `./react` — `ShortLinkRedirector`, which replaces the page with an in-app destination and renders
    the app's pending, missing, or failed content.
- **What the app must change:** Install. Moving ttt-prod's short links onto the package is its own
  work item, `docs/work/waiting-to-be-implemented/short-links-and-step-up-qr-on-the-packages.md`,
  done when that item is picked up; this file only installs.
- **Done when:** The lockfiles name `@ttt-productions/short-link-core` 0.0.2 or later.
