# Adopt @ttt-productions/monitoring-core 0.13.20

**What:** The browser Sentry init is one shared init on `./browser`, driven by each app's config.
**Severity:** medium
**Came from:** the ttt-packages shared-package session (Q-Sports scope, ttt-parity Foundations)

- **Package and version:** `@ttt-productions/monitoring-core` 0.13.20.
- **Release:** `./scripts/release-multiple.sh firebase-helpers monitoring-core query-core q-core patch`.
- **What changed:**
  - New entry `./browser`: `initBrowserMonitoring(options)` and `DEFAULT_BROWSER_IGNORE_ERRORS`. It is ttt-prod's `instrumentation-client.ts` init made generic: the offline transport, the error-level console capture, and a `beforeSend` that runs the app's `dropEvent(event, hint)`, the network-capture URL filter and the telemetry scrubber (`scrubPatterns` on top of the defaults), then adds the page's IndexedDB database names (names only) to every error event as `extra.indexedDbNames`. Session Replay (`sessionReplay: { onErrorSampleRate, sessionSampleRate }`), traces (`tracesSampleRate`) and failed-fetch capture (`networkCapture: { ignoreUrls }`) each have a switch; with Replay on, the init registers the replay-event scrubber and the recording-frame redaction itself. `enabled: false` starts nothing.
  - The ignore list ttt-prod writes by hand is `DEFAULT_BROWSER_IGNORE_ERRORS`, which also ignores the scripts in-app browsers inject (Snapchat's `SCDynimacBridge`, Facebook's `Java object is gone`); the app's own `ignoreErrors` are added after it. The in-app-browser patterns and the IndexedDB names are new for ttt-prod and always on.
  - Design: ttt-packages `docs/packages/monitoring-core.md` § Browser init.
- **What the app must change:** Install. `instrumentation-client.ts` keeps `reloadRecoveryWatch()` first and `export const onRouterTransitionStart = Sentry.captureRouterTransitionStart`, and replaces its whole `Sentry.init` block, its hooks, the replay processor and frame redaction with one call: `initBrowserMonitoring({ enabled: process.env.NEXT_PUBLIC_USE_EMULATORS !== 'true', dsn: process.env.NEXT_PUBLIC_SENTRY_DSN, environment: <the same fallback chain>, scrubPatterns: TTT_FORBIDDEN_TELEMETRY_PATTERNS, dropEvent: (_event, hint) => isExpectedCallableAnswer(hint.originalException), sessionReplay: { onErrorSampleRate: 1, sessionSampleRate: 0 }, tracesSampleRate: 0.1, networkCapture: { ignoreUrls: [/^https:\/\/[^/]+\.cloudfunctions\.net\//] } })`. `initClientMonitoring` and the file's own types go; the tests of the moved hooks go, and a test of ttt-prod's config stays.
- **Done when:** The lockfiles name `@ttt-productions/monitoring-core` 0.13.20 or later, `instrumentation-client.ts` holds no `Sentry.init`, and the gate is green.
