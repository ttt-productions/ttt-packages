"use client";

import * as React from "react";
import { cn } from "../../lib/utils";
import { useMediaQuery } from "../../hooks/use-media-query";

export type MaxWidthOption =
  | "none"
  | "sm"
  | "md"
  | "lg"
  | "xl"
  | "2xl"
  | "3xl"
  | "4xl"
  | "5xl"
  | "6xl"
  | "7xl"
  | "full";

export interface ScreenAdaptiveViewProps {
  /** Default content (mobile + base) */
  children: React.ReactNode;

  /** Optional content to use on lg and up */
  lgContent?: React.ReactNode;

  /** Optional content to use on xl and up */
  xlContent?: React.ReactNode;

  /** Max width applied at lg (>=1024px) */
  lgMaxWidth?: MaxWidthOption;

  /** Max width applied at xl (>=1280px) */
  xlMaxWidth?: MaxWidthOption;

  /** App-only escape hatch (try to avoid) */
  className?: string;

  /** App-only escape hatch (try to avoid) */
  innerClassName?: string;
}

function widthClass(opt: MaxWidthOption | undefined) {
  switch (opt) {
    case "none":
      return "screen-max-w-none";
    case "sm":
      return "screen-max-w-sm";
    case "md":
      return "screen-max-w-md";
    case "lg":
      return "screen-max-w-lg";
    case "xl":
      return "screen-max-w-xl";
    case "2xl":
      return "screen-max-w-2xl";
    case "3xl":
      return "screen-max-w-3xl";
    case "4xl":
      return "screen-max-w-4xl";
    case "5xl":
      return "screen-max-w-5xl";
    case "6xl":
      return "screen-max-w-6xl";
    case "7xl":
      return "screen-max-w-7xl";
    case "full":
      return "screen-max-w-full";
    default:
      return "screen-max-w-6xl";
  }
}

export function ScreenAdaptiveView({
  children,
  lgContent,
  xlContent,
  lgMaxWidth = "4xl",
  xlMaxWidth = "6xl",
  className,
  innerClassName,
}: ScreenAdaptiveViewProps) {
  const isLg = useMediaQuery("(min-width: 1024px)");
  const isXl = useMediaQuery("(min-width: 1280px)");

  // SSR-safe default: render base children as mobile (no max-width)
  // After hydration, swaps to lg/xl content if provided.
  const contentToShow =
    (isXl && xlContent !== undefined && xlContent !== null)
      ? xlContent
      : (isLg && lgContent !== undefined && lgContent !== null)
        ? lgContent
        : children;

  const sizeClass =
    isXl ? widthClass(xlMaxWidth) : isLg ? widthClass(lgMaxWidth) : "screen-max-w-full";

  return (
    <div className={cn("screen-adaptive-root", className)}>
      <div className={cn("screen-adaptive-inner", sizeClass, innerClassName)}>
        {contentToShow}
      </div>
    </div>
  );
}
