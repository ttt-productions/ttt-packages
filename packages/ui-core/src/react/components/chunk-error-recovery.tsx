"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";

export interface ChunkErrorRecoveryProps {
  children: React.ReactNode;
  /** Custom message shown during recovery reload. */
  loadingMessage?: React.ReactNode;
  /**
   * Predicate to decide whether an error event indicates a stale-chunk failure.
   * Defaults to matching "Failed to load chunk" in the message.
   */
  isChunkError?: (event: ErrorEvent) => boolean;
}

function defaultIsChunkError(event: ErrorEvent): boolean {
  const msg = event.message ?? "";
  if (msg.includes("Failed to load chunk")) return true;
  const nested =
    event.error && typeof event.error === "object"
      ? (event.error as { message?: string }).message
      : undefined;
  return typeof nested === "string" && nested.includes("Failed to load chunk");
}

export function ChunkErrorRecovery({
  children,
  loadingMessage = "Updating…",
  isChunkError = defaultIsChunkError,
}: ChunkErrorRecoveryProps) {
  const [hasError, setHasError] = React.useState(false);

  React.useEffect(() => {
    const handler = (event: ErrorEvent) => {
      if (!isChunkError(event)) return;
       
      console.error("Stale chunk detected — reloading.");
      setHasError(true);
      window.location.reload();
      event.preventDefault();
      event.stopPropagation();
    };
    window.addEventListener("error", handler);
    return () => window.removeEventListener("error", handler);
  }, [isChunkError]);

  if (hasError) {
    return (
      <div className="flex flex-col h-screen w-screen items-center justify-center gap-4 bg-background">
        <Loader2 className="h-10 w-10 animate-spin" />
        <p className="text-muted-foreground">{loadingMessage}</p>
      </div>
    );
  }
  return <>{children}</>;
}
