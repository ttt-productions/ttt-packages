import * as React from "react";
import * as ToastPrimitives from "@radix-ui/react-toast";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";

import { cn } from "../lib/utils";

/**
 * ui-core Toasts are consumed by multiple apps.
 *
 * Do NOT rely on app-level CSS (@apply) for critical positioning/visibility.
 * Keep all required styling inline as Tailwind utility classes.
 */
function ToastKeyframes() {
  // Inject a tiny global keyframe used by the optional countdown bar.
  return (
    <style
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{
        __html: `@keyframes toast-progress{from{transform:scaleX(1)}to{transform:scaleX(0)}}`,
      }}
    />
  );
}

const toastVariants = cva(
  cn(
    // base
    "pointer-events-auto relative flex w-full items-start justify-between gap-2 overflow-hidden rounded-md border bg-background p-4 text-foreground shadow-lg transition-all",
    // radix state/animation
    "data-[state=open]:animate-in data-[state=closed]:animate-out",
    "data-[state=closed]:fade-out-80 data-[state=open]:fade-in-80",
    "data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-top-full",
    "sm:data-[state=open]:slide-in-from-bottom-full",
    "data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)]",
    "data-[swipe=cancel]:translate-x-0 data-[swipe=cancel]:transition-[transform_200ms_ease-out]",
    "data-[swipe=end]:animate-out data-[swipe=end]:slide-out-to-right-full"
  ),
  {
    variants: {
      variant: {
        default: "",
        destructive: "border-destructive bg-destructive/10 text-destructive",
        success: "border-emerald-600/40 bg-emerald-600/10",
        warning: "border-amber-500/40 bg-amber-500/10",
        error: "border-destructive bg-destructive/10",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

const ToastProvider = ToastPrimitives.Provider;

const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Viewport
    ref={ref}
    className={cn(
      "fixed top-0 z-[100] flex max-h-screen w-full flex-col-reverse gap-2 p-4",
      "sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col",
      "md:max-w-[420px]",
      className
    )}
    {...props}
  />
));
ToastViewport.displayName = ToastPrimitives.Viewport.displayName;

type ToastRootProps = React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root> &
  VariantProps<typeof toastVariants> & {
    /** ms */
    duration?: number;
    /** show X button */
    dismissible?: boolean;
  };

const Toast = React.forwardRef<React.ElementRef<typeof ToastPrimitives.Root>, ToastRootProps>(
  ({ className, variant, duration = 5000, dismissible = true, style, children, ...props }, ref) => {
    // pass duration to Radix AND to CSS countdown bar
    const mergedStyle: React.CSSProperties = {
      ...(style as React.CSSProperties),
      ["--toast-duration" as any]: `${duration}ms`,
    };

    return (
      <ToastPrimitives.Root
        ref={ref}
        duration={duration}
        data-variant={variant}
        className={cn(toastVariants({ variant }), className)}
        style={mergedStyle}
        {...props}
      >
        <ToastKeyframes />
        {children}

        {/* countdown bar */}
        <div
          className={cn("absolute bottom-0 left-0 h-1 w-full bg-foreground/10", "origin-left")}
          style={{
            animationName: "toast-progress",
            animationDuration: `${duration}ms`,
            animationTimingFunction: "linear",
            animationFillMode: "forwards",
          }}
        />

        {/* dismiss button */}
        {dismissible ? (
          <ToastPrimitives.Close
            className={cn(
              "absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-md",
              "text-foreground/60 hover:text-foreground",
              "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
            )}
            aria-label="Dismiss toast"
          >
            <X className="h-4 w-4" />
          </ToastPrimitives.Close>
        ) : null}
      </ToastPrimitives.Root>
    );
  }
);
Toast.displayName = ToastPrimitives.Root.displayName;

const ToastAction = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Action>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Action>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Action ref={ref} className={cn(className)} {...props} />
));
ToastAction.displayName = ToastPrimitives.Action.displayName;

const ToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Close>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Close
    ref={ref}
    className={cn(
      "absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-md",
      "text-foreground/60 hover:text-foreground",
      "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background",
      className
    )}
    {...props}
  />
));
ToastClose.displayName = ToastPrimitives.Close.displayName;

const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Title ref={ref} className={cn(className)} {...props} />
));
ToastTitle.displayName = ToastPrimitives.Title.displayName;

const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Description ref={ref} className={cn(className)} {...props} />
));
ToastDescription.displayName = ToastPrimitives.Description.displayName;

/** Exported types for consumers */
export type ToastProps = React.ComponentPropsWithoutRef<typeof Toast>;
export type ToastActionElement = React.ReactElement<typeof ToastAction>;

export { ToastProvider, ToastViewport, Toast, ToastTitle, ToastDescription, ToastClose, ToastAction };
