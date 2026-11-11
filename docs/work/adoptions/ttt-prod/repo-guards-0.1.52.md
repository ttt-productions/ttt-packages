# Adopt @ttt-productions/repo-guards 0.1.52

**What:** A new generic guard, `pagesNeverMove`, enforces RULE-STD-FRONTEND-208; every app declares its facts.
**Severity:** medium

- **Package and version:** `@ttt-productions/repo-guards` 0.1.52.
- **Release:** `./scripts/release-multiple.sh auth-core q-core media-viewer repo-guards dev-standards patch`.
- **What changed:** `generic.pagesNeverMove` (it cannot be declared absent) runs four checks over
  the app's render surfaces: a component that renders a loading or read-state arm and `null` in
  another; a read-state component with `empty={null}`; a render-phase `useState(false)` latch set
  to `true` and never back; and a returned `||` chain that counts a read that has not answered
  (`<pendingSignal> === undefined` / `== null`) as showing. Facts: `surfaceTrees`,
  `gateComponents` (the loading state, the read-state components, and any list frame that renders a
  pending arm), `readStateComponents` (the components that take an `empty` prop),
  `pendingSignals` (the read fields whose absence means not yet answered), and
  `exceptions` { `nullArms`, `emptyNull`, `latches`, `unansweredShowing` }, each entry a
  path and its why.
- **What the app must change:** declare the facts in ttt-prod's guard config. Each hit is fixed by
  ttt-prod's item `docs/work/waiting-to-be-implemented/pages-never-move-after-they-draw.md`; an
  exception goes on the reviewed list only on DJ's yes, with its reason.
- **Done when:** the lockfiles name `@ttt-productions/repo-guards` 0.1.52 or later and the guard
  suite is green with the facts declared.
