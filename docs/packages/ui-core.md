# @ttt-productions/ui-core

Generic UI primitive package.

## Owns

- shadcn-style primitives and shared UI helpers
- `cn`
- Generic app-agnostic components such as relative time, end-of-list indicator, scroll-to-top button, and chunk error recovery
- Generic formatting helpers such as `formatLargeNumber`

## Boundary

Feature-specific app components stay in the consuming app. Keep main entry server-safe; React UI lives behind `./react`.

## DatePicker

Generic calendar (`./react` → `DatePicker`). Durable behavior contract — designed to live inside a Radix popover without the popover jumping sides:

- **Stable footprint.** The six-row day grid is always rendered; the month and year choosers render as an overlay on top of it, so the outer width and content height never change between the days/months/years views. A collision-aware popover must not flip merely because the internal view changed.
- **Month and year are independent pickers.** Choosing a month keeps the current year and returns to the day grid; choosing a year keeps the current month and returns **directly** to the day grid (it never drills into the month grid). Only choosing a **day** calls `onSelect` — month/year choices just change the visible calendar.
- **Range awareness.** `disablePast` / `disableFuture` / the `disabled(date)` predicate disable individual days (real `disabled` attribute, unavailable to pointer and keyboard) and also disable the header prev/next control when the whole target month / year / year-page is out of range.
- **Controlled resync.** The visible month/year and roving focus follow the controlled `selected` prop when it changes.
- **Accessibility.** Stable header trigger labels ("Choose month, currently August"), full-date day labels ("August 15, 1990"), selected day via `aria-pressed`, today via `aria-current="date"`; one polite live region announces the displayed month/year; roving day focus (single tab stop) with Arrow / Home-End / PageUp-PageDown / Enter-Space; focus moves to a deliberate stable target after each view transition (header trigger or the active grid cell), never `document.body`.
- **Generic + semantic only.** Semantic theme tokens (`primary`/`primary-foreground`/`accent`/`border`/`muted-foreground`/…), transform/opacity-only motion with a `motion-safe:` reduced-motion fallback, no business identifiers. The public prop contract (`selected`, `onSelect`, `disabled`, `disablePast`, `disableFuture`, `className`) is additive-only.
