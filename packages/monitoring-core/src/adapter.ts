import type { MonitoringInitOptions, MonitoringUser, ScopeLike } from "./types";

export interface MonitoringAdapter {
  init(options: MonitoringInitOptions): void | Promise<void>;

  captureException(error: unknown, context?: Record<string, unknown>): void;
  captureMessage(
    message: string,
    level?: "fatal" | "error" | "warning" | "info" | "debug"
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