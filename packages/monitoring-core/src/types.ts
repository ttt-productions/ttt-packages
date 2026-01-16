export type MonitoringProvider = "sentry" | "sentry-node" | "noop";

export type MonitoringInitOptions = {
  provider: MonitoringProvider;
  dsn?: string;
  environment?: string;
  enabled?: boolean; // default true
  release?: string;
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