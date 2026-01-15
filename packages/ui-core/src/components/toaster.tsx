"use client";

import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from "./toast";
import { useToast } from "../hooks/use-toast";

export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider swipeDirection="right" swipeThreshold={32}>
      {toasts.map(({ id, title, description, action, variant, duration, dismissible, ...props }) => (
        <Toast
          key={id}
          variant={(variant === "error" ? "destructive" : variant) ?? "default"}
          duration={duration ?? 5000}
          dismissible={dismissible ?? true}
          {...props}
        >
          <div className="grid gap-1 pr-10">
            {title ? <ToastTitle className="font-bold">{title}</ToastTitle> : null}
            {description ? <ToastDescription className="font-bold">{description}</ToastDescription> : null}
          </div>
          {action}
          {/* Keep exported close if anyone uses it directly */}
          <ToastClose />
        </Toast>
      ))}
      <ToastViewport />
    </ToastProvider>
  );
}
