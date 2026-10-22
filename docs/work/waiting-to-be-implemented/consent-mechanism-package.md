# Move the cookie-consent mechanism into a package

**What:** the analytics/cookie-consent mechanism (one consent per browser, persisted, gating
analytics start and stop) becomes a generic package both apps use; its design doc moves with it.
**Severity:** low
**Came from:** the shared-standards run (PLAN.md § What is shared — `analytics-consent.md`)

## Why

Both products need opt-in consent that keeps analytics off until the user accepts, applies a choice
in every open tab at once, and fails safe when read outside its provider. Today ttt-prod owns that
mechanism in its app code and describes it in its own `docs/design/analytics-consent.md`; a second
product would have to copy it, which is the parallel system RULE-STD-ENG-003 forbids.

## Fix shape

- A generic package (a new one, or an existing UI package that owns client state — decided when the
  work starts) holds the consent store, its provider and hook, cross-tab sync, and the analytics
  start/stop seam. The app supplies its storage key, its analytics adapter, and its banner copy
  (RULE-STD-ARCH-201).
- The mechanism's design moves to this repo's `docs/packages/` (or `docs/design/`); each app's design
  doc keeps only its app behavior: which analytics product, the banner's placement and words.
- Each app adopts it through the normal release and adoption files.

## Done when

The package is released, both apps consume it, and no app holds its own consent store.
