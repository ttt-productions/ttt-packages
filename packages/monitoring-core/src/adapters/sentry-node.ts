import type { MonitoringAdapter } from "../adapter.js";
import type { MonitoringInitOptions, MonitoringUser, ScopeLike } from "../types.js";
import { applyCaptureContext } from "../capture-context.js";

type SentryNodeLike = {
  init: (opts: any) => void;
  captureException: (e: unknown, hint?: any) => void;
  captureMessage: (m: string, level?: any) => void;
  setUser: (u: any) => void;
  setTag: (k: string, v: string) => void;
  withScope: (fn: (scope: any) => void) => void;
  addBreadcrumb: (breadcrumb: any) => void;
};

let sentryNodePromise: Promise<SentryNodeLike> | null = null;
let sentryNodeInstance: SentryNodeLike | null = null;

function getSentryNode(): Promise<SentryNodeLike> {
  if (!sentryNodePromise) {
    sentryNodePromise = import("@sentry/node").then((m) => {
      sentryNodeInstance = m as any;
      return sentryNodeInstance!;
    });
  }
  return sentryNodePromise;
}

export const SentryNodeAdapter: MonitoringAdapter = {
  async init(options: MonitoringInitOptions) {
    const enabled = options.enabled ?? true;
    if (!enabled || !options.dsn) return;

    const S = await getSentryNode();
    S.init({
      dsn: options.dsn,
      environment: options.environment,
      enabled: true,
      release: options.release,
      ...(options.tracesSampleRate !== undefined ? { tracesSampleRate: options.tracesSampleRate } : {}),
      ...(options.integrations !== undefined ? { integrations: options.integrations } : {}),
    });
  },

  captureException(error: unknown, context?: Record<string, unknown>) {
    if (sentryNodeInstance) {
      if (context) {
        sentryNodeInstance.withScope((scope) => {
          applyCaptureContext(scope, context);
          sentryNodeInstance!.captureException(error);
        });
        return;
      }
      sentryNodeInstance.captureException(error);
      return;
    }

    void (async () => {
      const S = await getSentryNode();

      if (context) {
        S.withScope((scope) => {
          applyCaptureContext(scope, context);
          S.captureException(error);
        });
        return;
      }

      S.captureException(error);
    })();
  },

  captureMessage(message: string, level?: any, context?: Record<string, unknown>) {
    if (sentryNodeInstance) {
      if (context) {
        sentryNodeInstance.withScope((scope) => {
          applyCaptureContext(scope, context);
          sentryNodeInstance!.captureMessage(message, level);
        });
        return;
      }
      sentryNodeInstance.captureMessage(message, level);
      return;
    }

    void (async () => {
      const S = await getSentryNode();

      if (context) {
        S.withScope((scope) => {
          applyCaptureContext(scope, context);
          S.captureMessage(message, level);
        });
        return;
      }

      S.captureMessage(message, level);
    })();
  },

  setUser(user: MonitoringUser | null) {
    if (sentryNodeInstance) {
      sentryNodeInstance.setUser(user as any);
      return;
    }
    void (async () => {
      const S = await getSentryNode();
      S.setUser(user as any);
    })();
  },

  setTag(key: string, value: string) {
    if (sentryNodeInstance) {
      sentryNodeInstance.setTag(key, value);
      return;
    }
    void (async () => {
      const S = await getSentryNode();
      S.setTag(key, value);
    })();
  },

  // NOTE: withScope calls `fn` exactly once, on every path. When Sentry is
  // already loaded (the expected steady state — `init()` awaits the dynamic
  // import, and callers must await `initMonitoring()` before serving traffic),
  // it runs synchronously through the real Sentry scope. During the narrow
  // pre-load window (a call that races the very first `getSentryNode()`
  // resolution) it runs against a minimal no-op scope instead, so scope data
  // set in that window is not attached to later events. Callers wrap whole
  // request handlers in `fn`, so re-running it against the real scope once the
  // SDK resolves would re-execute their business logic — losing that window's
  // scope data is the correct tradeoff.
  withScope<T>(fn: (scope: ScopeLike) => T): T {
    if (sentryNodeInstance) {
      let result: T;
      sentryNodeInstance.withScope((scope) => {
        result = fn(scope as any);
      });
      return result!;
    }

    const minimalScope: ScopeLike = {
      setTag: () => {},
      setUser: () => {},
      setExtra: () => {},
      setContext: () => {},
    };

    return fn(minimalScope);
  },

  addBreadcrumb(breadcrumb: {
    category?: string;
    message?: string;
    level?: "fatal" | "error" | "warning" | "info" | "debug";
    data?: Record<string, unknown>;
  }) {
    if (sentryNodeInstance) {
      sentryNodeInstance.addBreadcrumb(breadcrumb);
      return;
    }
    void (async () => {
      const S = await getSentryNode();
      S.addBreadcrumb(breadcrumb);
    })();
  },
};