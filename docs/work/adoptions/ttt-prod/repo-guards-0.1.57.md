# Adopt @ttt-productions/repo-guards 0.1.57

**What:** Two new generic guards, `readsOnlyWhenShown` (no read ahead of the person, no `forceMount`) and `browserBarAlwaysShown` (the site never opens without the browser bar), and `sharedTruncation` now fails a clip class placed by hand instead of `ClippedText`.
**Severity:** medium

- **Package and version:** `@ttt-productions/repo-guards` 0.1.57.
- **Release:** `./scripts/release-multiple.sh theme-core ui-core mobile-core firebase-helpers query-core q-core site-core dev-standards repo-guards patch`.
- **What changed:**
  - `generic.readsOnlyWhenShown` (it cannot be declared absent) enforces RULE-STD-FRONTEND-113 in
    two checks over the app's production source. "nothing reads ahead of the person outside a
    reviewed entry" fails every `prefetchQuery`, `prefetchInfiniteQuery`, `ensureQueryData`,
    `ensureInfiniteQueryData`, `usePrefetchQuery` and `usePrefetchInfiniteQuery` call that is not a
    reviewed entry; `fetchQuery` is never flagged. "content that is not shown is never kept mounted"
    fails every `forceMount`, as a JSX prop or in a props object, with no exception list. Facts:
    `readsAhead`, a list of `{ path, call, why }` — the file, the call written
    whitespace-collapsed from its name to its closing parenthesis (as the finding prints it), and
    a non-empty why. An entry with no why fails the config; an entry that matches nothing fails as
    stale.
  - `generic.browserBarAlwaysShown` (it cannot be declared absent) fails when the site can open
    without the browser bar: a metadata object that sets `appleWebApp` (`true`, an object with
    `capable: true`, or an object with no `capable: false`, which Next turns on), the
    `apple-mobile-web-app-capable` or `mobile-web-app-capable` meta named anywhere in the app's
    source, a manifest route file (`manifest.ts` and its kin) that writes a `display` other than
    `'browser'` or any `display_override`, or a web manifest under the public folder — one the app
    links (a metadata `manifest` or a `<link rel="manifest">`) or one named `manifest.json`,
    `manifest.webmanifest` or `site.webmanifest` — whose `display` is not `browser` or that sets a
    `display_override`, or a static `manifest.json` / `manifest.webmanifest` in the app router's
    folder (`app/` under the layout's app root) with the same problem; no new fact finds it. A
    manifest route that returns site-core's manifest builder and writes no
    display of its own passes. Facts: `publicDir`, the repo-relative public folder (`public`).
  - `generic.sharedTruncation` now follows RULE-STD-FRONTEND-007 as it requires ui-core's
    `ClippedText`. Its title is "text is clipped only through the clip component, never by a class
    placed by hand". Besides the bans it already had (per-call-site `truncate` / `line-clamp-*` /
    `text-ellipsis`, inline ellipsis styles, stylesheet clamps outside the declared clamp owners),
    it fails every clip class written in code under its trees, with or without a variant prefix:
    those classes reach the page only through `ClippedText`. Its `sharedClass` fact is replaced by
    `clipClasses`, the list of clip classes `ClippedText` places, and the check that the clamp
    owners hold the shared class's selector is gone; `clampOwners`, `trees`, `entryStylesheet` and
    `exceptions` are unchanged.
- **What the app must change:**
  - Declare `readsOnlyWhenShown` in ttt-prod's guard config with its `readsAhead` entries. Run the
    guard: each prefetch it finds is either removed (the content reads when it is shown) or, on
    DJ's yes, becomes a reviewed entry with its reason. Every `forceMount` it finds is removed.
  - Declare `browserBarAlwaysShown` with `publicDir: 'public'`. The guard fails in ttt-prod while
    any manifest sets a display other than `browser`. It is green once none does: with site-core
    0.0.2, `public/site.webmanifest` is gone and `src/app/manifest.ts` returns
    `buildSiteManifest(…)`. Until then the red is the expected state, not a reason to weaken the
    facts.
  - In `sharedTruncation`'s facts, replace `sharedClass: 'single-line-truncate'` with
    `clipClasses: ['single-line-truncate', 'two-line-clamp', 'three-line-clamp', 'name-piece']`.
    The guard then fails in ttt-prod at every place its code names one of those classes, until each
    is swapped onto ui-core 0.11.44's `ClippedText`: `<X className="… single-line-truncate" title={t}>{t}</X>` becomes
    `<ClippedText asChild text={t}><X className="…" /></ClippedText>`, and `three-line-clamp` becomes
    `lines={3}` on `ClippedText`. That red is expected, and no clip
    class goes on the reviewed list to quiet it.
- **Done when:** the lockfiles name `@ttt-productions/repo-guards` 0.1.57 or later, all three guards'
  facts are declared, `readsOnlyWhenShown` is green, and `browserBarAlwaysShown` is green once
  no manifest sets a display other than `browser`, and `sharedTruncation` is green once every clip
  class in app code is swapped onto `ClippedText`.
