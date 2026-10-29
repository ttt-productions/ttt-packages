# Adopt @ttt-productions/theme-core 0.12.16

**What:** theme-core owns the one single-line truncation class and the one three-line clamp class.
**Severity:** low
**Came from:** the ttt-packages shared-package session (Q-Sports scope, ttt-parity)

- **Package and version:** `@ttt-productions/theme-core` 0.12.16.
- **Release:** `./scripts/release-multiple.sh dev-standards repo-guards theme-core patch`.
- **What changed:** `components.css` declares `.single-line-truncate` (one line, ellipsis, `min-width: 0`) and `.three-line-clamp` (three lines), the same CSS as ttt-prod's `.ttt-truncate` and `.ttt-clamp-3`.
- **What the app must change:** Install `@ttt-productions/theme-core@latest`. Replace every `ttt-truncate` with `single-line-truncate` and every `ttt-clamp-3` with `three-line-clamp` across `src` (`ExpandableText` and its tests included), and delete both rules from `src/app/styles/components.css` (comments naming `.ttt-truncate` follow the rename). In the guard config's `sharedTruncation`, set `sharedClass: 'single-line-truncate'` and the clamp owners to `.single-line-truncate` and `.three-line-clamp` (with repo-guards 0.1.33's `entryStylesheet`). Any app rulebook or design-doc text that names `.ttt-truncate` / `.ttt-clamp-3` names theme-core's classes instead.
- **Done when:** The lockfiles name `@ttt-productions/theme-core` 0.12.16 or later, no `ttt-truncate` or `ttt-clamp-3` remains in the repository, and the guard suite is green.
