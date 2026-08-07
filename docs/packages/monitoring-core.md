# @ttt-productions/monitoring-core

Generic monitoring adapter package.

## Owns

- Monitoring adapter interface
- Sentry browser and Node adapters
- Noop adapter
- Generic `captureException` and related API
- React `ErrorBoundary` on `./react`
- The telemetry scrubber — the forbidden-pattern redaction layer for outgoing events

## Capture context

`captureException(error, context)` applies the context to the capture's scope. Two keys are treated
as the first-class Sentry fields call sites mean them as: a `tags` key holding a flat string map
becomes REAL tags (`scope.setTag`, so the values are searchable, filterable, and alert-routable), and
a `level` key holding a severity name becomes the capture's REAL severity (`scope.setLevel`). Every
other key — and a `tags`/`level` value that does not fit the shape, or a scope that cannot honour it —
becomes an extra, so nothing is ever dropped. One helper (`src/capture-context.ts`) owns that
decision for both Sentry adapters.

## Telemetry scrubber

`createTelemetryScrubber` builds a Sentry `beforeSend` hook (and `redactEvent` exposes the same pass
for the backend `withScope` / manual-capture path) that walks an entire outgoing event — message,
exception values and stacktrace frame vars, breadcrumbs, `extra`, `contexts`, `tags`, `request`, and
`user` — and overwrites every substring matching a forbidden pattern with a fixed placeholder. It is
defense in depth, not the primary control: the real fix for a leak is never emitting the value, and
the scrubber exists to catch what third-party error text and SDK-recorded URLs drag in anyway.

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

## Boundary

App code owns initialization values, environment naming, and fallback UI. The React error boundary accepts app-owned context/fallback values.

`initMonitoring` auto-forces the Noop adapter (skipping the dynamic SDK import entirely) whenever `NEXT_PUBLIC_USE_EMULATORS`, `FUNCTIONS_EMULATOR`, `FIREBASE_EMULATOR_HUB`, or `NEXT_PUBLIC_SENTRY_ENABLED=false` is set — local dev and emulator runs never load or initialize Sentry.
