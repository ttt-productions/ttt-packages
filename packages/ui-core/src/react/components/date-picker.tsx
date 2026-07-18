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

const YEARS_PER_PAGE = 12

/** Calendar with fast month/year navigation: the header's month and year are
 *  each buttons — month opens a 12-month grid, year opens a paged 12-year
 *  grid (no single-step year arrows; distant years are a couple of clicks).
 *  Picking a year drills to the month grid, then the day grid — the natural
 *  date-of-birth path — while picking just a month returns straight to days. */
function DatePicker({
  selected,
  onSelect,
  disabled,
  disablePast = false,
  disableFuture = false,
  className,
}: DatePickerProps) {
  const [viewDate, setViewDate] = React.useState(() => selected || new Date())
  const [view, setView] = React.useState<"days" | "months" | "years">("days")
  const [yearPageStart, setYearPageStart] = React.useState(
    () => Math.floor((selected || new Date()).getFullYear() / YEARS_PER_PAGE) * YEARS_PER_PAGE,
  )

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    return new Date(year, month + 1, 0).getDate()
  }

  const getFirstDayOfMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    return new Date(year, month, 1).getDay()
  }

  const isDateDisabled = (date: Date) => {
    const checkDate = new Date(date)
    checkDate.setHours(0, 0, 0, 0)

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

  const isDateSelected = (date: Date) => {
    if (!selected) return false
    const selectedDate = new Date(selected)
    selectedDate.setHours(0, 0, 0, 0)
    const checkDate = new Date(date)
    checkDate.setHours(0, 0, 0, 0)
    return selectedDate.getTime() === checkDate.getTime()
  }

  const isToday = (date: Date) => {
    const checkDate = new Date(date)
    checkDate.setHours(0, 0, 0, 0)
    return checkDate.getTime() === today.getTime()
  }

  const generateCalendarDays = () => {
    const year = viewDate.getFullYear()
    const month = viewDate.getMonth()
    const daysInMonth = getDaysInMonth(viewDate)
    const firstDay = getFirstDayOfMonth(viewDate)

    const days: (Date | null)[] = []

    for (let i = 0; i < firstDay; i++) days.push(null)
    for (let day = 1; day <= daysInMonth; day++) days.push(new Date(year, month, day))

    return days
  }

  const previousMonth = () => setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1))
  const nextMonth = () => setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1))

  const handleDateClick = (date: Date) => {
    if (isDateDisabled(date)) return
    onSelect?.(date)
  }

  const openYears = () => {
    setYearPageStart(Math.floor(viewDate.getFullYear() / YEARS_PER_PAGE) * YEARS_PER_PAGE)
    setView("years")
  }

  const calendarDays = generateCalendarDays()
  const yearPage = Array.from({ length: YEARS_PER_PAGE }, (_, i) => yearPageStart + i)

  return (
    <div className={cn("p-4 bg-card rounded-lg", className)}>
      <div className="flex items-center justify-between mb-4">
        <Button
          variant="default"
          size="sm"
          className={cn("h-8 w-8 p-0", view !== "days" && "invisible")}
          aria-label="Previous month"
          onClick={previousMonth}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {/* Month and year are EACH pickers: month → 12-month grid; year →
            paged 12-year grid. No single-step year arrows. */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setView(view === "months" ? "days" : "months")}
            aria-expanded={view === "months"}
            className="text-base font-bold hover:opacity-80 transition-opacity text-foreground underline decoration-1 underline-offset-4 decoration-border"
          >
            {MONTHS[viewDate.getMonth()]}
          </button>
          <button
            type="button"
            onClick={() => (view === "years" ? setView("days") : openYears())}
            aria-expanded={view === "years"}
            className="text-base font-bold hover:opacity-80 transition-opacity text-foreground underline decoration-1 underline-offset-4 decoration-border"
          >
            {viewDate.getFullYear()}
          </button>
        </div>

        <Button
          variant="default"
          size="sm"
          className={cn("h-8 w-8 p-0", view !== "days" && "invisible")}
          aria-label="Next month"
          onClick={nextMonth}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {view === "years" && (
        <>
          <div className="flex items-center justify-between mb-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              aria-label={`Previous ${YEARS_PER_PAGE} years`}
              onClick={() => setYearPageStart((s) => s - YEARS_PER_PAGE)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-semibold text-muted-foreground">
              {yearPageStart} – {yearPageStart + YEARS_PER_PAGE - 1}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              aria-label={`Next ${YEARS_PER_PAGE} years`}
              onClick={() => setYearPageStart((s) => s + YEARS_PER_PAGE)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-1">
            {yearPage.map((year) => {
              const yearDisabled = isYearDisabled(year)
              const isViewYear = year === viewDate.getFullYear()
              return (
                <button
                  key={year}
                  type="button"
                  disabled={yearDisabled}
                  onClick={() => {
                    setViewDate((prev) => new Date(year, prev.getMonth()))
                    setView("months")
                  }}
                  className={cn(
                    "h-10 rounded-lg text-sm font-semibold transition-all",
                    "flex items-center justify-center",
                    !yearDisabled && !isViewYear && "text-foreground hover:bg-primary/10",
                    isViewYear && "bg-primary text-white font-bold shadow-lg",
                    yearDisabled && "opacity-30 cursor-not-allowed",
                  )}
                >
                  {year}
                </button>
              )
            })}
          </div>
        </>
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
                onClick={() => {
                  setViewDate((prev) => new Date(prev.getFullYear(), month))
                  setView("days")
                }}
                className={cn(
                  "h-10 rounded-lg text-sm font-semibold transition-all",
                  "flex items-center justify-center",
                  !monthDisabled && !isViewMonth && "text-foreground hover:bg-primary/10",
                  isViewMonth && "bg-primary text-white font-bold shadow-lg",
                  monthDisabled && "opacity-30 cursor-not-allowed",
                )}
              >
                {label}
              </button>
            )
          })}
        </div>
      )}

      {view === "days" && (
        <>
          <div className="grid grid-cols-7 gap-1 mb-2">
            {DAYS.map((day) => (
              <div
                key={day}
                className="text-center text-sm font-bold py-2 text-foreground"
              >
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((date, index) => {
              if (!date) return <div key={`empty-${index}`} className="h-9" />

              const dateDisabled = isDateDisabled(date)
              const dateSelected = isDateSelected(date)
              const todayDate = isToday(date)

              return (
                <button
                  key={date.toISOString()}
                  type="button"
                  onClick={() => handleDateClick(date)}
                  disabled={dateDisabled}
                  className={cn(
                    "h-9 w-9 rounded-lg text-sm font-semibold transition-all",
                    "hover:scale-105 active:scale-95",
                    "flex items-center justify-center",
                    !dateDisabled && !dateSelected && !todayDate && "text-foreground hover:bg-primary/10",
                    todayDate && !dateSelected && "bg-accent text-foreground font-bold ring-2 ring-border",
                    dateSelected && "bg-primary text-white font-bold shadow-lg",
                    dateDisabled && "opacity-30 cursor-not-allowed hover:scale-100 hover:bg-transparent",
                    dateDisabled && "relative"
                  )}
                >
                  {date.getDate()}
                  {dateDisabled && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-px h-full bg-current transform rotate-45" />
                    </div>
                  )}
                </button>
              )
            })}
          </div>

          <div className="mt-4 pt-3 border-t border-border text-xs space-y-1">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-sm bg-primary" />
              <span className="text-muted-foreground">Selected</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-sm bg-accent ring-2 ring-border" />
              <span className="text-muted-foreground">Today</span>
            </div>
            {(disablePast || disableFuture || disabled) && (
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-sm bg-muted opacity-30 relative">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-px h-full bg-foreground transform rotate-45" />
                  </div>
                </div>
                <span className="text-muted-foreground">Unavailable</span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

DatePicker.displayName = "DatePicker"

export { DatePicker }
