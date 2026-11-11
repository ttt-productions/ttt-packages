# Adopt @ttt-productions/theme-core 0.12.18

**What:** theme-core gains a two-line clamp and the name-piece class that ui-core's `ClippedText` draws through.
**Severity:** low

- **Package and version:** `@ttt-productions/theme-core` 0.12.18.
- **Release:** `./scripts/release-multiple.sh theme-core ui-core mobile-core firebase-helpers query-core q-core site-core dev-standards repo-guards patch`.
- **What changed:** `components.css` adds `.two-line-clamp` (the three-line clamp at two lines) and
  `.name-piece` (one piece of a two-piece name: an inline block no wider than its line, keeping its
  link's underline). Existing classes are unchanged (`docs/packages/theme-core.md` § Recipes and
  components read tokens, not literals).
- **What the app must change:** the install. If ttt-prod's repo-guards truncation config lists
  theme-core's clamp owners, `.two-line-clamp` joins `.single-line-truncate` and
  `.three-line-clamp` there. The app places neither class by hand; ui-core's `ClippedText` does.
- **Done when:** ttt-prod's lockfile names `@ttt-productions/theme-core` 0.12.18 or later.
