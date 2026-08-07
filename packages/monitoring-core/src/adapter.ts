import type { MonitoringInitOptions, MonitoringUser, ScopeLike } from "./types.js";

export interface MonitoringAdapter {
  init(options: MonitoringInitOptions): void | Promise<void>;

  captureException(error: unknown, context?: Record<string, unknown>): void;
  /** `context` follows the same contract as `captureException`: keys become extras,
   *  with `tags` (flat string map) and `level` special-cased onto the real Sentry
   *  fields — see `capture-context.ts`. The explicit `level` argument remains the
   *  message's severity; a `level` inside `context` is applied to the scope. */
  captureMessage(
    message: string,
    level?: "fatal" | "error" | "warning" | "info" | "debug",
    context?: Record<string, unknown>
  ): void;

  setUser(user: MonitoringUser | null): void;
  setTag(key: string, value: string): void;

  withScope?<T>(fn: (scope: ScopeLike) => T): T;
  
  addBreadcrumb?(breadcrumb: {
    category?: string;
    message?: string;
    level?: "fatal" | "error" | "warning" | "info" | "debug";
    data?: Record<string, unknown>;
  }): void;
}