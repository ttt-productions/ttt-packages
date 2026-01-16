import type { MonitoringAdapter } from "../adapter";
import type { MonitoringInitOptions, MonitoringUser, ScopeLike } from "../types";

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

function getSentryNode(): Promise<SentryNodeLike> {
  if (!sentryNodePromise) {
    sentryNodePromise = (Function("return import('@sentry/node')")() as Promise<any>).then(
      (m) => m as SentryNodeLike
    );
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
    });
  },

  captureException(error: unknown, context?: Record<string, unknown>) {
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
    void (async () => {
      const S = await getSentryNode();
      S.captureMessage(message, level);
    })();
  },

  setUser(user: MonitoringUser | null) {
    void (async () => {
      const S = await getSentryNode();
      S.setUser(user as any);
    })();
  },

  setTag(key: string, value: string) {
    void (async () => {
      const S = await getSentryNode();
      S.setTag(key, value);
    })();
  },

  withScope<T>(fn: (scope: ScopeLike) => T): T {
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
    void (async () => {
      const S = await getSentryNode();
      S.addBreadcrumb(breadcrumb);
    })();
  },
};