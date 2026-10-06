"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "./button.js";
import { cn } from "../../lib/utils.js";

/**
 * Standard button DOM props forwarded to the rendered element, minus the props this component owns:
 * the label pair, the expanded state and its change callback, and the disclosure ARIA it derives
 * from them.
 */
type ShowMoreTogglePassthrough = Omit<
  React.ComponentPropsWithoutRef<"button">,
  "className" | "onClick" | "children" | "aria-expanded" | "aria-controls"
>;

export interface ShowMoreToggleProps extends ShowMoreTogglePassthrough {
  /** Whether the content this toggle controls is shown. Controlled. */
  expanded: boolean;
  /** Called with the next expanded state when the toggle is pressed. */
  onExpandedChange: (expanded: boolean) => void;
  /** The label while the content is hidden (e.g. "Show the rumors"). */
  openLabel: React.ReactNode;
  /** The label while the content is shown (e.g. "Hide the rumors"). */
  closeLabel: React.ReactNode;
  /** The id of the element this toggle shows and hides, for `aria-controls`. */
  controls?: string;
  /** Extra classes, merged with the component's own. */
  className?: string;
}

/**
 * The one "show more" disclosure control: an outline button carrying the current label and a
 * chevron that turns over when the content is shown. Every expandable section uses it, so the
 * control looks and behaves the same everywhere and is changed in one place.
 */
export function ShowMoreToggle({
  expanded,
  onExpandedChange,
  openLabel,
  closeLabel,
  controls,
  className,
  type = "button",
  ...rest
}: ShowMoreToggleProps) {
  return (
    <Button
      {...rest}
      type={type}
      variant="outline"
      size="sm"
      className={className}
      aria-expanded={expanded}
      aria-controls={controls}
      onClick={() => onExpandedChange(!expanded)}
    >
      {expanded ? closeLabel : openLabel}
      <ChevronDown
        aria-hidden="true"
        data-expanded={expanded ? "true" : "false"}
        className={cn("ml-1 h-4 w-4 transition-transform motion-reduce:transition-none", expanded && "rotate-180")}
      />
    </Button>
  );
}
