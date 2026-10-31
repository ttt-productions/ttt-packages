# Frontend — interaction, accessibility & motion (FRONTEND 200s)

Format, scopes, and rule IDs: [../README.md](../README.md).

Pending/confirmation UX, in-app navigation, loading states, unsaved input, the accessibility baseline, and motion. Read with [core-rules.md](core-rules.md) for any task that adds an async control, a confirmation, a navigation, a loading/empty state, an editor that holds unsaved input, or an animation.

### RULE-STD-FRONTEND-201 — Every async control shows its own pending state through the shared primitives
**Scope.** both

**Rule.** A control that starts async work shows a VISIBLE pending state for the FULL duration — chained calls, the refetch that makes the result visible, and any post-action navigation included — through the shared primitives only: ui-core `Button` `pending` (with its `icon` slot), `Spinner`, control `pending` (`Switch`, `SelectTrigger`, `DropdownMenuItem`), and `ConsequenceDialog` (RULE-STD-FRONTEND-202), plus the app's own shared pending state (`<LOADING_STATE>`), refetch button, and async menu item (its addition names the last two). Pending comes from the action itself, never a hook-wide flag. Repeat submissions are rejected while pending; a dialog or menu cannot be dismissed while its action runs. The policy is authoritative-pending, never optimistic: the UI never claims success before the backend commits. Pending ends on the command's OWN settled outcome — correlated to the command that started it — never on a proxy (a timeout, the row leaving a list, a promise that resolves without the command having run), and a failed command reaches its surface.

**Apps:** the action's pending comes from its own mutation (per-row or unmount-surviving pending through the shared pending layer, `<INTERACTIVE_PENDING_LAYER>`), `<APP_ASYNC_ACTION>` for async work that is not a mutation, or an awaited `navigate()` (RULE-STD-FRONTEND-205).

**Why.** Opt-in, hand-wired spinners drift into many recipes, stop before the result is visible, spin unrelated controls off one shared flag, or get forgotten entirely — so users click again, leave mid-action, or read a stale screen as the result.

**Prohibits.**
- A hand-placed `Loader2` or `animate-spin` (a spinning icon included) outside ui-core's `Spinner`; `disabled` or a label swap as the only indicator; overriding the spinner color inside a control.
- A hook-wide flag (one mutation's `isPending` shared across rows or across different actions) driving a control's pending; `isPending && variables.id === row` per-row state.
- Pending that ends before the result is visible (an un-awaited refetch in `onSuccess`, a trailing un-awaited call, a navigation after the spinner cleared); `onConfirm={() => x.mutate(...)}` instead of returning the action's promise (ESLint-enforced); a dialog/menu dismissible mid-action; an optimistic cache patch that claims success before commit.
- Pending ended by a proxy — a timeout, a list change, a resolve with no command behind it — instead of the command's own outcome; a command failure dropped because nothing correlates it to the control that sent it.

**References.** RULE-STD-FRONTEND-202, RULE-STD-FRONTEND-205, RULE-STD-FRONTEND-206; ttt-packages `docs/packages/ui-core.md`.

### RULE-STD-FRONTEND-202 — ConsequenceDialog for consequential confirmations
**Scope.** apps

**Rule.** Consequential confirmations use `ConsequenceDialog` from `@ttt-productions/ui-core/react` — the app's SOLE confirmation primitive. It owns the pending spinner (RULE-STD-FRONTEND-201) and stays open while the action is pending or after it fails (stay-open-on-reject). Hand-built `AlertDialog` confirmations are banned in app code: the raw `AlertDialog*` primitives live only inside `ConsequenceDialog` (ui-core), and `window.confirm()` is never a gate. Destructive confirms render their red action only here (RULE-STD-FRONTEND-006). An action is consequential when it takes something away from someone — deletes or hides content, revokes a share or access, moves money — or when its actor cannot undo it from the same surface; it runs only after `ConsequenceDialog` confirms it. A reason a repair requires (RULE-STD-BACKEND-212) is gathered by the dialog itself, never by a prompt re-implemented beside it. A reversible, self-only toggle (like, follow, save) is not consequential and takes no confirmation; the app's addition names its other non-consequential actions.

**Why.** A hand-built `AlertDialog` confirm hides its pending spinner behind Radix's auto-close and can't stay open on reject — the user gets no feedback that a failed action failed; `window.confirm()` blocks the page and cannot show pending or failure at all. A consequential action on one click turns a mis-click into lasting harm: an un-share that is the only undo of a permanent share removes a file from every viewer with no step between the click and the call.

**Prohibits.**
- Importing or re-exporting any `AlertDialog*` from `@ttt-productions/ui-core/react`, or importing `@radix-ui/react-alert-dialog` directly, in app code (ESLint-enforced).
- A bespoke confirmation dialog for a consequential action; `window.confirm()` as a gate; a repair's reason gathered outside the dialog.
- A one-click trigger for a consequential action (an un-share, a takedown, a revoke, a delete).

**References.** RULE-STD-FRONTEND-006, RULE-STD-FRONTEND-201; RULE-STD-BACKEND-212; ttt-packages `docs/packages/ui-core.md`.

### RULE-STD-FRONTEND-203 — Accessibility baseline: landmarks, labels, focus, Escape
**Scope.** both

**Rule.** The baseline is "keyboard + screen-reader functional." Concretely:
- **Apps: one `main` landmark + skip link.** The app shell (the app's addition names its shell file and skip-link class) renders a skip link to `#main-content` as the first focusable element and owns the single `<main id="main-content">`. Pages must NOT render their own `<main>` (a nested `<main>` is a duplicate landmark).
- **Icon-only buttons carry an accessible name** — an `aria-label` or an `sr-only` text child (a `title` alone is not reliably announced). Status-only icon spans use `role="img"` + `aria-label` with the icon `aria-hidden`.
- **Form fields associate help/counter/error text via `aria-describedby`** — ui-core `FormField`/`FormItem` wire this automatically; raw `Input`/`Textarea` do it by hand.
- **Custom (non-Radix) overlays handle Escape-to-close.** Radix Dialog/Sheet/Popover already trap and restore focus.
- **No positive `tabindex`.** The `:focus-visible` ring stays visible in every theme.
- **Semantics match behavior.** Navigation is a link (the navigation helper's link with an `href`, RULE-STD-FRONTEND-205), an action is a button, and a non-interactive element is neither focusable nor clickable, except a labelled region (`role="region"` with an `aria-label`) whose text scrolls, which takes focus so a keyboard can scroll it; a trigger passed through `asChild` is a real button or link, never a `Badge` (a `div`). A button inside a form states its `type` — ui-core `Button` passes none, so an untyped one submits the form.
- **State and names are announced.** A card, chip, or tag that selects or toggles exposes it (`aria-pressed` / `aria-checked` / `aria-selected`); repeated per-item controls carry distinct names that say whose item they act on ("More actions for …"), never one label on every row.
- **Focus always has a destination.** A focused control that unmounts, hides, or disables mid-interaction first moves focus to a defined control.

**Why.** These are the concrete failures that break keyboard and screen-reader users: no skip target, an unlabeled icon button, an error no field points to, a custom overlay that traps focus with no Escape, a "link" with no `href`, a chip Tab never reaches, a selected card that never says so, a column of identical "More actions" buttons, and focus dropped to the page body when a view moves on.

**Prohibits.**
- A page rendering its own `<main>`; an icon-only button with no accessible name (a `title` alone is not one); a positive `tabindex`.
- A custom overlay without Escape-to-close; a raw input whose help/error text isn't wired via `aria-describedby`.
- `onClick` navigation on a button with no `href`; a `div` / `Badge` as an interactive trigger; a focusable control that does nothing; a button in a form with no `type`.
- A selecting or toggling control with no pressed/checked/selected state; identical accessible names on repeated per-item controls; unmounting or disabling the focused control with no focus destination.

**References.** RULE-STD-FRONTEND-205; `eslint-plugin-jsx-a11y`; ttt-packages `docs/packages/ui-core.md`.

### RULE-STD-FRONTEND-204 — Motion uses tokens, opacity/transform only, one reduced-motion kill-switch
**Scope.** both

**Rule.** Transitions use the motion tokens — never a raw duration. `@ttt-productions/theme-core` declares the four tokens and their theme-invariant defaults in its first-loading stylesheet: `--motion-fast` (150ms), `--motion-base` (200ms), `--motion-slow` (250ms), `--motion-ease`; an app may override any of them from a later-loading sheet, and a token it does not override keeps theme-core's value. An app may add tokens of its own in `components.css` (its addition names them), and binds Tailwind's default transition duration and easing to the tokens once in `globals.css` `@theme`. Animate `opacity`/`transform` ONLY, never layout properties; a page-level container that can hold a `position: fixed` FAB animates opacity ONLY, because a transformed ancestor becomes the containing block for fixed descendants and breaks them. A transition names the property it animates — never `transition-all`, never a Tailwind `duration-*` utility. Motion a script requests explicitly — `scrollIntoView({ behavior: 'smooth' })`, `scrollTo({ behavior })`, a timed step — reads the effective reduced-motion preference, because the CSS kill-switch cannot reach motion a script asks for by name.

**Apps:** effective reduced motion is ONE global kill-switch at the END of `components.css` (0.01ms `!important` overrides for animation/transition + `scroll-behavior: auto`) that activates when either `prefers-reduced-motion: reduce` matches OR the device-local manual reduced-motion setting is active; the device preference always wins, and the same effective preference stops JS-scheduled choreography and idle timers through the one shared motion store/helper.

**Packages:** script-requested motion reads the one effective reduced-motion preference the package exposes.

**Why.** Raw durations drift from the system rhythm; animating layout or a transformed page ancestor breaks fixed FABs; per-feature reduced-motion wrappers leave gaps the one kill-switch is meant to close. An explicit smooth scroll or a timed step runs at full motion for a user who asked for none, and `transition-all` animates whatever property changes next.

**Prohibits.**
- A raw duration/easing instead of a motion token; animating a layout property; a `transform` on a page-level fixed-FAB container; `transition-all` or a `duration-*` utility.
- An app sheet re-declaring a motion token at theme-core's own value — a second copy, not an override (RULE-STD-ENG-002).
- A per-feature reduced-motion wrapper or setting; JS choreography that ignores the shared motion store; UI that claims it can force full motion against the device preference.
- An explicit `behavior: 'smooth'` scroll, or a timed step, that ignores the effective reduced-motion preference.

**References.** RULE-STD-ENG-002; RULE-STD-FRONTEND-003; ttt-packages `docs/packages/theme-core.md`.

### RULE-STD-FRONTEND-205 — Every in-app navigation goes through the navigation helper
**Scope.** apps

**Rule.** In-app navigation runs through the ONE navigation helper, `<NAVIGATION_HELPER>`: its link component for links (also as the child of `<Button asChild>`), its `navigate()` for programmatic and post-action navigation, and its hard-navigation and reload functions for full-page loads. The helper runs the upload guard first (RULE-STD-MEDIA-009) — a cancelled guard resolves `false` and shows nothing — treats a same-URL target as a no-op, and ties the page overlay to the real navigation: a React transition, shown only for a pathname change after a short delay, gone when the route commits, with no timeout. `navigate()` resolves only once the destination has rendered, so a control that awaits it stays pending through a post-action navigation; a query-only navigation never shows the overlay — its triggering control shows pending by awaiting `navigate()`. Modifier/middle clicks and new-tab links stay browser-native; external links stay plain `<a>` or the helper's hard navigation. The one guard exception is the navigation after an already-ended session; a caller that warns about in-flight work confirms BEFORE ending the session. A URL the app builds carries identifiers and view state, never sensitive free text — a report narrative, a code, a token, a reason typed about a person — because history, request logs, telemetry, and analytics all read the URL; such text travels in memory or in a request body.

**Why.** A manually started overlay sticks on same-page, guard-cancelled, query-only, and modifier-click navigations until a timeout; links that forget it show nothing; navigations that skip the helper skip the upload guard; and query-only navigations have no pending state at all.

**Prohibits.**
- Raw `next/link`, `router.push` / `replace` / `back`, or a `window.location` navigation outside the helper; a direct `GuardedLink` / `useGuardedNavigation` call (the helper is its caller).
- A manually started overlay or a timeout standing in for the navigation's own pending.
- Releasing a control's pending before its post-action navigation has rendered.
- Sensitive free text in a query string or path the app builds (a narrative handed from one form to another through the URL).

**References.** RULE-STD-MEDIA-009; RULE-STD-FRONTEND-201; ttt-packages `docs/packages/upload-ui.md` (the guarded navigation entry points).

### RULE-STD-FRONTEND-206 — Pending, failed, and answered reads never stand in for one another
**Scope.** both

**Rule.** A read is pending, failed, or answered, and every hook and surface keeps the three apart — a hook's return value, a gate or affordance, and an infinite list's later pages included. Pending renders `<LOADING_STATE>` (the canonical pending state beside `<LOAD_ERROR_STATE>`) or the surface's own skeleton — never its empty state, a zero count, a default value, or placeholder text that reads as data. A failure renders through the read-state module (`<READ_STATE_MODULE>`, RULE-STD-FRONTEND-001; its seat is `<LOAD_ERROR_STATE>`, RULE-STD-FRONTEND-109) — never the empty state, an absence ("Not Found", "no access", "None"), or a pending state that can never end — and always offers Try again: the read's own retry (a query's `refetch`, a live listener's restart, a lookup's `refetch`), held on screen with its control pending while that retry runs. The failure and its retry come from the read's held retry state (query-core `useReadRetryState`, which a read hook hands out as `retryState` beside its `refetch`), never from TanStack's live flags, which clear a never-succeeded read's `error` the moment its retry starts. Only a render crash (the module's render-failure state) retries by reloading the page. A read that answered and then fails keeps its answer: the hook hands back the last answered data with the failure beside it, and the surface keeps that content — and every editor open in it, with its input — on screen with the failure inline; only a failure with nothing answered replaces the content. An answered absence — a missing document, or a rules denial that means the document is not there for this reader — is an answer, never a failure, and an answered empty result renders the canonical empty state. Anything decided from a read (a control, gate, or affordance: can-perform, is-member, has-applied, liked, account type) waits for the answer: an unknown read neither offers the action nor hides it as if it had answered, and a hook never hands its consumers a default they cannot tell from data. An infinite list keeps what it loaded: a failed later page or refresh leaves the loaded rows with an inline failure line that re-runs the read that failed (the read-state module's list mode or its list-failure line, which retry through its list retry); only a failure with nothing loaded replaces the list. No surface claims success ("Submitted", "Saved") before the backend has committed.

**Why.** A false empty state reads as the truth — an empty queue shown before the subscription answered, a "removed" label while a title resolved — and a false "Submitted" removes the only signal that nothing was sent (RULE-STD-ENG-009). A default that reads as an answer also drives controls: a failed roster read hides every member control and shows a zero count, and an unknown account type offers the wrong flows. A refetch failure that blanks answered content throws away what the user was reading and the input they were typing.

**Prohibits.**
- A `data ?? []` / destructure default (`data: rows = []`) rendered, or used to decide a control, before the query answered; an empty-state message gated only on an empty array.
- `?? false` / `=== 'value'` coercions that turn an unknown read into a negative answer; an error rendered as an absence.
- A hook that maps a failed, missing, or malformed read to `[]` / `0` / `false` / absent; an expected absence rendered as a load failure.
- A permanent pending or empty state on a failed read; cached data from an earlier session shown as confirmed while its live listener is still connecting.
- A later failure that replaces answered content or an open editor instead of showing inline beside it; a failed later page or refresh of an infinite list replacing the rows already on screen.
- A query surface with a loading branch and no error branch.
- A read failure with no Try again; a Try again whose failure vanishes into a loading state while it runs; a retry state built from `isError` / `error` / `isRefetching` with `isFetching`.
- A success toast or message before the action committed; a bespoke loading block instead of `<LOADING_STATE>`.

**References.** RULE-STD-ENG-009; RULE-STD-FRONTEND-001, RULE-STD-FRONTEND-109, RULE-STD-FRONTEND-201; ttt-packages `docs/packages/query-core.md`.

### RULE-STD-FRONTEND-207 — Unsaved input is never discarded silently
**Scope.** both

**Rule.** A surface holding input its user has not saved — an authoring dialog, a draft form, an admin configuration card — never loses that input without the user's say. Every path that would drop it — Cancel, Escape, an overlay click, a view switch, an in-app navigation, a full-page leave — either asks first (through `ConsequenceDialog`; a full-page leave through the one shared leave guard, never a per-editor handler — RULE-STD-MEDIA-009) or keeps the draft to restore. A refresh of the stored value never overwrites a field the user has changed. A surface with nothing unsaved closes and navigates without asking.

**Why.** Long-form input can hold hours of typing; a Cancel, a stray Escape, or a live-config snapshot that resets the form loses typed work for good, and the loss reads as the app's intent, so nobody reports it.

**Prohibits.**
- A close, cancel, Escape, overlay click, view switch, or navigation that discards dirty input with no confirmation and no kept draft.
- A reset effect keyed on a live document that overwrites fields the user has edited.
- A per-editor `beforeunload` handler; a discard prompt on a surface with nothing unsaved.

**References.** RULE-STD-FRONTEND-202 (the confirmation primitive), RULE-STD-FRONTEND-205 (navigation runs the guard first), RULE-STD-MEDIA-009 (the shared leave guard); ttt-packages `docs/packages/upload-ui.md`.
