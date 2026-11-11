# Adopt @ttt-productions/dev-standards 0.0.40

**What:** The colour rule names its one allowed concrete colour: the site definition's theme and background colours; the clip playbook steps name `ClippedText`'s `as`, `InlineName` and `MachineText`; four rules change: no provider reads Firestore (FRONTEND-104), an entry index names each file directly (ARCH-203), the clip rule names `InlineName` and `MachineText` (FRONTEND-007), and a clipboard copy goes through `CopyButton` (FRONTEND-001); the browser-storage rule names storage-core as the helper's home, and a package-boundaries step audits it.
**Severity:** low

- **Package and version:** `@ttt-productions/dev-standards` 0.0.40.
- **Release:** `./scripts/release-multiple.sh dev-standards storage-core firebase-helpers
  ui-core repo-guards theme-core consent-core query-core app-config-core notification-core
  sweep-core auth-core q-core media-viewer file-input upload-core patch`.
- **What changed:** text only.
  - RULE-STD-FRONTEND-003 (`rules/frontend/core-rules.md`): the one concrete colour app code writes
    is the theme and background colour of the app's one site-core site definition. A web manifest
    and the `theme-color` tag are read outside CSS and cannot resolve a token, so those two fields
    are plain colour strings, allowed by the repo-guards `colorLiterals` guard only there, through
    the app's guard config. Its Prohibits line now names `.ts` files beside `.tsx` and `.css`, with
    that one carve-out.
  - Codebase-hygiene playbook step 15's Expected names the same carve-out. The crosswalk row is
    unchanged.
  - Codebase-hygiene playbook step 68 and UX-audit playbook step 3 (RULE-STD-FRONTEND-007): the
    element `ClippedText` renders is the box that clips — a plain tag named with `as`, a component
    under `asChild`; a name inside a sentence wraps whole through ui-core's `InlineName`, and
    machine text breaks through `MachineText`. Step 68's clip-guard check now also covers the break
    classes (`sharedTruncation.breakClasses`), break utilities, plain tags under
    `ClippedText` or `MachineText` `asChild` or around a lone `ClippedText`, and stylesheet breaks outside the break
    owners. The crosswalk row is unchanged.
  - RULE-STD-FRONTEND-104 (`rules/frontend/data-and-callable-access.md`): the one sanctioned
    direct-Firestore site is inside a `queryFn`. Root-provider hydration is no longer allowed: no
    provider reads Firestore itself, and the live app configuration reaches the app through
    `createAppConfig`, the shared packages' one app-config provider, which the app's own provider
    module is built on. RULE-STD-ARCH-001
    and codebase-hygiene step 7 and performance-audit step 5 say the same.
  - RULE-STD-ARCH-203 (`rules/architecture/packages-and-boundaries.md`, packages): an entry `index`
    re-exports each file named directly, never through another index.
  - RULE-STD-FRONTEND-007 (`rules/frontend/core-rules.md`): `ClippedText` binds every user-supplied
    title and name that stands as its own text, its element being the box that clips (a plain tag
    named with `as`, a component under `asChild`); a name inside a sentence renders through
    ui-core's `InlineName` and is never cut, and machine text (an id, an email, a hash, a file name)
    through `MachineText`, which breaks anywhere and never cuts. Its Prohibits gain a plain tag
    under `ClippedText asChild` or wrapped around a lone `ClippedText`, a name in a sentence
    clipped, and the break classes or utilities placed by hand.
  - RULE-STD-FRONTEND-001 (`rules/frontend/core-rules.md`): a value copied to the clipboard goes
    through ui-core's `CopyButton`; a hand-written clipboard copy in app code is prohibited.
    Codebase-hygiene step 68 searches `src` for `navigator.clipboard` and `execCommand('copy')`.
  - RULE-STD-FRONTEND-010 (`rules/frontend/core-rules.md`): its References name ttt-packages
    `docs/packages/storage-core.md`, the guarded storage helper's home, in place of theme-core's
    doc. The rule's text is unchanged.
  - Package-boundaries playbook step 11 (new): the `browserStorage` guard runs over every package's
    code in ttt-packages' boundary suite, and a package stores only under a key the app hands in.
    The crosswalk row for RULE-STD-FRONTEND-010 adds it.
  - RULE-STD-ARCH-208 (`rules/architecture/packages-and-boundaries.md`): published internal ranges on 0.x lock the minor as a caret, or `>=0.0.z <0.1.0` for a `0.0.z` dependency; the rule is otherwise unchanged.
- **What the app must change:** the install, then check that ttt-prod's own
  `docs/engineering-rules/frontend/core-rules.md` states nothing about RULE-STD-FRONTEND-003 that
  contradicts the carve-out; once ttt-prod has its site definition, the guard fact that applies it
  is `colorLiterals.siteDefinitionModule` in its guard config (repo-guards 0.1.58). For the clip
  steps, nothing beyond the ui-core 0.11.45 and repo-guards 0.1.58 adoptions.
  - ttt-prod's `docs/engineering-rules/frontend/data-and-callable-access.md` gains the
    RULE-STD-FRONTEND-104 addition it lacks, under a "ttt-prod additions" heading: its app-config
    provider is `src/components/app-config-provider.tsx`, built on `createAppConfig`, the shared packages' one app-config provider,
    and the two guards that enforce the rule run in `src/__tests__/guards/repo-guards.test.ts`:
    "no component or route imports the Firestore runtime" and "the client never writes Firestore".
  - Check that nothing in ttt-prod's rulebook still allows root-provider hydration or contradicts
    the RULE-STD-FRONTEND-007 and RULE-STD-FRONTEND-001 text above, and that `src` holds no
    hand-written clipboard copy (each one moves onto `CopyButton`).
- **Done when:** the lockfile names `@ttt-productions/dev-standards` 0.0.40 or later, ttt-prod's
  rulebook holds nothing that contradicts these rules and holds its RULE-STD-FRONTEND-104 addition.
