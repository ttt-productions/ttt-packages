import type { MonitoringAdapter } from "../adapter.js";
import type { MonitoringInitOptions, MonitoringUser, ScopeLike } from "../types.js";

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
          for (const [k, v] of Object.entries(context)) {
            if (typeof scope?.setExtra === "function") scope.setExtra(k, v);
          }
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
          for (const [k, v] of Object.entries(context)) {
            if (typeof scope?.setExtra === "function") scope.setExtra(k, v);
          }
          S.captureException(error);
        });
        return;
      }

      S.captureException(error);
    })();
  },

  captureMessage(message: string, level?: any) {
    if (sentryNodeInstance) {
      sentryNodeInstance.captureMessage(message, level);
      return;
    }
    void (async () => {
      const S = await getSentryNode();
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

  // NOTE: withScope calls `fn` exactly once. When Sentry is already loaded
  // (the expected steady state — `init()` awaits the dynamic import, and
  // callers must await `initMonitoring()` before serving traffic), it runs
  // synchronously through the real Sentry scope. Only during the narrow
  // pre-load race window (a call that races the very first `getSentryNode()`
  // resolution) does it fall back to a synchronous no-op-scope call plus an
  // async replay against the real scope — mirroring the browser adapter's
  // same accepted tradeoff for that same race window.
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

    void (async () => {
      const S = await getSentryNode();
      S.withScope((scope) => fn(scope as any));
    })();

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