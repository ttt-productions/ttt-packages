# React packages (FRONTEND)

Rules for React package code: components, hooks, client state, pending and failure states,
accessibility, and motion. A consuming app's own rules govern how it uses these packages. Format and
IDs: [README.md](README.md).

### FRONTEND-001 — One canonical component/variant/class per repeated UI pattern

**Rule.** Every repeated UI pattern a package provides — button, select, link, expansion control,
card, dialog, chip, toggle, pending/empty/error state, list row — has one canonical component,
variant, or class. Before adding one, find the existing pattern and use or extend it; inconsistent
versions found in touched code are consolidated or surfaced (ENG-008), never matched.

**Why.** Every reinvented control is drift the moment it is written.

**Prohibits.**
- A new primitive, wrapper copy, or copied style block where a canonical one exists.
- A second variant added to match an inconsistent one.

**References.** ENG-002, ENG-003; `docs/packages/ui-core.md`.

### FRONTEND-010 — Browser storage holds device-local state only, through guarded access

**Rule.** A package touches `localStorage` / `sessionStorage` only for device-local state, with keys
the consuming app supplies, and every access tolerates a store that throws: reads fall back to
"nothing saved" and writes never throw. A stored value other tabs act on stays consistent across tabs
through the `storage` event.

**Why.** An unguarded storage read in a store snapshot crashes every route for a user whose browser
blocks site data.

**Prohibits.**
- An unguarded storage access; a hand-typed app storage key inside a generic package.
- A cross-tab value that ignores the `storage` event.

**References.** ARCH-201; `docs/packages/theme-core.md`.

### FRONTEND-108 — Auth-scoped subscribers reset on identity change

**Rule.** Any subscriber, cache, or "me" read a package keeps for the signed-in user resets when
identity changes, keyed by uid, so the new user's first snapshot is fresh. UI state bound to the
signed-in user is keyed by uid or remounts on a uid change, and an async completion from a superseded
identity or lifecycle is fenced by the uid or a generation before it touches current state.

**Why.** A subscriber that survives a sign-out/sign-in shows one account another account's state.

**Prohibits.**
- An auth-scoped subscriber or cache that survives an identity change; an auth-scoped key without the uid.
- A late completion from a previous identity applied to the current one.

**References.** `docs/design/display-identity-invariant.md`; `docs/packages/auth-core.md`, `query-core.md`.

### FRONTEND-201 — Every async control shows its own pending state through the shared primitives

**Rule.** A control that starts async work shows a visible pending state for the FULL duration through
the shared primitives (ui-core `Button` `pending`, `Spinner`, control `pending`, `LoadingState`,
`AsyncActionMenuItem`, and the confirmation dialog). Pending comes from the action itself, never a
hook-wide flag; repeat submissions are rejected while pending; a dialog or menu cannot be dismissed
while its action runs. Pending ends on the command's own settled outcome, never a proxy, and a failed
command reaches its surface. Nothing claims success before the backend commits.

**Why.** Hand-wired spinners stop too early, spin unrelated controls, or get forgotten.

**Prohibits.**
- A hand-placed spinning icon outside `Spinner`; `disabled` alone as the indicator.
- A hook-wide flag driving one control's pending; pending ended by a timeout or list change.
- An optimistic patch that claims success before commit.

**References.** FRONTEND-206; `docs/packages/ui-core.md`.

### FRONTEND-203 — Accessibility baseline

**Rule.** Package components are keyboard- and screen-reader-functional: icon-only buttons carry an
accessible name (`aria-label` or an `sr-only` child — never `title` alone); form primitives associate
help, counter, and error text through `aria-describedby`; custom overlays close on Escape; no
positive `tabindex`; the focus ring stays visible; semantics match behavior (navigation is a link,
an action is a button, a button in a form states its `type`); selecting or toggling controls expose
their state; repeated per-item controls carry distinct names; a focused control that unmounts or
disables first moves focus to a defined control.

**Why.** These are the concrete failures that break keyboard and screen-reader users.

**Prohibits.**
- An unnamed icon-only button; a positive `tabindex`; a custom overlay without Escape.
- A `div` as an interactive trigger; a form button with no `type`.
- A toggling control with no state; identical names on repeated controls; focus dropped to the body.

**References.** `docs/packages/ui-core.md`.

### FRONTEND-204 — Motion uses tokens, opacity/transform only, one reduced-motion preference

**Rule.** Package transitions use the motion tokens theme-core declares (`--motion-fast`,
`--motion-base`, `--motion-slow`, `--motion-ease`), never a raw duration; they animate `opacity` /
`transform` only and name the property they animate. Script-requested motion (a smooth scroll, a
timed step) reads the one effective reduced-motion preference the package exposes.

**Why.** Raw durations drift from the system rhythm; motion a script requests by name escapes the
CSS reduced-motion switch.

**Prohibits.**
- A raw duration or easing; animating a layout property; `transition-all`.
- Script motion that ignores the effective reduced-motion preference.

**References.** `docs/packages/theme-core.md`.

### FRONTEND-206 — Pending, failed, and answered reads never stand in for one another

**Rule.** A read is pending, failed, or answered, and every package hook and component keeps the
three apart. Pending never renders as empty, zero, or a default; a failure never renders as an
absence and always offers its own retry, held from query-core's `useReadRetryState`, never from
TanStack's live flags; an answered absence is an answer, never a failure. A hook never hands its
consumer a default it cannot tell from data. An infinite list keeps the rows it loaded when a later
page fails.

**Why.** A false empty state reads as the truth and drives controls wrongly.

**Prohibits.**
- A hook mapping a failed or missing read to `[]` / `0` / `false` / absent.
- A failure with no retry; a retry state built from `isError` / `isFetching`.
- A failed later page replacing loaded rows.

**References.** ENG-009; FRONTEND-201; `docs/packages/query-core.md`.

### FRONTEND-207 — Unsaved input is never discarded silently

**Rule.** A package surface holding unsaved input never loses it without the user's say: every path
that would drop it asks first (through the shared confirmation and the one shared leave guard) or
keeps the draft. A refresh of the stored value never overwrites a field the user changed. A surface
with nothing unsaved closes without asking.

**Why.** Lost typed work reads as the app's intent, so nobody reports it.

**Prohibits.**
- A close, cancel, Escape, or navigation that discards dirty input with no confirmation.
- A reset keyed on a live document that overwrites edited fields; a per-editor `beforeunload`.

**References.** `docs/packages/upload-ui.md` (the shared leave guard).
