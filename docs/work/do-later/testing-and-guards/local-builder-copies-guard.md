# A guard against test-local copies of shared fixture builders

**What:** A repo-guards check that fails a test-local function or constant building a document type that the app's shared test builders already build.
**Severity:** low
**Came from:** the shared-standards Phase 3 repair session (ttt-prod scope), while converting ttt-prod's upload-surface tests
**Trigger:** after launch, when DJ turns to improving the test code

This is a write-up of the item as it is known now, not a finished design.

## The gap

Each app keeps its shared fixture builders in one file (ttt-prod: `src/test/builders.ts`). The
"use the shared builder" rule lives only in agent briefs, so tests keep growing local copies that
drift from the schema-valid defaults the shared builder holds. Seen in ttt-prod's
`src/__tests__/components/upload-surfaces/sub-item-media-grant-states.test.tsx` (local `chapter` /
`tuneTrack` / `episode` beside `fullChapter` / `fullTuneTrack` / `fullTelevisionEpisode`),
`craft-skills-section-counter.test.tsx` (`craft()`), and
`selected-commission-details-section.test.tsx` (`makeSelectedCommission` beside
`commissionListing`). Those three are being moved onto the shared builders in the repair session;
the class can come back.

## Fix shape (not decided)

An AST check over the app's test files: a test-local function or `const` whose declared or inferred
type is a type some export of the app's builders file returns fails, unless it calls that builder.
The app's guard config names the builders file. Inferred types are the hard part: a type-aware check
costs a TypeScript program per run, while a declared-type-only check misses untyped literals.

A generic repo-guards check (packages-side), adopted by each app through its guard config.

## Done when

The check is in repo-guards with its own tests, each app registers it with its builders file, and
every local copy it flags is moved onto the shared builder or carries a reviewed entry DJ approved.
