import type { MonitoringAdapter } from "../adapter.js";
import type { MonitoringInitOptions, MonitoringLevel, MonitoringUser, ScopeLike } from "../types.js";
import { applyCaptureContext } from "../capture-context.js";

/** The slice of a Sentry SDK (browser `@sentry/nextjs` or `@sentry/node`) the adapters call. */
export type SentrySdkLike = {
  init: (opts: Record<string, unknown>) => void;
  captureException: (e: unknown) => void;
  captureMessage: (m: string, level?: MonitoringLevel) => void;
  setUser: (u: MonitoringUser | null) => void;
  setTag: (k: string, v: string) => void;
  withScope?: (fn: (scope: any) => void) => void;
  addBreadcrumb?: (breadcrumb: Record<string, unknown>) => void;
};

/** The options `S.init` receives: every pass-through the caller set, and nothing it left out. */
export function toSdkInitOptions(options: MonitoringInitOptions): Record<string, unknown> {
  const sdkOptions: Record<string, unknown> = {
    dsn: options.dsn,
    environment: options.environment,
    enabled: true,
    release: options.release,
  };
  const passThrough = [
    "tracesSampleRate",
    "integrations",
    "defaultIntegrations",
    "beforeSend",
    "beforeSendTransaction",
  ] as const;
  for (const key of passThrough) {
    if (options[key] !== undefined) sdkOptions[key] = options[key];
  }
  return sdkOptions;
}

/** Why a call that waited for the SDK never reached the provider. */
type UndeliveredReason = 'did not load' | 'failed to initialize' | 'threw';

/**
 * A call issued before the SDK is ready waits for it; if the SDK import or its init fails, or
 * the SDK throws on the call, the call cannot reach the provider. Say so on the console, naming
 * which step failed — never a silent loss and never an unhandled rejection (ENG-009).
 */
function reportUndelivered(operation: string, reason: UndeliveredReason, error: unknown): void {
  console.error(`[monitoring-core] ${operation} was not delivered: the monitoring SDK ${reason}`, error);
}

/**
 * One Sentry adapter over an SDK loader. The adapter is usable the moment it is installed:
 * a call made while the SDK is still loading waits for it — behind this adapter's own
 * `S.init` when an init is running, so the init-time hooks (`beforeSend`,
 * `beforeSendTransaction`) already apply to the first event it sends.
 */
export function createSentryAdapter(loadSdk: () => Promise<SentrySdkLike>): MonitoringAdapter {
  let sdkPromise: Promise<SentrySdkLike> | null = null;
  let readyPromise: Promise<SentrySdkLike> | null = null;
  let instance: SentrySdkLike | null = null;
  let initFailed = false;

  function load(): Promise<SentrySdkLike> {
    if (!sdkPromise) sdkPromise = loadSdk();
    return sdkPromise;
  }

  function whenReady(): Promise<SentrySdkLike> {
    if (readyPromise) return readyPromise;
    return load().then((S) => {
      instance = S;
      return S;
    });
  }

  function deferred(operation: string, run: (S: SentrySdkLike) => void): void {
    void whenReady().then(
      (S) => {
        try {
          run(S);
        } catch (error) {
          reportUndelivered(operation, 'threw', error);
        }
      },
      (error: unknown) =>
        reportUndelivered(operation, initFailed ? 'failed to initialize' : 'did not load', error),
    );
  }

  function sendException(S: SentrySdkLike, error: unknown, context?: Record<string, unknown>): void {
    if (context && S.withScope) {
      S.withScope((scope) => {
        applyCaptureContext(scope, context);
        S.captureException(error);
      });
      return;
    }
    S.captureException(error);
  }

  function sendMessage(
    S: SentrySdkLike,
    message: string,
    level?: MonitoringLevel,
    context?: Record<string, unknown>
  ): void {
    if (context && S.withScope) {
      S.withScope((scope) => {
        applyCaptureContext(scope, context);
        S.captureMessage(message, level);
      });
      return;
    }
    S.captureMessage(message, level);
  }

  return {
    init(options: MonitoringInitOptions) {
      const enabled = options.enabled ?? true;
      if (!enabled || !options.dsn) return;

      const sdkOptions = toSdkInitOptions(options);
      initFailed = false;
      const ready = load().then((S) => {
        try {
          S.init(sdkOptions);
        } catch (error) {
          initFailed = true;
          throw error;
        }
        instance = S;
        return S;
      });
      readyPromise = ready;
      return ready.then(() => undefined);
    },

    captureException(error: unknown, context?: Record<string, unknown>) {
      if (instance) {
        sendException(instance, error, context);
        return;
      }
      deferred("captureException", (S) => sendException(S, error, context));
    },

    captureMessage(message: string, level?: MonitoringLevel, context?: Record<string, unknown>) {
      if (instance) {
        sendMessage(instance, message, level, context);
        return;
      }
      deferred("captureMessage", (S) => sendMessage(S, message, level, context));
    },

    setUser(user: MonitoringUser | null) {
      if (instance) {
        instance.setUser(user);
        return;
      }
      deferred("setUser", (S) => S.setUser(user));
    },

    setTag(key: string, value: string) {
      if (instance) {
        instance.setTag(key, value);
        return;
      }
      deferred("setTag", (S) => S.setTag(key, value));
    },

    // `fn` runs exactly once on every path. With the SDK ready it runs through the real
    // scope; before that it runs against a minimal no-op scope, so scope data set in that
    // window is not attached. It is never replayed against the real scope later: callers
    // wrap whole request handlers in `fn`, and a replay would re-run their business logic.
    withScope<T>(fn: (scope: ScopeLike) => T): T {
      if (instance && instance.withScope) {
        let result: T;
        instance.withScope((scope) => {
          result = fn(scope);
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
      level?: MonitoringLevel;
      data?: Record<string, unknown>;
    }) {
      if (instance) {
        instance.addBreadcrumb?.(breadcrumb);
        return;
      }
      deferred("addBreadcrumb", (S) => S.addBreadcrumb?.(breadcrumb));
    },
  };
}
