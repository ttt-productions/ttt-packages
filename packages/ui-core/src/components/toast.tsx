import * as React from "react";
import * as ToastPrimitives from "@radix-ui/react-toast";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";

import { cn } from "../lib/utils";

const toastVariants = cva("toast-root", {
  variants: {
    variant: {
      default: "",
      destructive: "data-[variant=destructive]:",
      success: "data-[variant=success]:",
      warning: "data-[variant=warning]:",
      error: "data-[variant=error]:",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

const ToastProvider = ToastPrimitives.Provider;

const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Viewport ref={ref} className={cn("toast-viewport", className)} {...props} />
));
ToastViewport.displayName = ToastPrimitives.Viewport.displayName;

type ToastProps = React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root> &
  VariantProps<typeof toastVariants> & {
    /** ms */
    duration?: number;
    /** show X button */
    dismissible?: boolean;
  };

const Toast = React.forwardRef<React.ElementRef<typeof ToastPrimitives.Root>, ToastProps>(
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
        {children}

        {/* countdown bar */}
        <div className="toast-progress" />

        {/* dismiss button */}
        {dismissible ? (
          <ToastPrimitives.Close className="toast-dismiss" aria-label="Dismiss toast">
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
  <ToastPrimitives.Close ref={ref} className={cn("toast-dismiss", className)} {...props} />
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

export {
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
};
