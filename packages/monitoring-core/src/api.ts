import type { MonitoringUser, ScopeLike } from './types.js';
import { getMonitoringAdapter } from './init.js';

export function captureException(error: unknown, context?: Record<string, unknown>) {
  return getMonitoringAdapter().captureException(error, context);
}

export function captureMessage(
  message: string,
  level?: 'fatal' | 'error' | 'warning' | 'info' | 'debug',
  context?: Record<string, unknown>,
) {
  return getMonitoringAdapter().captureMessage(message, level, context);
}

export function setUser(user: MonitoringUser | null) {
  return getMonitoringAdapter().setUser(user);
}

export function setTag(key: string, value: string) {
  return getMonitoringAdapter().setTag(key, value);
}

export function withScope<T>(fn: (scope: ScopeLike) => T): T {
  const a = getMonitoringAdapter();
  return a.withScope
    ? a.withScope(fn)
    : fn({
        setTag: () => {},
        setUser: () => {},
        setExtra: () => {},
        setContext: () => {},
      });
}

export function addBreadcrumb(breadcrumb: {
  category?: string;
  message?: string;
  level?: 'fatal' | 'error' | 'warning' | 'info' | 'debug';
  data?: Record<string, unknown>;
}) {
  const a = getMonitoringAdapter();
  if (a.addBreadcrumb) {
    a.addBreadcrumb(breadcrumb);
  }
}
