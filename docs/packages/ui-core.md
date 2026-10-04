# @ttt-productions/ui-core

Generic UI primitive package.

## Owns

- shadcn-style primitives and shared UI helpers
- `cn`
- Generic app-agnostic components such as relative time, end-of-list indicator, scroll-to-top button, and chunk error recovery
- The list-pagination BUTTONS control and its page-state hooks (see below)
- Generic formatting helpers such as `formatLargeNumber`

## Boundary

Feature-specific app components stay in the consuming app. Keep main entry server-safe; React UI lives behind `./react`. `lucide-react` is an optional peer: the app supplies the one copy every package renders icons from. Its one internal runtime dependency is `input-format-core` (Tier 1): text formats and their check live there, never here, so the server can run the same check without installing React.

## Free-text inputs — `Input`, `Textarea`

Every free-text input carries its field's declaration (a `DeclaredInputFormat` from `input-format-core`'s `defineInputFormat`: format, min, max — an inline literal does not type-check), and its bounds come from nothing else (ENG-005). Durable contract:

- **Which inputs take a declaration.** `Textarea` always takes `inputFormat`. `Input` takes it when its `type` is omitted or `"text"`. An `Input` whose browser owns the format — `password`, `email`, `number`, `tel`, `url`, `search`, `file`, `color`, the date and time types, `range`, `checkbox`, `radio`, `hidden`, and the button types (`BuiltInFormatInputType`) — takes none, and the types refuse one.
- **Text boxes that are not free text.** A text box holding digits typed as text (a date-of-birth part, a share count, a one-time code) or an identifier (an account, document, or case id) is not free text and has no input format. It says so with `textEntry: "numeric" | "identifier"` (`NonFreeTextEntry`; `NonFreeTextInputProps`), takes no `inputFormat`, keeps its native `maxLength` / `pattern` / `inputMode` / `required`, and derives nothing; its value is judged by its own rule (a whole-input number parse, the one-segment id rule). `textEntry` never reaches the DOM.
- **No second bound.** A free-text input has no `maxLength`, `minLength`, `pattern`, or `required` prop; the types refuse them — the declaration's `min` is the one statement of whether the field is required.
- **Derived attributes.** `maxLength` is the declaration's `max`. `aria-required` is set when `min` is above 0. With a controlled `value`, `aria-invalid` is set when the value has characters its format refuses or runs past `max`; a value that is only too short (an empty or half-typed required field) is not marked, leaving that to the form's submit-time validation. A caller's own `aria-required` / `aria-invalid` wins — `FormControl` passes the state its whole schema decided.
- **The cap counts the text as typed; the check counts it trimmed.** Every value the field keeps can still be typed, and surrounding whitespace is dropped by the check, so the input and the server accept the same stored values.
- Types: `InputProps` (`FreeTextInputProps | NonFreeTextInputProps | BuiltInFormatInputProps`), `NonFreeTextEntry`, `BuiltInFormatInputType`, `TextareaProps`.

## SearchDropdown

A search box with a results dropdown (`./react` → `SearchDropdown<T>`). Its input is a built-in-format `type="search"` input. Durable contract:

- **Stays open through every settled state.** Once the value reaches `minChars`, the dropdown shows searching, the results, the `emptyMessage`, or a failure — whichever is current — until the user dismisses it with Escape, a click outside, or a selection.
- **A dismissal holds for its value.** Re-rendered props (a fresh `[]` every render included) never reopen it; typing, a new value, or ArrowDown does.
- **Escape is the dropdown's, never the search field's.** On an open dropdown it closes it; on a closed one holding a value it clears the value through the same path as the clear button, so `onClear` always runs. The field's native Escape-clear never fires.
- **Failures belong to the consumer.** `error` is the raw failure (`null` / `undefined` = none) and the required `renderError(error)` renders it inside the dropdown; the package has no failure copy or failure styling of its own.
- **Combobox semantics.** The input is a `combobox` (`aria-autocomplete="list"`, `aria-expanded` while the dropdown is open, `aria-controls` naming the listbox while results show and the open panel otherwise) and keeps focus throughout. Results are a `listbox` of `option`s named by the `label` (or the placeholder); ArrowDown / ArrowUp move the highlight, which is the input's `aria-activedescendant` and the option's `aria-selected`; hovering moves it too; Enter or a click selects. The highlight belongs to its query: a refreshed result list for the same value keeps it, a new value starts with none. One always-mounted, visually hidden polite `status` region announces the open panel's state — "Searching...", the `emptyMessage`, or the result count (`resultsAnnouncement(count)`, default "1 result" / "N results"); a failure is announced by the consumer's `renderError`. The below-minimum hint describes the input.
- **Per-instance ids.** The label, input, listbox, options, and hint take ids from `useId`, so several instances can share a page.

## Styling contract — theme tokens only

Every colour and shadow a ui-core component renders comes from a theme-core token (theme-core's `token-contract.test.ts` enforces it), so an app re-themes ui-core entirely from its token layer:

- **No raw colour.** No Tailwind palette utility (`bg-green-500`, `bg-white`, …) and no colour literal. Semantic utilities (`bg-card`, `border-input`) and `var()` reads map to theme-core tokens.
- **No shadow utility.** A Tailwind utility out-ranks every layered stylesheet, so shadows live on theme-core elevation hook classes the components carry, each reading a shadow token — the hook classes and what each covers are listed once, in [theme-core.md](theme-core.md#recipes-and-components-read-tokens-not-literals). `.page-card` and an app's own card rules therefore reach `<Card>`.
- **One form-control edge.** `Input`, `Textarea`, and `Select` draw their edge from `--input` (`border-input`), and the unchecked `Switch` track fills with it (`bg-input`), so one token styles every form control in a form.
- **Button edges follow their family.** `default` reads `--brand-primary-deep`, `destructive` reads `--destructive-border`, `success` reads `--status-success-border`, `inverted` reads the `--inverted-*` trio.
- **A status fill carries its own status text.** Every variant that paints a solid status fill takes its text from that status's own foreground, never another family's: the `destructive` Button and Badge read `--destructive-foreground`, the `success` Button reads `--success-foreground` on `--button-success`, and each Toast status variant reads its `--toast-<status>-foreground`. An app that tunes a status foreground per theme for contrast therefore fixes every surface on that fill at once. theme-core's token-contract test enforces the pairing across every package.

## In-progress feedback — `Spinner`, `pending`, `useAsyncAction`

Every in-progress indicator renders through ONE owner, so the spinner's look, size scale, and in-button color rule change in one place (FRONTEND-201). Durable contract:

- **`Spinner`** is the only place the `Loader2` icon is used (the `canonical-spinner` boundary guard enforces it). `size` (`xs`–`xl`) maps onto the theme-core `spinner-*` classes, which own size, animation, and color — including `button .spinner-*`, which makes an in-button spinner inherit the button's text color. `label` turns it into a `status` live region; omit it inside a control that already carries `aria-busy`.
- **Button `pending` + `icon`.** `pending` disables the button — so neither a repeat click nor an implicit form resubmit can fire — sets `aria-busy` and `data-pending`, and shows the spinner: an icon button (`size="icon"`) swaps its icon for it; any other button shows it in place of its leading `icon`. The leading slot is spaced by the button's built-in gap. With `asChild`, the leading slot renders inside the child element.
- **Control pending.** `Switch` (spinner in the thumb), `SelectTrigger` (spinner replaces the chevron), and `DropdownMenuItem` (`pending` + leading `icon`) follow the same contract. Switch and Select keep showing the COMMITTED value — the caller flips it only once the write lands. Keeping a menu open while its item is pending is the caller's `onSelect` (`event.preventDefault()`, close on settle). `DropdownMenuItem` supports `asChild` (e.g. a link item): the child element becomes the menu item, and the icon / spinner is slotted inside it, before its content.
- **`ConsequenceDialog`** renders its confirm with `pending`; it stays open while the promise `onConfirm` returns is pending and after it rejects. `onConfirm` stays typed `void | Promise<void>` — a caller that wants the pending state returns the promise.
- **`ConsequenceDialog` layout.** Each consequence slot (`immediateEffect` / `delayedEffect` / `reversibility`, labelled Immediately / Afterward / Reversibility) is a block row: the slot icon beside a column whose label sits on its own line directly above the slot text. The rows form the dialog's accessible description (the element its `aria-describedby` names), rendered as a `div` — never the primitive's default `<p>`, which cannot hold block rows, and never inline spans, on which theme-core's `stack-*` vertical spacing does nothing. The rows stay left-aligned at every width.
- **`ConsequenceDialog` reason and typed confirmation.** The optional `reason` carries the caller's field declaration (`inputFormat`) beside its value and `onChange`; its `Textarea` takes that declaration, and confirm stays disabled until the value passes `checkInputFormat` (`min: 0` makes the reason optional). The `typedConfirmation` input is a `singleLine` field capped at the phrase's length, and confirm waits for an exact match of the phrase.
- **`useAsyncAction(action, { onError })`** returns `{ run, pending }` for async work that is not a React Query mutation (a local media step, a sign-out, an awaited navigation). A repeat `run` while pending is ignored — the guard is a ref, so two clicks in one frame cannot both start — and `run` never rejects: errors go to the required `onError`. Server writes stay mutations.

## List pagination

`ListPagination` is the ONE Previous / counter / Next button row for paginated lists — both flavors, one component, so the layout, the disabled edges, the touch targets, and the live region cannot drift apart. Durable behavior contract:

- **The counter is the only difference between the flavors.** `pagination.totalPages` is the discriminant: a number renders `"2 of 5"`, an omitted value renders `"Page 2"`. Everything else is identical.
- **One visibility rule.** The row renders nothing when neither direction is available (`!canPreviousPage && !canNextPage`) — for a known total that is exactly `totalPages > 1`, and for a cursor feed it is `page > 1 || hasMore`. No call site repeats the guard.
- **Edges are real `disabled`.** Announced and unclickable, never a click that silently does nothing. `busy` disables BOTH controls while a page is in flight and deliberately does NOT hide the row, so the controls grey out in place instead of vanishing mid-fetch. The control that started the in-flight page shows the spinner (`pending`); a busy row with no click behind it (a refetch) spins neither.
- **Accessibility.** The counter is a `status` live region, so a page change is announced; both buttons keep a 44px touch target.
- **Generic + semantic only.** Semantic theme classes and tokens, `outline` button variant, no business identifiers, no page-size constants — the caller supplies its own page size.

Two page-state hooks produce the control's `pagination` prop, and a surface whose data hook already owns its page number can supply the same shape directly:

- `usePagedList(items, pageSize, { onPageChange })` — client-side slice pagination over an ALREADY-FETCHED list. Owns the page math, clamps onto the last real page when the list shrinks under the open page, and returns `pageItems` plus a known `totalPages`. Ordering and filtering stay with the caller.
- `useCursorPage({ onPageChange, resetKey })` — the page number for a server/cursor feed, returning `{ currentPage, reset, paginationFor }`. It takes no data.

Both hooks guard their step functions, so `onPageChange` fires only on a page change that actually happened.

## Return scroll — `useReturnScroll`

Restores a list's window scroll offset when the user comes back to it after a REAL route change (a
detail page with its own URL), which a same-page view swap never needs. One instance per list
surface, mounted at the list level — never inside a per-card hook. Contract:

- `useReturnScroll({ key, eligible, ready })` → `{ save }`. `key` is the caller's CANONICAL list
  URL (the caller owns canonicalization — equivalent list states must give the same key).
- `save()` records `window.scrollY` for `key` in `sessionStorage` — call it immediately before the
  navigation away actually happens (inside any guarded-navigation callback, so a cancelled leave
  never writes an entry).
- `eligible` is decided by the CALLER once at mount (typically: the list's data was already cached
  on first render). A not-eligible return discards the entry for that key permanently — a fetch that
  completes later can never restore against a shorter page.
- `ready` means the list is displayed at its real height (data present, no error surface). The
  restore fires once, the first time `ready` is true while eligible, in a `requestAnimationFrame`,
  with `behavior: 'instant'`; the entry is consumed. The frame is cancelled on unmount or key change,
  and React Strict Mode's double-invoke still scrolls exactly once.
- `clearReturnScroll(key)` drops an entry (e.g. the detail page removed an item from the list, so
  the saved offset is stale). Blocked or malformed storage is a silent no-op — no throw, no restore.

### `hasMore` binds late, and that is the contract

A cursor query takes the page number as its INPUT, so its `hasMore` does not exist until after that query has run. `hasMore` therefore binds at render time, through `paginationFor(hasMore)` — never as an argument to the hook that produces the page number, which would be circular and unsatisfiable at every real call site:

```tsx
const pager = useCursorPage({ resetKey: tag });
const { data, isFetching } = useThingsByTag(tag, pager.currentPage);
…
<ListPagination pagination={pager.paginationFor(data?.hasMore ?? false)} busy={isFetching} />
```

Durable behavior contract:

- **The guards are in the hook, not the button.** `paginationFor(hasMore)` closes over that render's `hasMore`, so a next-step that cannot move changes nothing and does not fire `onPageChange` — even from an undisabled trigger.
- **Two ways to return to page 1, one page-state owner.** Use `reset()` when your own event handler already owns the input change (a select's `onValueChange`); use the `resetKey` option when the change arrives as a prop and there is no handler of yours to hang it on. `resetKey` returns to page 1 in the SAME render, so the query is never asked for a page of the new inputs the user never navigated to, and it retires the old page rather than reviving it if the earlier inputs come back. `reset()` is a no-op on page 1, so it never fires `onPageChange` for nothing.
- **`resetKey` is a primitive** (`string | number | boolean | null`) — deliberately narrowed so a fresh object literal cannot pin a list to page 1 forever. Compose several inputs into one signature string.
- **Referential stability.** `reset` and `paginationFor` are memoized on the page state, so a consumer may hold them in a dep array; they change when the page actually changes.

## DatePicker

Generic calendar (`./react` → `DatePicker`). Durable behavior contract — designed to live inside a Radix popover without the popover jumping sides:

- **Stable footprint.** The six-row day grid is always rendered; the month and year choosers render as an overlay on top of it, so the outer width and content height never change between the days/months/years views. A collision-aware popover must not flip merely because the internal view changed.
- **Month and year are independent pickers.** Choosing a month keeps the current year and returns to the day grid; choosing a year keeps the current month and returns **directly** to the day grid (it never drills into the month grid). Only choosing a **day** calls `onSelect` — month/year choices just change the visible calendar.
- **Range awareness.** `disablePast` / `disableFuture` / the `disabled(date)` predicate disable individual days (real `disabled` attribute, unavailable to pointer and keyboard) and also disable the header prev/next control when the whole target month / year / year-page is out of range.
- **Controlled resync.** The visible month/year and roving focus follow the controlled `selected` prop when it changes.
- **Accessibility.** Stable header trigger labels ("Choose month, currently August"), full-date day labels ("August 15, 1990"), selected day via `aria-pressed`, today via `aria-current="date"`; one polite live region announces the displayed month/year; roving day focus (single tab stop) with Arrow / Home-End / PageUp-PageDown / Enter-Space; focus moves to a deliberate stable target after each view transition (header trigger or the active grid cell), never `document.body`.
- **Generic + semantic only.** Semantic theme tokens (`primary`/`primary-foreground`/`accent`/`border`/`muted-foreground`/…), transform/opacity-only motion with a `motion-safe:` reduced-motion fallback, no business identifiers. The public prop contract (`selected`, `onSelect`, `disabled`, `disablePast`, `disableFuture`, `className`) is additive-only.

## DateTimePicker

Generic date-and-time picker (`./react` → `DateTimePicker`): `DatePicker` for the day beside hour / minute / AM-PM columns of buttons for the time of day — never a native date or time input. Durable behavior contract:

- **Controlled instant.** `value` is the chosen local instant; `onChange` receives the new one, always inside `min` / `max`, with seconds and milliseconds zero. The time of day is in the viewer's own time zone.
- **Range to the minute.** `min` / `max` bound the selectable instants. A day with no allowed instant is disabled in the calendar; on the chosen day, an hour, minute, or AM/PM choice that would land outside the range is disabled — the picker never offers a value the caller's rule refuses.
- **Picking keeps the time.** A picked day keeps the chosen time of day (or `defaultTime` — 23:59, end of day — when there is no value yet) and moves it to the nearest allowed time on that day; an hour or AM/PM whose current minute is unavailable takes the nearest allowed minute.
- **`minuteStep`** (default 1) limits the minutes offered to its multiples.
- **Accessibility.** Each time column is a labelled group and one tab stop with roving focus (ArrowUp / ArrowDown, Home / End); every option is a real button with `aria-pressed` and its own name ("9 o'clock", "45 minutes", "PM"). The columns are fixed-height and keep the chosen option scrolled into view.
- **Generic + semantic only.** Semantic theme tokens, no business identifiers, no defaults beyond end of day — the caller supplies its own range and starting value.
