import type { BeforeSendHook } from './scrubber.js';

export type MonitoringProvider = 'sentry' | 'sentry-node' | 'noop';

export type MonitoringInitOptions = {
  provider: MonitoringProvider;
  dsn?: string;
  environment?: string;
  enabled?: boolean;
  release?: string;
  tracesSampleRate?: number;
  /** The SDK adds this list to its default integrations: `[]` switches nothing off. */
  integrations?: unknown[];
  defaultIntegrations?: false | unknown[];
  keepDefaultIntegrations?: readonly string[];
  beforeSend?: BeforeSendHook;
  beforeSendTransaction?: BeforeSendHook;
};

export type MonitoringUser = {
  id?: string;
  email?: string;
  username?: string;
  ip_address?: string;
};

export type MonitoringLevel = 'fatal' | 'error' | 'warning' | 'info' | 'debug';

export type ScopeLike = {
  setTag: (key: string, value: string) => void;
  setUser: (user: MonitoringUser | null) => void;
  setExtra: (key: string, value: unknown) => void;
  setContext: (key: string, context: Record<string, unknown>) => void;
  setLevel?: (level: MonitoringLevel) => void;
};
