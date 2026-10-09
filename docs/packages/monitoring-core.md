# @ttt-productions/monitoring-core

Generic monitoring adapter package.

## Owns

- Monitoring adapter interface
- Sentry browser and Node adapters
- Noop adapter
- Generic `captureException` and related API
- React `ErrorBoundary` on `./react`
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
for the backend `withScope` / manual-capture path) that walks an entire outgoing event — message,
exception values and stacktrace frame vars, breadcrumbs, `extra`, `contexts`, `tags`, `request`,
`user`, a transaction's `transaction` name and each of its `spans`' `description` and `data`, and a
replay event's top-level `urls` — and overwrites every substring matching a forbidden pattern with a
fixed placeholder. A span's ids, op, and timestamps are left alone so the trace still assembles. It
is defense in depth, not the primary control: the real fix for a leak is never emitting the value,
and the scrubber exists to catch what third-party error text and SDK-recorded URLs drag in anyway.

One hook covers one event type. The SDK runs `beforeSend` on error events and
`beforeSendTransaction` on transactions; a Session Replay event (`type: 'replay_event'`, page URLs
in `urls`) goes through the SDK's event processors and through NEITHER hook, so a consumer that
records replays registers the scrubber as an event processor for those events as well. The replay
recording payload itself is not an event and never passes through any of them.

Ownership of the pattern set is split, and both halves are always in play:

- **This package owns the generic, domain-neutral defaults** — the shapes that must never reach
  telemetry regardless of which app is running, including credentials that ride in a URL query
  string, where the browser SDK captures the full page URL into `request.url`, navigation
  breadcrumbs, and session replay. Values are deliberately over-redacted rather than shaped to a
  specific encoding, so an unexpected value loses too much instead of leaking a tail.
- **The consuming app injects its product-specific patterns** through the `patterns` option
  (ARCH-201 / QUALITY-102 — no app data package import here). For TTT that set is
  `TTT_FORBIDDEN_TELEMETRY_PATTERNS` in `ttt-core`, scoped to the CSAM/NCII subsystem.

The two sets **merge**: app patterns are added to the defaults, never substituted for them.
`includeDefaults: false` is the only way to drop the generic half, and no production init uses it —
so a default added here protects every consumer with no app-side wiring change.

Object **keys** are never rewritten, only values — a credential reachable solely as an object key
is outside what this layer can catch.

### Array order is load-bearing

Patterns apply in array order against the progressively redacted string, so the first pattern to
match a region wins and later ones never see it. The URL-borne credential-parameter entry therefore
sits **before** the generic credential assignment on purpose: its value class stops at `&`, the
generic one runs to end-of-string, and any parameter name the generic pattern can also reach (a
hyphenated spelling — `-` is a word boundary where `_` is not) would otherwise be swallowed together
with every following query parameter, destroying the route diagnostics the event exists to provide.
Do not reorder these two, and do not "consolidate" them: they cover each other's blind spots. The
`&`-terminated entry needs several non-`&` characters to fire, so a token value carrying an early
`&` deliberately falls through to the greedy entry.

### Deliberately NOT redacted

Parameter names that are generic English words are excluded by decision, not by oversight:
`code`, `state`, `key`, `nonce`, `session`, `sig`. Redacting `code=` would turn ordinary
`code=permission-denied` / `status code=500` diagnostics into placeholders — gutting the error text
the scrubber exists to keep readable — and `state` / `nonce` are not secrets. A genuinely
credential-bearing parameter under one of these names gets a **path-scoped** pattern naming the
route that carries it, never a bare parameter-name rule.

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

The package owns the mechanism only (ARCH-201): which keys are diagnostic is the caller's — `diagnosticKeys`, matched
exactly, and `diagnosticKeySuffixes`, matched at the end of a key that starts with a lowercase letter (`Id` admits
`caseId`, never `Id` alone; an empty list admits nothing). For TTT those lists are `TTT_TELEMETRY_CONTENT_POLICY` in
`ttt-core`. The module imports no SDK and no Node API, so any runtime — Node, browser, or edge — can apply it.

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
- `ignoreErrors` — the SDK's own ignore list: error messages it drops before sending (a string
  matches any message containing it, a RegExp is tested against the message). The app owns the
  list; this package ships none.
- `offlineTransport: true` — browser provider only: the adapter builds the SDK's offline-queueing
  browser transport over the SDK's own fetch transport, from the SDK it loaded, so an event raised
  while the network is down is queued and sent later and the app names no SDK. `initMonitoring`
  rejects it beside `transport` and on `sentry-node`; an SDK lacking the two transports fails the
  init rather than sending unqueued.
- `transport` — a raw transport factory passed through to the SDK, for an app that builds its own.

A repeated `initMonitoring` with the same options is skipped; options compare value by value, and a
function-valued option (a hook, a transport) compares by reference, so swapping a hook
re-initializes. A RegExp compares by its source and flags, so changing an `ignoreErrors` pattern
re-initializes too.

If the SDK fails to load or its `init` throws, `initMonitoring` rejects (the caller reports it), and
every call that waits for the SDK reports itself on `console.error` as not delivered, naming the step
that failed: `[monitoring-core] <op> was not delivered: the monitoring SDK did not load`, `… failed
to initialize`, or — when the SDK itself throws on the call — `… threw`. Never a silent loss and
never an unhandled rejection.

The Node SDK is named in one module (`adapters/sentry-node-sdk`) that the package's `browser` field
maps to an empty module, so a browser bundle never pulls `@sentry/node` in.

## Boundary

App code owns initialization values, environment naming, and fallback UI. The React error boundary accepts app-owned context/fallback values.

`initMonitoring` auto-forces the Noop adapter (skipping the SDK import entirely) whenever `NEXT_PUBLIC_USE_EMULATORS`, `FUNCTIONS_EMULATOR`, or `FIREBASE_EMULATOR_HUB` is set — local dev and emulator runs never load or initialize Sentry. There is no other off switch: the DSN is the switch, and an adapter initialized without one initializes no SDK.
