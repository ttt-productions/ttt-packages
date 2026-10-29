# @ttt-productions/monitoring-core

Generic monitoring adapter package.

## Owns

- Monitoring adapter interface
- Sentry browser and Node adapters
- Noop adapter
- Generic `captureException` and related API
- React `ErrorBoundary` on `./react`
- The browser SDK's one init on `./browser`
- The telemetry scrubber — the forbidden-pattern redaction layer for outgoing events
- The telemetry content policy — the allowlist that cuts an outgoing event to diagnostic fields

## Capture context

`captureException(error, context)` applies the context to the capture's scope. Two keys are treated
as the first-class Sentry fields call sites mean them as: a `tags` key holding a flat string map
becomes REAL tags (`scope.setTag`, so the values are searchable, filterable, and alert-routable), and
a `level` key holding a severity name becomes the capture's REAL severity (`scope.setLevel`). Every
other key — and a `tags`/`level` value that does not fit the shape, or a scope that cannot honour it —
becomes an extra, so nothing is ever dropped. One helper (`src/capture-context.ts`) owns that
decision for both Sentry adapters.

`captureMessage(message, level?, context?)` honours the SAME context contract through the same
helper, so a message-shaped diagnostic keeps its payload instead of having to reach for the raw SDK.
The explicit `level` argument stays the message's severity and is passed through to the provider;
a `level` inside `context` is applied to the scope. Omitting `context` leaves the call on the plain
provider path — no scope is opened. `withScope` is NOT a substitute for this parameter: when no
provider instance is loaded yet, `withScope` runs its callback against a minimal no-op scope, so a
capture issued inside it carries none of that scope's data. Both capture entry points instead open
the scope internally on exactly one branch.

## withScope invokes its callback exactly once

`withScope(fn)` calls `fn` once on every path and returns its result. Once the SDK is ready
(loaded, and initialized when an init is running) it runs through the real Sentry scope; during the
window before that it runs against a minimal no-op scope and that window's scope data is not
attached. The
callback is never replayed against the real scope afterwards — call sites wrap whole request
handlers in `fn`, so a replay would re-execute their business logic. Losing pre-load scope data is
the correct tradeoff against running the caller twice.

## Telemetry scrubber

`createTelemetryScrubber` builds a Sentry `beforeSend` hook (and `redactEvent` exposes the same pass
for the backend `withScope` / manual-capture path) that walks the text fields of an outgoing event —
error, transaction, and replay events alike — and overwrites every substring matching a forbidden
pattern with a fixed placeholder (`REDACTION_PLACEHOLDER`), leaving the ids and timings a trace needs to
assemble. The scrubber and the content policy are generic over the event they are handed and return
that same type, so an SDK's own event type passes through them with no bridge. It is defense in depth, not the primary control: the real fix for a leak is never emitting the value,
and the scrubber exists to catch what third-party error text and SDK-recorded URLs drag in anyway.

One hook covers one event type. The SDK runs `beforeSend` on error events and
`beforeSendTransaction` on transactions; a Session Replay event (`type: 'replay_event'`, page URLs
in `urls`) goes through the SDK's event processors and through NEITHER hook, so a consumer that
records replays registers the scrubber as an event processor for those events as well. The replay
recording payload itself is not an event and never passes through any of them.

Ownership of the pattern set is split, and both halves are always in play:

- **This package owns the generic, domain-neutral defaults** (`DEFAULT_FORBIDDEN_PATTERNS`) — the
  shapes that must never reach telemetry regardless of which app is running.
- **The consuming app injects its product-specific patterns** through the `patterns` option
  (RULE-STD-ARCH-201 / RULE-STD-QUALITY-102 — no app data package import here); each app keeps that set
  in its own private code.

The two sets **merge**: app patterns are added to the defaults, never substituted for them.
`includeDefaults: false` is the only way to drop the generic half, so a default added here protects
every consumer that keeps it with no app-side wiring change.

Patterns apply in array order against the progressively redacted string, so the first pattern to
match a region wins. Only values are rewritten, never object keys. The default set is a contract of
this package: a change to it is a reviewed change to every consumer's telemetry, with its tests.

## Telemetry content policy

`createTelemetryContentPolicy(options)` returns `keepAllowlistedTelemetry(event)` and `isDiagnosticKey(key)`. The
scrubber removes known secret shapes but cannot recognise free text; the policy is the allowlist in front of it. It
rewrites an event in place and returns it (so it composes with the scrubber as one pre-send hook):

- the incoming request and the breadcrumbs are deleted;
- the user is cut to its `id` when that is a token, otherwise removed;
- in tags, extras, and scope contexts, a number, flag, or null is kept under any key (it cannot carry text); text is
  kept only under a diagnostic key and only as a token — 1–200 characters with no whitespace — and lists and nested
  objects under a diagnostic key are walked the same way, at most 20 items a list and four levels down; a `path` key
  is kept only as a list (a validation issue's field names), never as a string (a storage or document path);
- the SDK's own runtime contexts (`DEFAULT_SDK_CONTEXTS`: trace, runtime, os, app, device, culture, cloud_resource,
  or the caller's `sdkContexts` in their place) are kept whole; a context the caller names in `codeNameContexts` keeps
  its `name` (the code name of what ran) as a token;
- the error itself — message and exception — is left for the scrubber.

The package owns the mechanism only (RULE-STD-ARCH-201): which keys are diagnostic is the caller's — `diagnosticKeys`, matched
exactly, and `diagnosticKeySuffixes`, matched at the end of a key that starts with a lowercase letter (`Id` admits
`caseId`, never `Id` alone; an empty list admits nothing). Each app keeps those lists in its own data package. The module imports no SDK and no Node API, so any runtime — Node, browser, or edge — can apply it.

## Initialization

`initMonitoring(options)` installs the provider's adapter BEFORE it awaits anything, then runs the
adapter's init. A capture issued while the SDK is still loading therefore reaches the real adapter,
which holds it until its own `S.init` has run and then sends it — through the init-time hooks. Calls
made before `initMonitoring` runs at all go to the Noop adapter.

The options reach the SDK's init as given; anything left out is left out:

- `beforeSend` / `beforeSendTransaction` — the SDK's own hooks, active from the first event the SDK
  sends. A `BeforeSendHook` receives the event and the SDK's hint (`hint.originalException` is the
  thrown value) and returns the event, or `null` to drop it.
- `integrations` — ADDED to the SDK's default integrations; `[]` switches nothing off.
- `defaultIntegrations: false` — switches the defaults off, so only `integrations` run (a list
  replaces the defaults).
- `keepDefaultIntegrations` — a list of default-integration names (each integration's SDK `name`):
  only those defaults run, every other default is off, and `integrations` is still added after them.
  The adapter hands the SDK the function form of `integrations`, which the SDK calls with its own
  default list, so the app chooses defaults without importing the SDK to construct them. It cannot
  be combined with `defaultIntegrations`: `initMonitoring` rejects that pair before choosing a
  provider, so an emulator or Noop run refuses it the same as a deployed one.
- `tracesSampleRate` — the provider's trace sampling.

A repeated `initMonitoring` with the same options is skipped; options compare value by value, and a
function-valued option (a hook) compares by reference, so swapping a hook re-initializes.

If the SDK fails to load or its `init` throws, `initMonitoring` rejects (the caller reports it), and
every call that waits for the SDK reports itself on `console.error` as not delivered, naming the step
that failed: `[monitoring-core] <op> was not delivered: the monitoring SDK did not load`, `… failed
to initialize`, or — when the SDK itself throws on the call — `… threw`. Never a silent loss and
never an unhandled rejection.

Each adapter's SDK is named in one module that hands the adapter its `SentrySdkLike` slice:
`adapters/sentry-browser-sdk` (`@sentry/nextjs`) and `adapters/sentry-node-sdk` (`@sentry/node`),
which the package's `browser` field maps to an empty module, so a browser bundle never pulls
`@sentry/node` in. The browser init (below) imports `@sentry/nextjs` statically instead: it runs in
the app's `instrumentation-client.ts`, before React mounts, and must start the SDK synchronously.

## Browser init

`initBrowserMonitoring(options)` (`./browser`) is the one browser Sentry init; each app's
`instrumentation-client.ts` calls it with its own config, and the app's `initMonitoring` (binding
`captureException` and the rest to that SDK, with no DSN) runs as before. With `enabled: false` it
starts nothing — the app passes that for local and emulator runs.

Always on: the offline transport (a send that fails at the network is queued in IndexedDB and
retried), the console-error capture (error level only), and `beforeSend`, which runs in order the
app's `dropEvent(event, hint)` (a designed answer, say), the network-capture URL filter, the
telemetry scrubber (`scrubPatterns` on top of the defaults), and, when `attachIndexedDbNames(error)`
says so, the page's IndexedDB database names as `extra.indexedDbNames` (names only; a failed
listing sends the event without them). `ignoreErrors` is `DEFAULT_BROWSER_IGNORE_ERRORS` (generic
browser, network and Firebase SDK noise), then `IN_APP_BROWSER_IGNORE_ERRORS` when
`ignoreInAppBrowserNoise` is set, then the app's own list.

Three switches, each `false` or its config:

- `sessionReplay: { onErrorSampleRate, sessionSampleRate }` — Session Replay with all text masked
  and all media blocked. The scrubber is registered by the init itself on every outbound path a
  replay adds: an event processor for replay events (which pass through neither hook), and the
  recording's `beforeAddRecordingEvent`, which redacts every string in each frame in place.
- `tracesSampleRate` — trace sampling, with the scrubber as `beforeSendTransaction`.
- `networkCapture: { ignoreUrls }` — failed fetch/XHR capture (the SDK's default 5xx range); a
  capture of a URL matching `ignoreUrls` is dropped, so an endpoint whose failures another owner
  already reports is not reported twice.

## Boundary

App code owns initialization values, environment naming, and fallback UI. The React error boundary accepts app-owned context/fallback values.

The package reads no environment variable. Whether a run is local or an emulator run is the app's decision: the app passes `enabled: false` for it, and `initMonitoring` then installs the Noop adapter without importing the SDK. Otherwise the DSN is the switch — an adapter initialized without one initializes no SDK — and no environment flag turns a configured provider off.
