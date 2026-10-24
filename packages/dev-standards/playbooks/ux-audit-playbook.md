# UX Audit Playbook

## Purpose

Audit user-facing quality across loading, empty, and error states, mobile, accessibility, form
feedback, perceived latency, and copy consistency — verifying the UI still obeys the
`RULE-STD-FRONTEND-*` rules (the interaction, accessibility, and motion 200s included) and the app's
terminology contract (`<TERMINOLOGY_DOC>`). The bar: a first-time visitor on a phone never sees a blank
screen, a dead button, or an unexplained failure. Methodology only; the per-step contract, boundary,
and verdict are [README.md](README.md)'s.

It is NOT a rulebook, NOT a design doc (the app's UI design doc holds the UI system), and NOT a
findings log. The hygiene playbook's UX tripwires (steps 57, 65, 68) are the always-on backstop; this
is the deep audit they point to.

**Boundary notes.** The manual steps run on the local dev server; with no server up they are
`NOT RUN`. A hosted URL is `BLOCKED` unless DJ authorizes it.

## When to run

Before launch; after adding a route, a form, an async control, a media surface, or user-facing copy.

## Audit Steps

### 1. Route inventory
**Rules:** the app's UI design doc (layout and navigation) — a scoping step. **Scope:** `src/app`.
```bash
rg --files src/app -g 'page.tsx'
```
**Expected:** an enumeration that feeds steps 2–11, so it is **what the command prints**, never a list
kept here. Classify every printed route as public, authenticated, or neither (a front door with no
content of its own, a static configuration notice — audited for copy and theme only). **A route the
command prints that lands in no bucket is the finding.** Audit each in BOTH states where they differ —
signed-out and signed-in render differently, and missing that split is how a signed-out render escapes
the audit. Write findings with the app's settled UI labels.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 2. The three states, per page
**Rules:** RULE-STD-FRONTEND-201, RULE-STD-FRONTEND-205, RULE-STD-FRONTEND-206. **Scope:** every route
from step 1. **Method (manual review on the local dev server).**
**Expected:** each route shows all three states, each intentional:
- **Loading** — the canonical pending state or a skeleton with no layout jump — never the empty state,
  a zero count, or placeholder text that reads as data while the read is in flight. A control that
  starts async work shows a visible in-progress indicator for the full duration, through the refetch
  that shows the result and any post-action navigation — never a bare disabled or label swap. A
  path-changing navigation shows the page overlay after its short delay; a query-only one shows
  pending on the control that triggered it.
- **Empty** — a real empty state with copy and a next action, not a blank list.
- **Error** — the canonical load-error state for a failed read (an actionable message, no raw error
  text, a retry that shows its own pending), and the error boundary catches render failures.
- **Dependent reads that choose an action** — where a read decides WHICH control appears, a loading
  read shows pending and a failed read shows the error state with a retry — never the "none" answer's
  control. A rules-denied get that means "not there for this reader" is a designed "none", never a
  failure.
- **Search dropdowns** — every settled state: waiting out the debounce reads as searching; an answered
  empty search keeps the dropdown open on its empty line; a failed search keeps it open on the inline
  error with a working retry. Escape, a click outside, and a selection close it.
- **Infinite lists** — a failed LATER read keeps the rows already loaded and shows an inline error at
  the page boundary whose retry re-runs that read; only a failure with nothing loaded replaces the list.
  A background refetch never swaps loaded rows back to skeletons.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 3. Mobile pass
**Rules:** RULE-STD-FRONTEND-007. **Scope:** every launch-critical route. **Method (manual review at
360px and 414px on the local dev server).**
**Expected:** no horizontal overflow, tap targets of about 44px, sticky elements that never cover
content, usable dialogs and popovers, reachable media controls. Every page composes the one page
column (no page-level `max-w-*` caps), every branch of a page — loading, empty, error — renders inside
it, and long user content (titles, names) renders through the shared truncation class so it never
breaks layout; where the truncated text is the record's only identification, the full value stays
reachable through its accessible name or title.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 4. Accessibility
**Rules:** RULE-STD-FRONTEND-203, RULE-STD-FRONTEND-204, RULE-STD-FRONTEND-003. **Scope:** the major
routes. **Method (axe and Lighthouse on the local dev server, plus a keyboard walkthrough).**
**Expected:** beyond the component-level lint rules — one `main` landmark and skip link owned by the
shell, with no page rendering its own `<main>`; icon-only buttons and every dropdown carry an accessible name, and a
control repeated per item is named for its item; a custom choice button announces its selected state;
a search dropdown is a labeled combobox whose highlighted result is announced as it moves, with Enter
to pick and Escape to close, and two searches on one page never share an id; form fields associate
help, counter, and error text through `aria-describedby`; custom overlays close on Escape; no positive
`tabindex`, and the focus ring stays visible. A keyboard-only walkthrough of the app's core journey
shows visible focus, no traps, and dialogs that return focus. Contrast passes in every theme the app
ships. Every animation respects the one reduced-motion preference — the OS setting or the device-local
manual setting. Guard-enforced half: the `@ttt-productions/dev-standards/node/a11y` axe run (default,
high-contrast, reduced-motion) in the app's e2e stage, and the shared ESLint base's `jsx-a11y`
recommended rules.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 5. Form feedback
**Rules:** RULE-STD-FRONTEND-201, RULE-STD-FRONTEND-203, RULE-STD-FRONTEND-207. **Scope:** every form.
**Method (manual review + submit under a throttled network).**
**Expected:** inline validation sits near the field (wired through `aria-describedby`), not toast-only;
submit controls show pending for the full duration and refuse repeat submissions while pending; server
errors map to human copy, never raw internals; a slow network cannot produce a double submit; and a
form holding unsaved input never drops it without asking (Cancel, Escape, an overlay click, a
navigation).
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 6. Perceived latency
**Rules:** RULE-STD-FRONTEND-201, RULE-STD-FRONTEND-103, RULE-STD-FRONTEND-205, RULE-STD-MEDIA-008,
RULE-STD-MEDIA-009. **Scope:** high-frequency mutations + upload flows. **Method (manual review under a
throttled network).**
**Expected:** mutations users watch (like, follow, vote, post) show pending the instant the click
registers — never an optimistic success claimed before the backend commits. Infinite feeds update by an
in-place cache patch, never an invalidation or refetch, so a new item appears without a reload.
Anything over about 400ms with no feedback is a finding. Upload flows show progress and survive
navigation: the always-visible tray owns backend processing, and leaving is guarded by the package
mechanisms through the one navigation helper — verify the tray is reachable everywhere uploads start.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 7. Copy consistency
**Rules:** the app's terminology doc (`<TERMINOLOGY_DOC>`). **Scope:** user-facing strings in `src`.
```bash
rg -n "pendingMedia|callable|lorem|placeholder|TODO" src/components src/app -g '*.tsx' -g '!**/__tests__/**'
```
**Expected:** classify each hit — a code identifier, prop, or comment is a false positive; a
user-rendered string is the target. User-visible strings use the settled UI terms and contain no
placeholder text and no internal jargon. Old terminology on a new surface is a finding. The app's
additions carry its per-term sweep.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 8. Toast hygiene
**Rules:** RULE-STD-QUALITY-103, RULE-STD-FRONTEND-105, RULE-STD-FRONTEND-109. **Scope:** `src`
components and hooks.
```bash
rg -n "toast\.|showErrorToast|captureException" src/components src/hooks -g '*.ts' -g '*.tsx' -g '!**/__tests__/**'
```
**Expected:** one surface per user action. The declared callables' policy owns the standard error
toast and the expected-answer filter; a call site never adds a second toast or a second capture for the
same rejection — it opts out and owns the copy, or gates on the rejection check. An error that blocks a
flow belongs inline, not only as a vanishing toast. The build-failing double-surface guard is
`codebase-hygiene-playbook.md` step 60.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 10. First-run walkthrough
**Rules:** the app's registration and first-visit design docs (no dedicated rule). **Scope:** the
new-user path. **Method (manual walkthrough on the local dev server).**
**Expected:** as a brand-new user — landing → sign-up → verification → first meaningful action — count
the steps and the moments of confusion; every "what do I do now?" gap is a finding.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 11. Degraded mode — what the user sees when a dependency is down
**Rules:** RULE-STD-FRONTEND-105, RULE-STD-FRONTEND-201, RULE-STD-FRONTEND-206, RULE-STD-QUALITY-103,
RULE-STD-ENG-009. **Scope:** `src`. **Method (semantic review over the app's fallback branches — its
additions locate them).** Steps 2 and 5 cover an ordinary failed request; this step covers a dependency
being gone, which renders differently and is the case nobody clicks through by hand.
**Expected:** for each external dependency the client reaches (a realtime service, a media gateway, a
limiter), the review judges what each degraded branch *renders*: a retrying transient state reads as
reconnecting or loading, never as an empty conversation, missing media, or "you can't view this" (which
the owner reads as data loss); a terminal denial says something a user can act on, never a code; a
safety-critical submission is never refused because a supporting service is unreachable. **The finding
shapes:** an outage rendered as an empty state, as a validation error, or as a dead end with no retry;
a degraded branch with no visible state; and a second toast or capture layered on a rejection the
callable path already owns.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 12. Signed-out mobile walk of the public legal and safety surfaces
**Rules:** RULE-STD-FRONTEND-007, RULE-STD-FRONTEND-203, RULE-STD-FRONTEND-201; the app's terminology
doc for the copy. The legal content itself is not graded here. **Scope:** every public legal and
safety route step 1 classifies (the app's additions list them). **Method (manual walkthrough at 360px
and 414px, signed out, on the local dev server).**
**Expected:** each surface is reachable and usable by a person who has never signed in, on a phone:
reachable without an account (a legal or safety surface behind a login wall is the finding, and a
serious one for a safety intake — the person who needs it most is usually not a user); readable at 360px
(no horizontal overflow, no clipped text, no fixed-width block forcing a sideways scroll); every intake
form a working form on a phone — fields labelled and associated with their help and error text, tap
targets of about 44px, file controls usable from a mobile picker, submit pending for the full duration,
a rejection explained inline; and copy that uses the settled terms and matches what the system actually
does.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

## Pass / Fail

Per [README.md](README.md) § Verdict. **PASS** — every launch-critical route has intentional loading,
empty, and error states, works at mobile widths, passes keyboard and contrast checks in every theme,
and high-frequency mutations give immediate feedback. **FAIL** — a core flow can dead-end without
explanation, a launch-critical page breaks at mobile widths, or an accessibility basic fails on a major
page.
