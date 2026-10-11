"use client"

import * as React from "react"
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react"
import { cn } from "../../lib/utils.js"

const Table = React.forwardRef<
  HTMLTableElement,
  React.HTMLAttributes<HTMLTableElement>
>(({ className, ...props }, ref) => (
  <div className="relative w-full overflow-auto">
    <table
      ref={ref}
      className={cn("w-full caption-bottom text-sm", className)}
      {...props}
    />
  </div>
))
Table.displayName = "Table"

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn("[&_tr]:border-b", className)} {...props} />
))
TableHeader.displayName = "TableHeader"

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn("[&_tr:last-child]:border-0", className)}
    {...props}
  />
))
TableBody.displayName = "TableBody"

const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn(
      "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
      className
    )}
    {...props}
  />
))
TableFooter.displayName = "TableFooter"

const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      "border-b transition-colors hover:bg-[color:var(--table-row-hover)] data-[state=selected]:bg-muted",
      className
    )}
    {...props}
  />
))
TableRow.displayName = "TableRow"

const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      "h-12 px-4 text-left align-middle font-bold text-label [&:has([role=checkbox])]:pr-0",
      className
    )}
    {...props}
  />
))
TableHead.displayName = "TableHead"

export type SortDirection = "asc" | "desc"

export interface SortableTableHeadProps {
  /** The column's full name; always spoken, and shown on a wide table. */
  label: string
  /** A short form shown while the table is narrow; the spoken name then gives it before `label`. */
  shortLabel?: string
  /** The column's current sort, or `null` when the table is not sorted by it. */
  direction: SortDirection | null
  onSort: () => void
  /** Classes for the header cell. */
  className?: string
}

const ARIA_SORT: Record<SortDirection, "ascending" | "descending"> = {
  asc: "ascending",
  desc: "descending",
}

/**
 * A column header that sorts its table. The visible labels are hidden from assistive technology
 * beside one spoken label, so the header and its button carry the same name ("G, Goals") rather
 * than the two visible labels run together. The short label gives way to the full one once the
 * nearest size container is 56rem wide.
 */
const SortableTableHead = React.forwardRef<HTMLTableCellElement, SortableTableHeadProps>(
  ({ label, shortLabel, direction, onSort, className }, ref) => {
    const Icon = direction === "asc" ? ArrowUp : direction === "desc" ? ArrowDown : ArrowUpDown
    return (
      <TableHead
        ref={ref}
        scope="col"
        aria-sort={direction ? ARIA_SORT[direction] : undefined}
        className={className}
      >
        <button
          type="button"
          onClick={onSort}
          className="inline-flex items-center gap-1 whitespace-nowrap rounded-sm ring-offset-background focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          {shortLabel ? (
            <>
              <span aria-hidden="true" className="@4xl:hidden">
                {shortLabel}
              </span>
              <span aria-hidden="true" className="hidden @4xl:inline">
                {label}
              </span>
              <span className="sr-only">{`${shortLabel}, ${label}`}</span>
            </>
          ) : (
            label
          )}
          <Icon className="icon-xxs" aria-hidden="true" />
        </button>
      </TableHead>
    )
  }
)
SortableTableHead.displayName = "SortableTableHead"

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn(
      "p-4 align-middle text-label font-bold [&:has([role=checkbox])]:pr-0",
      className
    )}
    {...props}
  />
))
TableCell.displayName = "TableCell"

const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption
    ref={ref}
    className={cn("mt-4 text-sm text-muted-foreground", className)}
    {...props}
  />
))
TableCaption.displayName = "TableCaption"

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  SortableTableHead,
  TableRow,
  TableCell,
  TableCaption,
}
