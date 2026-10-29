# Adopt @ttt-productions/repo-guards 0.1.34

**What:** The later-page guard counts only surfaces that load more of an infinite list or hand a list on.
**Severity:** low
**Came from:** the ttt-packages shared-package session (Q-Sports scope, ttt-parity)

- **Package and version:** `@ttt-productions/repo-guards` 0.1.34.
- **Release:** `./scripts/release-multiple.sh repo-guards patch`.
- **What changed:**
  - `laterPageFailure` ("an infinite list's later-page failure routes through the read-state module") counted any surface that named `hasNextPage` or `fetchNextPage`. It now counts a surface that names `fetchNextPage`, or that hands a list on through the hand-off prop (`list={…}`) to a component other than a list route. A page-by-page list (`hasNextPage` feeding a pager) and a count that only reads `hasNextPage` load nothing more and are no longer counted.
  - A surface that hands a list on is now checked even when it names neither paging field: it passes when the component it hands to routes the list itself. In ttt-prod this newly checks `audition-card-content.tsx`, which passes (`AuditionEntryCarousel` routes its list).
  - The facts are unchanged.
- **What the app must change:** Install `@ttt-productions/repo-guards@latest` and run the guard suite. Every surface that passed before still passes; `square-streetz-post-lists.tsx` is still checked, now because its load-more feed calls `fetchNextPage`.
- **Done when:** The lockfiles name `@ttt-productions/repo-guards` 0.1.34 or later and the guard suite is green.
