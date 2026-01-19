import type { MonitoringUser } from "./types.js";
import { getMonitoringAdapter } from "./init.js";

export function captureException(error: unknown, context?: Record<string, unknown>) {
  return getMonitoringAdapter().captureException(error, context);
}

export function captureMessage(
  message: string,
  level?: "fatal" | "error" | "warning" | "info" | "debug"
) {
  return getMonitoringAdapter().captureMessage(message, level);
}

export function setUser(user: MonitoringUser | null) {
  return getMonitoringAdapter().setUser(user);
}

export function setTag(key: string, value: string) {
  return getMonitoringAdapter().setTag(key, value);
}

export function withScope(fn: (scope: any) => any) {
  const a = getMonitoringAdapter();
  return a.withScope ? a.withScope(fn as any) : fn({
    setTag: () => {},
    setUser: () => {},
    setExtra: () => {},
    setContext: () => {},
  });
}

export function addBreadcrumb(breadcrumb: {
  category?: string;
  message?: string;
  level?: "fatal" | "error" | "warning" | "info" | "debug";
  data?: Record<string, unknown>;
}) {
  const a = getMonitoringAdapter();
  if (a.addBreadcrumb) {
    a.addBreadcrumb(breadcrumb);
  }
}