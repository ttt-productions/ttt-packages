"use client";

import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from "./toast.js";
import { useToast } from "../hooks/use-toast.js";
import type { ToasterToast, ToastVariant } from "../hooks/use-toast.js";

export function Toaster() {
  const { toasts } = useToast() as { toasts: ToasterToast[] };

  return (
    <ToastProvider swipeDirection="right" swipeThreshold={32}>
      {toasts.map((t: ToasterToast) => {
        const { id, title, description, action, variant, duration, dismissible, open, onOpenChange, ...props } = t;

        const v: ToastVariant | "destructive" =
          variant === "error" ? "destructive" : (variant ?? "default");

        return (
          <Toast
            key={id}
            open={open}
            onOpenChange={onOpenChange}
            variant={v as any}
            duration={duration ?? 5000}
            dismissible={dismissible ?? true}
            {...(props as any)}
          >
            <div className="grid gap-1 pr-10">
              {title ? <ToastTitle className="font-bold">{title}</ToastTitle> : null}
              {description ? <ToastDescription className="font-bold">{description}</ToastDescription> : null}
            </div>
            {action}
            <ToastClose />
          </Toast>
        );
      })}

      {/* debug: proves viewport is visible/on-screen */}
      <ToastViewport />
    </ToastProvider>
  );
}
