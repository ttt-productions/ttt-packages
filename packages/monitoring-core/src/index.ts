export type { MonitoringInitOptions, MonitoringUser, MonitoringProvider, ScopeLike } from "./types.js";
export type { MonitoringAdapter } from "./adapter.js";

export { initMonitoring, getMonitoringAdapter, setMonitoringAdapter, resetMonitoringAdapter } from "./init.js";
export { captureException, captureMessage, setUser, setTag, withScope, addBreadcrumb } from "./api.js";

export type {
  ForbiddenPattern,
  RedactStringOptions,
  ScrubbableEvent,
  TelemetryScrubberOptions,
  BeforeSendHook,
} from "./scrubber.js";
export {
  REDACTION_PLACEHOLDER,
  DEFAULT_FORBIDDEN_PATTERNS,
  redactString,
  redactEvent,
  createTelemetryScrubber,
} from "./scrubber.js";

export type {
  DefaultSafeEventKey,
  SafeEvent,
  BuildSafeEventOptions,
} from "./safe-event.js";
export { DEFAULT_SAFE_EVENT_KEYS, buildSafeEvent } from "./safe-event.js";