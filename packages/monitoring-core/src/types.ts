import type { BeforeSendHook } from "./scrubber.js";

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
  /** Provider integrations passed through to the SDK init. The SDK ADDS this list to its
   *  default integrations — `[]` adds nothing and switches nothing off. To run without the
   *  defaults, pass `defaultIntegrations: false` and list the wanted ones here. Typed
   *  loosely: it is a provider-specific pass-through. */
  integrations?: unknown[];
  /** Passed through to the SDK init: `false` switches the provider's default integrations
   *  off, so only `integrations` run; a list replaces the defaults. */
  defaultIntegrations?: false | unknown[];
  /** Keep only these of the provider's default integrations, named by their SDK `name`;
   *  every other default is off, and `integrations` is still added after them. Lets the app
   *  choose defaults without importing the SDK to construct them. Cannot be combined with
   *  `defaultIntegrations` — `initMonitoring` rejects the pair on every provider. */
  keepDefaultIntegrations?: readonly string[];
  /** The SDK's `beforeSend`, installed by the init itself — it runs on every error event
   *  from the first one the SDK sends. Returning `null` drops the event. */
  beforeSend?: BeforeSendHook;
  /** The SDK's `beforeSendTransaction` — the same hook for transaction events. */
  beforeSendTransaction?: BeforeSendHook;
  /** Passed through to the SDK init: error messages the SDK drops before sending — a string
   *  matches any message containing it, a RegExp is tested against the message. */
  ignoreErrors?: Array<string | RegExp>;
  /** Passed through to the SDK init: the transport factory the SDK sends events with (for
   *  example the SDK's offline-queueing browser transport). Typed loosely: it is a
   *  provider-specific pass-through. */
  transport?: unknown;
  /** Browser provider only: the adapter builds the SDK's offline-queueing browser transport over
   *  its own fetch transport, so an event raised while the network is down is queued and sent
   *  later — without the app naming the SDK. Cannot be combined with `transport`, and
   *  `initMonitoring` rejects it on `sentry-node`. */
  offlineTransport?: boolean;
};

export type MonitoringUser = {
  id?: string;
  email?: string;
  username?: string;
  ip_address?: string;
};

/** The severity names every provider in this package understands. */
export type MonitoringLevel = "fatal" | "error" | "warning" | "info" | "debug";

export type ScopeLike = {
  setTag: (key: string, value: string) => void;
  setUser: (user: MonitoringUser | null) => void;
  setExtra: (key: string, value: unknown) => void;
  setContext: (key: string, context: Record<string, unknown>) => void;
  /** Optional: real Sentry scopes have it, the noop/minimal scopes may not. A capture
   *  context's `level` is applied through this when present (see capture-context.ts). */
  setLevel?: (level: MonitoringLevel) => void;
};