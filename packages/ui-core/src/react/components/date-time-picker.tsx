"use client"

import * as React from "react"
import { DatePicker } from "./date-picker.js"
import { cn } from "../../lib/utils.js"

export interface DateTimePickerTime {
  /** 0–23 */
  hours: number
  /** 0–59 */
  minutes: number
}

export interface DateTimePickerProps {
  /** The chosen instant (local time). */
  value?: Date
  /** Called with the new instant — always inside `min`/`max`, seconds and milliseconds zero. */
  onChange?: (value: Date) => void
  /** The earliest selectable instant. Earlier days and times are unavailable. */
  min?: Date
  /** The latest selectable instant. Later days and times are unavailable. */
  max?: Date
  /** Minutes offered are multiples of this (default 1). */
  minuteStep?: number
  /** Time of day a picked day takes when there is no `value` yet (default 23:59 — end of day). */
  defaultTime?: DateTimePickerTime
  className?: string
}

const MINUTES_PER_DAY = 24 * 60
const HOURS_12 = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
const PERIODS = ["AM", "PM"] as const
type Period = (typeof PERIODS)[number]

const pad2 = (n: number) => String(n).padStart(2, "0")
const at = (day: Date, minuteOfDay: number) =>
  new Date(day.getFullYear(), day.getMonth(), day.getDate(), Math.floor(minuteOfDay / 60), minuteOfDay % 60, 0, 0)
const minuteOfDayOf = (date: Date) => date.getHours() * 60 + date.getMinutes()
const to24 = (hour12: number, period: Period) => (hour12 % 12) + (period === "PM" ? 12 : 0)
const periodOf = (hours: number): Period => (hours >= 12 ? "PM" : "AM")
const hour12Of = (hours: number) => (hours % 12 === 0 ? 12 : hours % 12)

/**
 * Generic date-and-time picker: `DatePicker` for the day, then hour / minute / AM-PM
 * columns of buttons for the time of day — never a native time input, so it looks and
 * behaves the same everywhere and honours `min` / `max` to the minute.
 *
 * Every offered day, hour, minute, and period is one the value may take: a day with
 * no allowed instant is disabled in the calendar, and an hour, minute, or period
 * that would land outside `min` / `max` on the chosen day is disabled. Picking a day
 * keeps the chosen time of day (or `defaultTime` when there is no value) and moves it
 * to the nearest allowed time on that day; picking an hour or period whose current
 * minute is unavailable takes the nearest allowed minute.
 *
 * Keyboard: each time column is one tab stop with roving focus (ArrowUp / ArrowDown,
 * Home / End); Enter or Space picks.
 */
function DateTimePicker({
  value,
  onChange,
  min,
  max,
  minuteStep = 1,
  defaultTime = { hours: 23, minutes: 59 },
  className,
}: DateTimePickerProps) {
  const step = Math.max(1, Math.min(60, Math.floor(minuteStep)))
  const minuteOptions = React.useMemo(
    () => Array.from({ length: Math.ceil(60 / step) }, (_, i) => i * step).filter((m) => m < 60),
    [step],
  )

  const isAllowed = React.useCallback(
    (instant: Date) => (!min || instant >= min) && (!max || instant <= max),
    [min, max],
  )
  const offeredMinutes = React.useMemo(() => new Set(minuteOptions), [minuteOptions])
  const isOffered = React.useCallback(
    (minuteOfDay: number) => offeredMinutes.has(minuteOfDay % 60),
    [offeredMinutes],
  )

  /** Allowed minutes-of-day on `day`, ascending. */
  const allowedMinutesOn = React.useCallback(
    (day: Date) => {
      const out: number[] = []
      for (let m = 0; m < MINUTES_PER_DAY; m++) {
        if (isOffered(m) && isAllowed(at(day, m))) out.push(m)
      }
      return out
    },
    [isAllowed, isOffered],
  )

  const nearestAllowed = (day: Date, wanted: number): number | null => {
    const allowed = allowedMinutesOn(day)
    if (allowed.length === 0) return null
    let best = allowed[0]
    for (const m of allowed) if (Math.abs(m - wanted) < Math.abs(best - wanted)) best = m
    return best
  }

  const commit = (day: Date, wanted: number) => {
    const m = nearestAllowed(day, wanted)
    if (m === null) return
    onChange?.(at(day, m))
  }

  // A day strictly between the bounds' own days is decided by its first and last offered
  // minute; only the bounds' days need the minute-by-minute check.
  const firstOfferedMinute = minuteOptions[0]
  const lastOfferedMinute = 23 * 60 + minuteOptions[minuteOptions.length - 1]
  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  const isDayDisabled = (day: Date) => {
    if ((min && isSameDay(day, min)) || (max && isSameDay(day, max))) {
      return allowedMinutesOn(day).length === 0
    }
    if (min && at(day, lastOfferedMinute) < min) return true
    if (max && at(day, firstOfferedMinute) > max) return true
    return false
  }

  const handleDayPick = (day: Date | undefined) => {
    if (!day) return
    const wanted = value ? minuteOfDayOf(value) : defaultTime.hours * 60 + defaultTime.minutes
    commit(day, wanted)
  }

  const current = value ? minuteOfDayOf(value) : null
  const currentHours = current === null ? null : Math.floor(current / 60)
  const currentMinutes = current === null ? null : current % 60
  const currentPeriod = currentHours === null ? null : periodOf(currentHours)

  const allowedSet = React.useMemo(
    () => new Set(value ? allowedMinutesOn(value) : []),
    [value, allowedMinutesOn],
  )
  const hourEnabled = (hours: number) => minuteOptions.some((m) => allowedSet.has(hours * 60 + m))
  const minuteEnabled = (minutes: number) =>
    currentHours !== null && allowedSet.has(currentHours * 60 + minutes)
  const periodEnabled = (period: Period) => {
    const base = period === "PM" ? 12 : 0
    for (let h = base; h < base + 12; h++) if (hourEnabled(h)) return true
    return false
  }

  const pickHour = (hour12: number) => {
    if (!value || currentPeriod === null || currentMinutes === null) return
    const hours = to24(hour12, currentPeriod)
    const firstInHour = minuteOptions.find((m) => allowedSet.has(hours * 60 + m))
    if (firstInHour === undefined) return
    const minutes = allowedSet.has(hours * 60 + currentMinutes) ? currentMinutes : firstInHour
    commit(value, hours * 60 + minutes)
  }
  const pickMinute = (minutes: number) => {
    if (!value || currentHours === null) return
    commit(value, currentHours * 60 + minutes)
  }
  const pickPeriod = (period: Period) => {
    if (!value || currentHours === null || currentMinutes === null) return
    const hours = to24(hour12Of(currentHours), period)
    commit(value, hours * 60 + currentMinutes)
  }

  const timeDisabled = !value

  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-start", className)}>
      <DatePicker selected={value} onSelect={handleDayPick} disabled={isDayDisabled} />
      <div
        className="flex gap-2 p-4 bg-card rounded-lg"
        role="group"
        aria-label="Time"
        aria-disabled={timeDisabled || undefined}
      >
        <TimeColumn
          label="Hour"
          options={HOURS_12.map((h) => ({
            key: h,
            text: String(h),
            ariaLabel: `${h} o'clock`,
            selected: currentHours !== null && hour12Of(currentHours) === h,
            disabled: timeDisabled || currentPeriod === null || !hourEnabled(to24(h, currentPeriod)),
            onPick: () => pickHour(h),
          }))}
        />
        <TimeColumn
          label="Minute"
          options={minuteOptions.map((m) => ({
            key: m,
            text: pad2(m),
            ariaLabel: `${pad2(m)} minutes`,
            selected: currentMinutes === m,
            disabled: timeDisabled || !minuteEnabled(m),
            onPick: () => pickMinute(m),
          }))}
        />
        <TimeColumn
          label="AM or PM"
          options={PERIODS.map((p) => ({
            key: p,
            text: p,
            ariaLabel: p,
            selected: currentPeriod === p,
            disabled: timeDisabled || !periodEnabled(p),
            onPick: () => pickPeriod(p),
          }))}
        />
      </div>
    </div>
  )
}

DateTimePicker.displayName = "DateTimePicker"

interface TimeOption {
  key: string | number
  text: string
  ariaLabel: string
  selected: boolean
  disabled: boolean
  onPick: () => void
}

function TimeColumn({ label, options }: { label: string; options: TimeOption[] }) {
  const listRef = React.useRef<HTMLDivElement | null>(null)
  const selectedIndex = options.findIndex((o) => o.selected && !o.disabled)
  const firstEnabled = options.findIndex((o) => !o.disabled)
  const [focusIndex, setFocusIndex] = React.useState<number | null>(null)
  const rovingIndex =
    focusIndex !== null && options[focusIndex] && !options[focusIndex].disabled
      ? focusIndex
      : selectedIndex >= 0
        ? selectedIndex
        : firstEnabled

  // Keep the chosen option in view inside the fixed-height column.
  React.useLayoutEffect(() => {
    if (selectedIndex < 0) return
    const el = listRef.current?.querySelector<HTMLButtonElement>(`[data-index="${selectedIndex}"]`)
    el?.scrollIntoView?.({ block: "nearest" })
  }, [selectedIndex])

  const focusAt = (index: number) => {
    setFocusIndex(index)
    listRef.current?.querySelector<HTMLButtonElement>(`[data-index="${index}"]`)?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const enabled = options.map((o, i) => (o.disabled ? -1 : i)).filter((i) => i >= 0)
    if (enabled.length === 0 || rovingIndex < 0) return
    const pos = enabled.indexOf(rovingIndex)
    let next: number | undefined
    if (e.key === "ArrowDown") next = enabled[Math.min(enabled.length - 1, pos + 1)]
    else if (e.key === "ArrowUp") next = enabled[Math.max(0, pos - 1)]
    else if (e.key === "Home") next = enabled[0]
    else if (e.key === "End") next = enabled[enabled.length - 1]
    if (next === undefined) return
    e.preventDefault()
    focusAt(next)
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="text-xs font-semibold text-muted-foreground" aria-hidden="true">
        {label}
      </div>
      <div
        ref={listRef}
        role="group"
        aria-label={label}
        onKeyDown={handleKeyDown}
        className="flex h-64 w-14 flex-col gap-1 overflow-y-auto"
      >
        {options.map((o, i) => (
          <button
            key={o.key}
            type="button"
            data-index={i}
            tabIndex={i === rovingIndex ? 0 : -1}
            disabled={o.disabled}
            aria-pressed={o.selected}
            aria-label={o.ariaLabel}
            onClick={() => {
              setFocusIndex(i)
              o.onPick()
            }}
            className={cn(
              "h-9 shrink-0 rounded-lg text-sm font-semibold flex items-center justify-center",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              !o.disabled && !o.selected && "text-foreground hover:bg-primary/10",
              o.selected && "bg-primary text-primary-foreground font-bold",
              o.disabled && "opacity-30 cursor-not-allowed",
            )}
          >
            {o.text}
          </button>
        ))}
      </div>
    </div>
  )
}

export { DateTimePicker }
