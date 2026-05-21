"use client";

import * as React from "react";
import { ChevronUp } from "lucide-react";
import { Button, type ButtonProps } from "./button.js";
import { cn } from "../../lib/utils.js";

export interface ScrollToTopButtonProps {
  /** Scroll threshold (px) before the button appears. Default 400. */
  threshold?: number;
  /** Aria label. Default "Scroll to top". */
  ariaLabel?: string;
  /** Optional extra classes for the button. */
  className?: string;
  /** Optional override for the icon. */
  icon?: React.ReactNode;
  /** Button variant. Forwarded to the underlying Button. Defaults to Button's own default. */
  variant?: ButtonProps["variant"];
  /** Button size. Forwarded to the underlying Button. Default "icon". */
  size?: ButtonProps["size"];
}

export function ScrollToTopButton({
  threshold = 400,
  ariaLabel = "Scroll to top",
  className,
  icon,
  variant,
  size = "icon",
}: ScrollToTopButtonProps) {
  const [isVisible, setIsVisible] = React.useState(false);

  React.useEffect(() => {
    const toggle = () => setIsVisible(window.scrollY > threshold);
    toggle();
    window.addEventListener("scroll", toggle, { passive: true });
    return () => window.removeEventListener("scroll", toggle);
  }, [threshold]);

  const onClick = () => window.scrollTo({ top: 0, behavior: "smooth" });

  return (
    <Button
      variant={variant}
      size={size}
      onClick={onClick}
      aria-label={ariaLabel}
      className={cn(
        "fixed bottom-24 left-1/2 -translate-x-1/2 z-50 rounded-full shadow-lg transition-opacity duration-300",
        isVisible ? "opacity-100" : "opacity-0 pointer-events-none",
        className,
      )}
    >
      {icon ?? <ChevronUp className="h-5 w-5" />}
    </Button>
  );
}
