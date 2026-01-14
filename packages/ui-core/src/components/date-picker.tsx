"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown } from "lucide-react"
import { Button } from "./button"
import { cn } from "../lib/utils"

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

const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]

function DatePicker({
  selected,
  onSelect,
  disabled,
  disablePast = false,
  disableFuture = false,
  className,
}: DatePickerProps) {
  const [viewDate, setViewDate] = React.useState(() => selected || new Date())
  const [showYearPicker, setShowYearPicker] = React.useState(false)

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

  const previousYear = () => setViewDate((prev) => new Date(prev.getFullYear() - 1, prev.getMonth()))
  const nextYear = () => setViewDate((prev) => new Date(prev.getFullYear() + 1, prev.getMonth()))

  const handleDateClick = (date: Date) => {
    if (isDateDisabled(date)) return
    onSelect?.(date)
  }

  const calendarDays = generateCalendarDays()

  return (
    <div className={cn("p-4 bg-card rounded-lg", className)}>
      <div className="flex items-center justify-between mb-4">
        <Button variant="default" size="sm" className="h-8 w-8 p-0" onClick={previousMonth}>
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowYearPicker(!showYearPicker)}
            className="text-base font-bold hover:opacity-80 transition-opacity text-foreground"
          >
            {MONTHS[viewDate.getMonth()]} {viewDate.getFullYear()}
          </button>

          {showYearPicker && (
            <div className="flex flex-col gap-1">
              <Button variant="ghost" size="sm" className="h-4 w-4 p-0" onClick={nextYear}>
                <ChevronUp className="h-3 w-3" />
              </Button>
              <Button variant="ghost" size="sm" className="h-4 w-4 p-0" onClick={previousYear}>
                <ChevronDown className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>

        <Button variant="default" size="sm" className="h-8 w-8 p-0" onClick={nextMonth}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

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

          const disabled = isDateDisabled(date)
          const selected = isDateSelected(date)
          const todayDate = isToday(date)

          return (
            <button
              key={date.toISOString()}
              onClick={() => handleDateClick(date)}
              disabled={disabled}
              className={cn(
                "h-9 w-9 rounded-lg text-sm font-semibold transition-all",
                "hover:scale-105 active:scale-95",
                "flex items-center justify-center",
                !disabled && !selected && !todayDate && "text-foreground hover:bg-primary/10",
                todayDate && !selected && "bg-accent text-foreground font-bold ring-2 ring-border",
                selected && "bg-primary text-white font-bold shadow-lg",
                disabled && "opacity-30 cursor-not-allowed hover:scale-100 hover:bg-transparent",
                disabled && "relative"
              )}
            >
              {date.getDate()}
              {disabled && (
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
          <div className="h-3 w-3 rounded bg-primary" />
          <span className="text-muted-foreground">Selected</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded bg-accent ring-2 ring-border" />
          <span className="text-muted-foreground">Today</span>
        </div>
        {(disablePast || disableFuture || disabled) && (
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded bg-muted opacity-30 relative">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-px h-full bg-foreground transform rotate-45" />
              </div>
            </div>
            <span className="text-muted-foreground">Unavailable</span>
          </div>
        )}
      </div>
    </div>
  )
}

DatePicker.displayName = "DatePicker"

export { DatePicker }
