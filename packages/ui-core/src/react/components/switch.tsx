"use client"

import * as React from "react"
import * as SwitchPrimitives from "@radix-ui/react-switch"

import { cn } from "../../lib/utils.js"
import { Spinner } from "./spinner.js"

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root> & {
    /**
     * The change this switch started is in flight: the switch disables itself, sets
     * `aria-busy`, and spins inside its thumb. It keeps showing the COMMITTED state —
     * the caller flips `checked` only once the write lands.
     */
    pending?: boolean
  }
>(({ className, pending = false, disabled, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input",
      className
    )}
    {...props}
    {...(pending ? { "aria-busy": true, "data-pending": "" } : {})}
    disabled={disabled || pending || undefined}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        "pointer-events-none flex h-5 w-5 items-center justify-center rounded-full bg-background shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0"
      )}
    >
      {pending ? <Spinner size="xs" /> : null}
    </SwitchPrimitives.Thumb>
  </SwitchPrimitives.Root>
))
Switch.displayName = SwitchPrimitives.Root.displayName

export { Switch }
