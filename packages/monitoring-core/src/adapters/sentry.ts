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

function getSentry(): Promise<SentryLike> {
  if (!sentryPromise) {
    // keep the import fully dynamic and untyped so TS doesn't require the module at build time
    sentryPromise = (Function("return import('@sentry/nextjs')")() as Promise<any>).then(
      (m) => m as SentryLike
    );
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
    void (async () => {
      const S = await getSentry();
      S.captureMessage(message, level);
    })();
  },

  setUser(user: MonitoringUser | null) {
    void (async () => {
      const S = await getSentry();
      S.setUser(user as any);
    })();
  },

  setTag(key: string, value: string) {
    void (async () => {
      const S = await getSentry();
      S.setTag(key, value);
    })();
  },

  withScope<T>(fn: (scope: ScopeLike) => T): T {
    // run immediately (sync) with a minimal scope.
    // also try to run in real Sentry scope when available.
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
    void (async () => {
      const S = await getSentry();
      if (S.addBreadcrumb) {
        S.addBreadcrumb(breadcrumb);
      }
    })();
  },
};