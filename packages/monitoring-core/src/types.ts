export type MonitoringProvider = "sentry" | "sentry-node" | "noop";

export type MonitoringInitOptions = {
  provider: MonitoringProvider;
  dsn?: string;
  environment?: string;
  enabled?: boolean; // default true
  release?: string;
  /** Performance-trace sample rate (0–1), passed through to the provider's init.
   *  Omit to use the provider default. */
  tracesSampleRate?: number;
  /** Provider integrations passed through to the SDK init — e.g. `[]` to disable the
   *  default auto-integrations and keep init lightweight (the TTT Cloud Functions
   *  bootstrap does this). Typed loosely: it is a provider-specific pass-through. */
  integrations?: unknown[];
};

export type MonitoringUser = {
  id?: string;
  email?: string;
  username?: string;
  ip_address?: string;
};

export type ScopeLike = {
  setTag: (key: string, value: string) => void;
  setUser: (user: MonitoringUser | null) => void;
  setExtra: (key: string, value: unknown) => void;
  setContext: (key: string, context: Record<string, unknown>) => void;
};