# Adopt @ttt-productions/dev-standards 0.0.34

**What:** Two new shared rules: a page never moves after it draws (RULE-STD-FRONTEND-208), and a picture downloads only when shown, at the size it is drawn (RULE-STD-MEDIA-103).
**Severity:** medium
**Came from:** the Q-Sports triage-fixes ttt-packages session

- **Package and version:** `@ttt-productions/dev-standards` 0.0.34.
- **Release:** `./scripts/release-multiple.sh auth-core q-core media-viewer repo-guards dev-standards patch`.
- **What changed:** `rules/frontend/interaction-accessibility-and-motion.md` §
  RULE-STD-FRONTEND-208 and `rules/media/serving-and-rendering.md` § RULE-STD-MEDIA-103; the
  ux-audit playbook's step 2 audits the first, the new performance-audit step 11 the second, and
  the crosswalk lists both (the first with the repo-guards `pagesNeverMove` guard).
- **What the app must change:** Install. ttt-prod's items
  `docs/work/waiting-to-be-implemented/pages-never-move-after-they-draw.md` and
  `pictures-download-only-what-shows.md` build to these rules.
- **Done when:** the lockfiles name `@ttt-productions/dev-standards` 0.0.34 or later.
