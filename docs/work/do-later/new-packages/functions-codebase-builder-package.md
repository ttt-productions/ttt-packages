# A shared Functions codebase builder

**What:** Move the Firebase Functions codebase builder — the manifest-driven esbuild bundler and the CI codebase selector — out of each app and into one shared package both products call with their own facts.
**Severity:** low
**Came from:** DJ, 2026-10-31, in the Q-Sports ttt-parity section 5a conversation
**Trigger:** Either app needs a change to how its Functions codebases are built or selected, or a third product needs Functions codebases at all.

## Why

The same builder lives in each app, copied:

- **ttt-prod:** `functions/scripts/build-codebases.mjs` (the manifest-driven esbuild build: one
  bundle per codebase, generated `FUNCTION_TARGET`-gated entries, per-codebase `package.json` and
  lockfile subsets, sidecar entries, the watch mode `dev:local` runs) and `scripts/select-codebases.mjs`
  (CI's choice of which codebases a push deploys: global inputs → the full fleet, index or manifest
  changes → an entry-signature diff, other source changes → the codebases whose esbuild metafile
  names the file, anything unattributable → the full fleet).
- **Q-Sports:** a copy of both, renamed and adapted, adopted with its codebase split in ttt-parity
  section 5a (before that, its own single-bundle `functions/scripts/build-bundle.mjs`).

Two copies of one mechanism drift (RULE-STD-ENG-002). The deploy side of the same system is
already shared — repo-guards' `node/tooling` holds `deployFunctionsInPasses`,
`checkDeployedFunctions`, `targetedCodebases` and the `codebaseManifest` guard — so the builder is
the half still copied.

## The idea, generically

Everything app-specific comes in as configuration (RULE-STD-ARCH-201): the functions folder, the
manifest path, the baseline runtime packages every codebase needs, the sidecar entries and the
codebases they ride, and the bootstrap module the generated entry loads first. The package owns the
build, the generated entry, the package and lockfile subsets, the watch mode, and the selector; each
app keeps a thin script, as it already does for the deploy and the quiet gate. Its likely home is
repo-guards' `node/tooling` beside the deploy passes, or a package of its own if the esbuild
dependency should stay out of repo-guards.

## Done when

Both apps build and select their codebases through the one shared builder, each with a thin script
holding only its facts, and neither app keeps a copy of the mechanism or its tests.
