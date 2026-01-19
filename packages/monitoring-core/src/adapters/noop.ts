import type { MonitoringAdapter } from "../adapter.js";
import type { MonitoringInitOptions, MonitoringUser, ScopeLike } from "../types.js";

const noopScope: ScopeLike = {
  setTag: () => {},
  setUser: () => {},
  setExtra: () => {},
  setContext: () => {},
};

export const NoopAdapter: MonitoringAdapter = {
  init: (_options: MonitoringInitOptions) => {},

  captureException: (_error: unknown, _context?: Record<string, unknown>) => {},
  captureMessage: (_message: string, _level?: any) => {},

  setUser: (_user: MonitoringUser | null) => {},
  setTag: (_key: string, _value: string) => {},

  withScope: <T>(fn: (scope: ScopeLike) => T) => fn(noopScope),
  
  addBreadcrumb: (_breadcrumb: {
    category?: string;
    message?: string;
    level?: "fatal" | "error" | "warning" | "info" | "debug";
    data?: Record<string, unknown>;
  }) => {},
};