import type { MonitoringAdapter } from '../adapter.js';
import type {
  MonitoringInitOptions,
  MonitoringLevel,
  MonitoringUser,
  ScopeLike,
} from '../types.js';
import { applyCaptureContext } from '../capture-context.js';

export type SentrySdkLike = {
  init: (opts: Record<string, unknown>) => void;
  captureException: (e: unknown) => void;
  captureMessage: (m: string, level?: MonitoringLevel) => void;
  setUser: (u: MonitoringUser | null) => void;
  setTag: (k: string, v: string) => void;
  withScope?: (fn: (scope: any) => void) => void;
  addBreadcrumb?: (breadcrumb: Record<string, unknown>) => void;
};

export function toSdkInitOptions(options: MonitoringInitOptions): Record<string, unknown> {
  const sdkOptions: Record<string, unknown> = {
    dsn: options.dsn,
    environment: options.environment,
    enabled: true,
    release: options.release,
  };
  const passThrough = [
    'tracesSampleRate',
    'integrations',
    'defaultIntegrations',
    'beforeSend',
    'beforeSendTransaction',
  ] as const;
  for (const key of passThrough) {
    if (options[key] !== undefined) sdkOptions[key] = options[key];
  }
  const keep = options.keepDefaultIntegrations;
  if (keep !== undefined) {
    // The SDK calls a function-form `integrations` with its own default list, so the app never
    // constructs one.
    const added = options.integrations ?? [];
    sdkOptions.integrations = (defaults: Array<{ name?: unknown }>) => [
      ...defaults.filter(
        (integration) => typeof integration?.name === 'string' && keep.includes(integration.name),
      ),
      ...added,
    ];
  }
  return sdkOptions;
}

type UndeliveredReason = 'did not load' | 'failed to initialize' | 'threw';

function reportUndelivered(operation: string, reason: UndeliveredReason, error: unknown): void {
  console.error(
    `[monitoring-core] ${operation} was not delivered: the monitoring SDK ${reason}`,
    error,
  );
}

const RESETS = new WeakMap<MonitoringAdapter, () => void>();

export function __resetSentryAdapter(adapter: MonitoringAdapter): void {
  const reset = RESETS.get(adapter);
  if (!reset) throw new Error('[monitoring-core] __resetSentryAdapter: not a Sentry adapter');
  reset();
}

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

  function sendException(
    S: SentrySdkLike,
    error: unknown,
    context?: Record<string, unknown>,
  ): void {
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
    context?: Record<string, unknown>,
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

  const adapter: MonitoringAdapter = {
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
      deferred('captureException', (S) => sendException(S, error, context));
    },

    captureMessage(message: string, level?: MonitoringLevel, context?: Record<string, unknown>) {
      if (instance) {
        sendMessage(instance, message, level, context);
        return;
      }
      deferred('captureMessage', (S) => sendMessage(S, message, level, context));
    },

    setUser(user: MonitoringUser | null) {
      if (instance) {
        instance.setUser(user);
        return;
      }
      deferred('setUser', (S) => S.setUser(user));
    },

    setTag(key: string, value: string) {
      if (instance) {
        instance.setTag(key, value);
        return;
      }
      deferred('setTag', (S) => S.setTag(key, value));
    },

    // `fn` runs exactly once and is never replayed: callers wrap whole request handlers in it.
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
      deferred('addBreadcrumb', (S) => S.addBreadcrumb?.(breadcrumb));
    },
  };
  RESETS.set(adapter, () => {
    sdkPromise = null;
    readyPromise = null;
    instance = null;
    initFailed = false;
  });
  return adapter;
}
