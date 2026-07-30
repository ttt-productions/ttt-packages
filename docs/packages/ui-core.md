# @ttt-productions/ui-core

Generic UI primitive package.

## Owns

- shadcn-style primitives and shared UI helpers
- `cn`
- Generic app-agnostic components such as relative time, end-of-list indicator, scroll-to-top button, and chunk error recovery
- The list-pagination BUTTONS control and its page-state hooks (see below)
- Generic formatting helpers such as `formatLargeNumber`

## Boundary

Feature-specific app components stay in the consuming app. Keep main entry server-safe; React UI lives behind `./react`.

## List pagination

`ListPagination` is the ONE Previous / counter / Next button row for paginated lists — both flavors, one component, so the layout, the disabled edges, the touch targets, and the live region cannot drift apart. Durable behavior contract:

- **The counter is the only difference between the flavors.** `pagination.totalPages` is the discriminant: a number renders `"2 of 5"`, an omitted value renders `"Page 2"`. Everything else is identical.
- **One visibility rule.** The row renders nothing when neither direction is available (`!canPreviousPage && !canNextPage`) — for a known total that is exactly `totalPages > 1`, and for a cursor feed it is `page > 1 || hasMore`. No call site repeats the guard.
- **Edges are real `disabled`.** Announced and unclickable, never a click that silently does nothing. `busy` disables BOTH controls while a page is in flight and deliberately does NOT hide the row, so the controls grey out in place instead of vanishing mid-fetch.
- **Accessibility.** The counter is a `status` live region, so a page change is announced; both buttons keep a 44px touch target.
- **Generic + semantic only.** Semantic theme classes and tokens, `outline` button variant, no business identifiers, no page-size constants — the caller supplies its own page size.

Two page-state hooks produce the control's `pagination` prop, and a surface whose data hook already owns its page number can supply the same shape directly:

- `usePagedList(items, pageSize, { onPageChange })` — client-side slice pagination over an ALREADY-FETCHED list. Owns the page math, clamps onto the last real page when the list shrinks under the open page, and returns `pageItems` plus a known `totalPages`. Ordering and filtering stay with the caller.
- `useCursorPage({ onPageChange, resetKey })` — the page number for a server/cursor feed, returning `{ currentPage, reset, paginationFor }`. It takes no data.

Both hooks guard their step functions, so `onPageChange` fires only on a page change that actually happened.

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
