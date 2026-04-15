import type { MonitoringAdapter } from "../adapter.js";
import type { MonitoringInitOptions, MonitoringUser, ScopeLike } from "../types.js";

type SentryLike = {
  init: (opts: any) => void;
  captureException: (e: unknown) => void;
  captureMessage: (m: string, level?: any) => void;
  setUser: (u: any) => void;
  setTag: (k: string, v: string) => void;
  withScope?: (fn: (scope: any) => void) => void;
  addBreadcrumb?: (breadcrumb: any) => void;
};

let sentryPromise: Promise<SentryLike> | null = null;
let sentryInstance: SentryLike | null = null;

function getSentry(): Promise<SentryLike> {
  if (!sentryPromise) {
    sentryPromise = import("@sentry/nextjs").then((m) => {
      sentryInstance = m as any;
      return sentryInstance!;
    });
  }
  return sentryPromise;
}

export const SentryAdapter: MonitoringAdapter = {
  async init(options: MonitoringInitOptions) {
    const enabled = options.enabled ?? true;
    if (!enabled || !options.dsn) return;

    const S = await getSentry();
    S.init({
      dsn: options.dsn,
      environment: options.environment,
      enabled: true,
      release: options.release,
    });
  },

  captureException(error: unknown, context?: Record<string, unknown>) {
    if (sentryInstance) {
      if (context && sentryInstance.withScope) {
        sentryInstance.withScope((scope) => {
          for (const [k, v] of Object.entries(context)) {
            if (typeof scope?.setExtra === "function") scope.setExtra(k, v);
          }
          sentryInstance!.captureException(error);
        });
        return;
      }
      sentryInstance.captureException(error);
      return;
    }

    void (async () => {
      const S = await getSentry();

      if (context && S.withScope) {
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
    if (sentryInstance) {
      sentryInstance.captureMessage(message, level);
      return;
    }
    void (async () => {
      const S = await getSentry();
      S.captureMessage(message, level);
    })();
  },

  setUser(user: MonitoringUser | null) {
    if (sentryInstance) {
      sentryInstance.setUser(user as any);
      return;
    }
    void (async () => {
      const S = await getSentry();
      S.setUser(user as any);
    })();
  },

  setTag(key: string, value: string) {
    if (sentryInstance) {
      sentryInstance.setTag(key, value);
      return;
    }
    void (async () => {
      const S = await getSentry();
      S.setTag(key, value);
    })();
  },

  withScope<T>(fn: (scope: ScopeLike) => T): T {
    if (sentryInstance && sentryInstance.withScope) {
      let result: T;
      sentryInstance.withScope((scope) => {
        result = fn(scope as any);
      });
      return result!;
    }

    // Sentry not loaded yet — run with no-op scope, then replay async
    const minimalScope: ScopeLike = {
      setTag: () => {},
      setUser: () => {},
      setExtra: () => {},
      setContext: () => {},
    };

    void (async () => {
      const S = await getSentry();
      if (!S.withScope) return;
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
    if (sentryInstance) {
      if (sentryInstance.addBreadcrumb) {
        sentryInstance.addBreadcrumb(breadcrumb);
      }
      return;
    }
    void (async () => {
      const S = await getSentry();
      if (S.addBreadcrumb) {
        S.addBreadcrumb(breadcrumb);
      }
    })();
  },
};