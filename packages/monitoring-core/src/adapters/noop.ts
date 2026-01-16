import type { MonitoringAdapter } from "../adapter";
import type { MonitoringInitOptions, MonitoringUser, ScopeLike } from "../types";

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
};
