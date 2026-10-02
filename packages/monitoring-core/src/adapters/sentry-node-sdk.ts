import type { SentrySdkLike } from "./create-sentry-adapter.js";

// The one module that imports `@sentry/node`. package.json's "browser" field maps
// this file to an empty module, so a browser bundle never pulls the Node SDK in, while the
// Node adapter that loads it stays importable everywhere.
export function importSentryNode(): Promise<SentrySdkLike> {
  return import("@sentry/node") as Promise<unknown> as Promise<SentrySdkLike>;
}
