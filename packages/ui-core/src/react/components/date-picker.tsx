"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "./button.js"
import { cn } from "../../lib/utils.js"

export interface DatePickerProps {
  selected?: Date
  onSelect?: (date: Date | undefined) => void
  disabled?: (date: Date) => boolean
  disablePast?: boolean
  disableFuture?: boolean
  className?: string
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
]

const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]
const DAY_NAMES_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

const YEARS_PER_PAGE = 12
/** Six rows × seven columns — a calendar month never spans more, and always
 *  filling six rows keeps the day grid (and therefore the whole popover
 *  footprint) the same height for every month. */
const CALENDAR_CELLS = 42

type View = "days" | "months" | "years"
type PendingFocus = "day" | "monthTrigger" | "yearTrigger" | "monthGrid" | "yearGrid"

const startOfDay = (d: Date) => {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  return x
}
const monthStart = (year: number, month: number) => new Date(year, month, 1)
const addMonths = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, 1)
const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate()
const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
const isSameMonth = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()
const fullDateLabel = (date: Date) => `${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`

/**
 * Generic date-of-birth-friendly calendar.
 *
 * Stable footprint: the six-row day grid is always rendered, so the outer width
 * and content height never change; the month and year choosers render as an
 * overlay ON TOP of that grid rather than replacing it, so a Radix popover never
 * flips sides just because the internal view changed.
 *
 * Month and year are INDEPENDENT pickers: choosing a month keeps the current
 * year and returns to the day grid; choosing a year keeps the current month and
 * returns DIRECTLY to the day grid (it never opens the month grid). Only
 * choosing a day calls `onSelect` (which commits and, in a popover, closes).
 *
 * Keyboard: roving day focus with Arrow (±1 day / ±7 days), Home/End (within the
 * week), PageUp/PageDown (±1 month), and Enter/Space to select — no extra
 * dependency. Exactly one day sits in the tab order at a time.
 */
function DatePicker({
  selected,
  onSelect,
  disabled,
  disablePast = false,
  disableFuture = false,
  className,
}: DatePickerProps) {
  const today = React.useMemo(() => startOfDay(new Date()), [])

  const [viewDate, setViewDate] = React.useState(() =>
    monthStart((selected ?? today).getFullYear(), (selected ?? today).getMonth()),
  )
  const [view, setView] = React.useState<View>("days")
  const [yearPageStart, setYearPageStart] = React.useState(
    () => Math.floor((selected ?? today).getFullYear() / YEARS_PER_PAGE) * YEARS_PER_PAGE,
  )
  const [focusedDate, setFocusedDate] = React.useState(() => startOfDay(selected ?? today))

  const monthTriggerRef = React.useRef<HTMLButtonElement | null>(null)
  const yearTriggerRef = React.useRef<HTMLButtonElement | null>(null)
  const daysGridRef = React.useRef<HTMLDivElement | null>(null)
  const overlayRef = React.useRef<HTMLDivElement | null>(null)
  const pendingFocusRef = React.useRef<PendingFocus | null>(null)

  const isDateDisabled = (date: Date) => {
    const checkDate = startOfDay(date)
    if (disablePast && checkDate < today) return true
    if (disableFuture && checkDate > today) return true
    if (disabled && disabled(checkDate)) return true
    return false
  }

  /** A whole month is unpickable only when every day in it is out of range. */
  const isMonthDisabled = (year: number, month: number) => {
    if (disableFuture && new Date(year, month, 1) > today) return true
    if (disablePast && new Date(year, month + 1, 0) < today) return true
    return false
  }

  const isYearDisabled = (year: number) => {
    if (disableFuture && year > today.getFullYear()) return true
    if (disablePast && year < today.getFullYear()) return true
    return false
  }

  const rangeAllYearsDisabled = (from: number, to: number) => {
    for (let y = from; y <= to; y++) if (!isYearDisabled(y)) return false
    return true
  }

  const isSelectedDay = (date: Date) => (selected ? isSameDay(startOfDay(selected), startOfDay(date)) : false)
  const isTodayDate = (date: Date) => isSameDay(startOfDay(date), today)

  /** The best in-month day to seed roving focus: the selected day, then today,
   *  then the first available day, then the 1st. */
  const pickInMonthFocus = (vd: Date): Date => {
    const year = vd.getFullYear()
    const month = vd.getMonth()
    if (selected) {
      const s = startOfDay(selected)
      if (isSameMonth(s, vd) && !isDateDisabled(s)) return s
    }
    if (isSameMonth(today, vd) && !isDateDisabled(today)) return new Date(today)
    const dim = daysInMonth(year, month)
    for (let d = 1; d <= dim; d++) {
      const cand = new Date(year, month, d)
      if (!isDateDisabled(cand)) return cand
    }
    return new Date(year, month, 1)
  }

  // Resynchronize the visible month/year (and roving focus) when the controlled
  // `selected` prop changes — e.g. the consumer's typed MM/DD/YYYY fields.
  const selectedTime = selected ? startOfDay(selected).getTime() : undefined
  React.useEffect(() => {
    if (selectedTime === undefined) return
    const d = new Date(selectedTime)
    setViewDate(monthStart(d.getFullYear(), d.getMonth()))
    setFocusedDate(startOfDay(d))
  }, [selectedTime])

  // Deliberate focus after every view transition — never left on document.body.
  React.useLayoutEffect(() => {
    const target = pendingFocusRef.current
    if (!target) return
    pendingFocusRef.current = null
    if (target === "monthTrigger") {
      monthTriggerRef.current?.focus()
    } else if (target === "yearTrigger") {
      yearTriggerRef.current?.focus()
    } else if (target === "day") {
      daysGridRef.current?.querySelector<HTMLButtonElement>('[data-roving="true"]')?.focus()
    } else if (target === "monthGrid" || target === "yearGrid") {
      const active = overlayRef.current?.querySelector<HTMLButtonElement>('[data-active="true"]:not([disabled])')
      const fallback = overlayRef.current?.querySelector<HTMLButtonElement>("button:not([disabled])")
      ;(active ?? fallback)?.focus()
    }
  })

  const generateCalendarDays = (): (Date | null)[] => {
    const year = viewDate.getFullYear()
    const month = viewDate.getMonth()
    const dim = daysInMonth(year, month)
    const firstDay = new Date(year, month, 1).getDay()
    const days: (Date | null)[] = []
    for (let i = 0; i < firstDay; i++) days.push(null)
    for (let day = 1; day <= dim; day++) days.push(new Date(year, month, day))
    while (days.length < CALENDAR_CELLS) days.push(null)
    return days
  }

  const inViewMonth = isSameMonth(focusedDate, viewDate)
  const rovingDate = inViewMonth ? focusedDate : pickInMonthFocus(viewDate)

  const commitDay = (date: Date) => {
    if (isDateDisabled(date)) return
    onSelect?.(date)
  }

  const moveFocusTo = (date: Date) => {
    const d = startOfDay(date)
    setFocusedDate(d)
    if (!isSameMonth(d, viewDate)) setViewDate(monthStart(d.getFullYear(), d.getMonth()))
    pendingFocusRef.current = "day"
  }

  /** From `origin`, walk `step` days at a time until an available day is found
   *  (inclusive of `origin`). Returns null if none within `maxSteps`. */
  const firstAvailableFrom = (origin: Date, step: number, maxSteps: number): Date | null => {
    let d = startOfDay(origin)
    for (let i = 0; i < maxSteps; i++) {
      if (!isDateDisabled(d)) return d
      d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + step)
    }
    return null
  }

  const handleDaysKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const base = rovingDate
    let candidate: Date
    let probeStep: number

    switch (e.key) {
      case "ArrowLeft":
        candidate = new Date(base.getFullYear(), base.getMonth(), base.getDate() - 1)
        probeStep = -1
        break
      case "ArrowRight":
        candidate = new Date(base.getFullYear(), base.getMonth(), base.getDate() + 1)
        probeStep = 1
        break
      case "ArrowUp":
        candidate = new Date(base.getFullYear(), base.getMonth(), base.getDate() - 7)
        probeStep = -1
        break
      case "ArrowDown":
        candidate = new Date(base.getFullYear(), base.getMonth(), base.getDate() + 7)
        probeStep = 1
        break
      case "Home":
        candidate = new Date(base.getFullYear(), base.getMonth(), base.getDate() - base.getDay())
        probeStep = 1
        break
      case "End":
        candidate = new Date(base.getFullYear(), base.getMonth(), base.getDate() + (6 - base.getDay()))
        probeStep = -1
        break
      case "PageUp": {
        const prev = addMonths(base, -1)
        candidate = new Date(
          prev.getFullYear(),
          prev.getMonth(),
          Math.min(base.getDate(), daysInMonth(prev.getFullYear(), prev.getMonth())),
        )
        probeStep = 1
        break
      }
      case "PageDown": {
        const next = addMonths(base, 1)
        candidate = new Date(
          next.getFullYear(),
          next.getMonth(),
          Math.min(base.getDate(), daysInMonth(next.getFullYear(), next.getMonth())),
        )
        probeStep = 1
        break
      }
      case "Enter":
      case " ":
        e.preventDefault()
        commitDay(base)
        return
      default:
        return
    }

    e.preventDefault()
    let target = firstAvailableFrom(candidate, probeStep, 62)
    if (!target && probeStep !== -1) target = firstAvailableFrom(candidate, -1, 62)
    if (target) moveFocusTo(target)
  }

  // Header prev/next adapt to the active view; disabled when the whole target
  // range is unavailable so navigation never lands on a dead page.
  const prevMonthDate = addMonths(viewDate, -1)
  const nextMonthDate = addMonths(viewDate, 1)

  let prevDisabled: boolean
  let nextDisabled: boolean
  let prevLabel: string
  let nextLabel: string

  if (view === "days") {
    prevDisabled = isMonthDisabled(prevMonthDate.getFullYear(), prevMonthDate.getMonth())
    nextDisabled = isMonthDisabled(nextMonthDate.getFullYear(), nextMonthDate.getMonth())
    prevLabel = "Previous month"
    nextLabel = "Next month"
  } else if (view === "months") {
    prevDisabled = isYearDisabled(viewDate.getFullYear() - 1)
    nextDisabled = isYearDisabled(viewDate.getFullYear() + 1)
    prevLabel = "Previous year"
    nextLabel = "Next year"
  } else {
    prevDisabled = rangeAllYearsDisabled(yearPageStart - YEARS_PER_PAGE, yearPageStart - 1)
    nextDisabled = rangeAllYearsDisabled(yearPageStart + YEARS_PER_PAGE, yearPageStart + YEARS_PER_PAGE * 2 - 1)
    prevLabel = `Previous ${YEARS_PER_PAGE} years`
    nextLabel = `Next ${YEARS_PER_PAGE} years`
  }

  const handlePrev = () => {
    if (view === "days") setViewDate(prevMonthDate)
    else if (view === "months") setViewDate(monthStart(viewDate.getFullYear() - 1, viewDate.getMonth()))
    else setYearPageStart((s) => s - YEARS_PER_PAGE)
  }
  const handleNext = () => {
    if (view === "days") setViewDate(nextMonthDate)
    else if (view === "months") setViewDate(monthStart(viewDate.getFullYear() + 1, viewDate.getMonth()))
    else setYearPageStart((s) => s + YEARS_PER_PAGE)
  }

  const openMonths = () => {
    if (view === "months") {
      setView("days")
      pendingFocusRef.current = "monthTrigger"
    } else {
      setView("months")
      pendingFocusRef.current = "monthGrid"
    }
  }
  const openYears = () => {
    if (view === "years") {
      setView("days")
      pendingFocusRef.current = "yearTrigger"
    } else {
      setYearPageStart(Math.floor(viewDate.getFullYear() / YEARS_PER_PAGE) * YEARS_PER_PAGE)
      setView("years")
      pendingFocusRef.current = "yearGrid"
    }
  }

  // Month selection: keep the year, return to days, focus the Month trigger.
  const handleMonthPick = (month: number) => {
    setViewDate(monthStart(viewDate.getFullYear(), month))
    setView("days")
    pendingFocusRef.current = "monthTrigger"
  }
  // Year selection: keep the month, return to days (never months), focus Year.
  const handleYearPick = (year: number) => {
    setViewDate(monthStart(year, viewDate.getMonth()))
    setView("days")
    pendingFocusRef.current = "yearTrigger"
  }

  const calendarDays = generateCalendarDays()
  const yearPage = Array.from({ length: YEARS_PER_PAGE }, (_, i) => yearPageStart + i)
  const overlayActive = view !== "days"

  const triggerClass =
    "min-h-[1.5rem] px-1 text-base font-bold text-foreground underline decoration-1 underline-offset-4 decoration-border rounded-sm " +
    "hover:opacity-80 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"

  const gridCellClass =
    "h-10 rounded-lg text-sm font-semibold transition-transform flex items-center justify-center " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"

  return (
    <div className={cn("p-4 bg-card rounded-lg", className)}>
      {/* Header — same footprint in every view. */}
      <div className="flex items-center justify-between mb-4">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 p-0"
          aria-label={prevLabel}
          disabled={prevDisabled}
          onClick={handlePrev}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </Button>

        <div className="flex items-center gap-1.5">
          <button
            ref={monthTriggerRef}
            type="button"
            onClick={openMonths}
            aria-expanded={view === "months"}
            aria-label={`Choose month, currently ${MONTHS[viewDate.getMonth()]}`}
            className={triggerClass}
          >
            {MONTHS[viewDate.getMonth()]}
          </button>
          <button
            ref={yearTriggerRef}
            type="button"
            onClick={openYears}
            aria-expanded={view === "years"}
            aria-label={`Choose year, currently ${viewDate.getFullYear()}`}
            className={triggerClass}
          >
            {viewDate.getFullYear()}
          </button>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 p-0"
          aria-label={nextLabel}
          disabled={nextDisabled}
          onClick={handleNext}
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>

      {/* One polite live region for the displayed month/year. */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {MONTHS[viewDate.getMonth()]} {viewDate.getFullYear()}
      </div>

      <div className="relative">
        {/* Day grid — ALWAYS rendered so width and height stay stable; inert
            while a chooser overlay covers it. */}
        <div aria-hidden={overlayActive ? true : undefined}>
          <div className="grid grid-cols-7 gap-1 mb-2">
            {DAYS.map((day, i) => (
              <div key={day} className="text-center text-sm font-bold py-2 text-foreground" aria-hidden="true">
                <span className="sr-only">{DAY_NAMES_LONG[i]}</span>
                <span aria-hidden="true">{day}</span>
              </div>
            ))}
          </div>

          <div
            ref={daysGridRef}
            className="grid grid-cols-7 gap-1"
            role="group"
            aria-label="Calendar"
            onKeyDown={overlayActive ? undefined : handleDaysKeyDown}
          >
            {calendarDays.map((date, index) => {
              if (!date) return <div key={`empty-${index}`} className="h-9" aria-hidden="true" />

              const dateDisabled = isDateDisabled(date)
              const dateSelected = isSelectedDay(date)
              const todayDate = isTodayDate(date)
              const roving = isSameDay(date, rovingDate)
              const tabIndex = !overlayActive && roving ? 0 : -1

              return (
                <button
                  key={date.toISOString()}
                  type="button"
                  onClick={() => commitDay(date)}
                  disabled={dateDisabled}
                  tabIndex={tabIndex}
                  data-roving={roving ? "true" : undefined}
                  aria-label={fullDateLabel(date)}
                  aria-pressed={dateSelected}
                  aria-current={todayDate ? "date" : undefined}
                  className={cn(
                    "h-9 w-9 rounded-lg text-sm font-semibold transition-transform",
                    "motion-safe:hover:scale-105 motion-safe:active:scale-95",
                    "flex items-center justify-center",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    !dateDisabled && !dateSelected && !todayDate && "text-foreground hover:bg-primary/10",
                    todayDate && !dateSelected && "bg-accent text-accent-foreground font-bold ring-2 ring-border",
                    dateSelected && "bg-primary text-primary-foreground font-bold",
                    dateDisabled && "opacity-30 cursor-not-allowed motion-safe:hover:scale-100 hover:bg-transparent relative",
                  )}
                >
                  {date.getDate()}
                  {dateDisabled && (
                    <span className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
                      <span className="w-px h-full bg-current transform rotate-45" />
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          <div className="mt-4 pt-3 border-t border-border text-xs space-y-1">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-sm bg-primary" aria-hidden="true" />
              <span className="text-muted-foreground">Selected</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-sm bg-accent ring-2 ring-border" aria-hidden="true" />
              <span className="text-muted-foreground">Today</span>
            </div>
            {(disablePast || disableFuture || disabled) && (
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-sm bg-muted opacity-30 relative" aria-hidden="true">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-px h-full bg-foreground transform rotate-45" />
                  </div>
                </div>
                <span className="text-muted-foreground">Unavailable</span>
              </div>
            )}
          </div>
        </div>

        {/* Month / year choosers overlay the day grid — same footprint. */}
        {overlayActive && (
          <div ref={overlayRef} className="absolute inset-0 bg-card rounded-lg flex flex-col justify-center">
            {view === "years" && (
              <div className="mb-2 text-center text-sm font-semibold text-muted-foreground" aria-hidden="true">
                {yearPageStart} – {yearPageStart + YEARS_PER_PAGE - 1}
              </div>
            )}

            {view === "months" && (
              <div className="grid grid-cols-3 gap-1">
                {MONTHS_SHORT.map((label, month) => {
                  const monthDisabled = isMonthDisabled(viewDate.getFullYear(), month)
                  const isViewMonth = month === viewDate.getMonth()
                  return (
                    <button
                      key={label}
                      type="button"
                      disabled={monthDisabled}
                      data-active={isViewMonth ? "true" : undefined}
                      aria-pressed={isViewMonth}
                      aria-label={`${MONTHS[month]} ${viewDate.getFullYear()}`}
                      onClick={() => handleMonthPick(month)}
                      className={cn(
                        gridCellClass,
                        !monthDisabled && !isViewMonth && "text-foreground hover:bg-primary/10",
                        isViewMonth && "bg-primary text-primary-foreground font-bold",
                        monthDisabled && "opacity-30 cursor-not-allowed",
                      )}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            )}

            {view === "years" && (
              <div className="grid grid-cols-3 gap-1">
                {yearPage.map((year) => {
                  const yearDisabled = isYearDisabled(year)
                  const isViewYear = year === viewDate.getFullYear()
                  return (
                    <button
                      key={year}
                      type="button"
                      disabled={yearDisabled}
                      data-active={isViewYear ? "true" : undefined}
                      aria-pressed={isViewYear}
                      aria-label={`Year ${year}`}
                      onClick={() => handleYearPick(year)}
                      className={cn(
                        gridCellClass,
                        !yearDisabled && !isViewYear && "text-foreground hover:bg-primary/10",
                        isViewYear && "bg-primary text-primary-foreground font-bold",
                        yearDisabled && "opacity-30 cursor-not-allowed",
                      )}
                    >
                      {year}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

DatePicker.displayName = "DatePicker"

export { DatePicker }
