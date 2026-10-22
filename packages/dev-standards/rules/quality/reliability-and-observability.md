# Quality — reliability & observability (RULE-STD-QUALITY-100–199)

Format, scopes, and rule IDs: [../README.md](../README.md).

Topic file routed with `quality/`. Read when a task touches monitoring, error capture, or must-complete background work. These rules sharpen RULE-STD-ENG-009 (fail truthfully and visibly).

### RULE-STD-QUALITY-101 — Every Cloud Function is monitored through monitoring-core withScope
**Scope.** apps

**Rule.** Every Cloud Function is wrapped for monitoring via `@ttt-productions/monitoring-core`'s `withScope` — never `@sentry/node` or `Sentry.withScope` directly. No app code names the Sentry Node SDK: the backend initializes monitoring exactly once, through monitoring-core's `initMonitoring`, handing the SDK the hooks and options its init-options module builds, and monitoring-core's Node adapter loads `@sentry/node` at runtime (which is why every deployed Functions codebase installs it as a baseline package). Monitoring is a no-op under the emulator and in tests.

**Why.** A function that captures through the raw SDK bypasses the app's monitoring policy — the telemetry scrubber, the expected-answer filter, and the emulator no-op — producing silent or noisy failures in production.

**Prohibits.**
- Importing `@sentry/node` / `Sentry.withScope` / `captureException` in a function body.
- A media-processing (or any) Cloud Function with no `withScope` wrapping.
- Any direct `@sentry/node` import in the Functions source, the monitoring init modules included.
- A second monitoring initialization.

**References.** RULE-STD-QUALITY-102, RULE-STD-QUALITY-106; RULE-STD-ENG-009; ttt-packages `docs/packages/monitoring-core.md`.

### RULE-STD-QUALITY-102 — Generic packages stay monitoring-agnostic; each app binds monitoring once
**Scope.** both

**Rule.** Generic packages and the app-data package (`<APP_DATA_PACKAGE>`) stay monitoring-agnostic: no `@sentry/*` import, no cloud runtime's params module, no app config. A package that must report failures exposes an `onError`-style callback seam. Each app binds its monitoring once per runtime, in a thin adapter for each seam, and call sites use the adapter, not the raw package primitive. The binding covers every outbound path: the app's telemetry scrubber runs on EVERY event type the monitoring SDK sends — error events and transactions on each runtime's init (browser, Node, edge), the backend's one pre-send hook, and, in the browser, session-replay events and every replay recording frame — and each init registers it itself, so it is in place before the first capture can leave.

**Why.** Monitoring bound inside a generic package couples it to one vendor and one app's config, and wiring `onError` per call site drifts into many inconsistent bindings. A scrubber wired on errors only lets every sampled transaction carry its page URL — a one-time code included — to monitoring unredacted.

**Prohibits.**
- Package source (generic or app-data) importing Sentry, a runtime params module, or app config.
- A call site importing the package primitive when an adapter for it already exists.
- Wiring `onError` per call site instead of through the shared adapter.
- A monitoring init that scrubs some outbound event types and not others, or that can send a capture before its scrubber is registered; a scrubber registered after the init (an event processor added once the SDK has loaded).

**References.** RULE-STD-ARCH-201; RULE-STD-QUALITY-101, RULE-STD-QUALITY-106; ttt-packages `docs/packages/monitoring-core.md`.

### RULE-STD-QUALITY-103 — No duplicate captures or error surfaces where a wrapper owns them
**Scope.** both

**Rule.** Where a wrapper — a package's or an app's — already owns a failure's capture and its user-facing surface, nothing around it adds a second capture or a second surface for the same failure. In an app, the declared callables' policy (`<CALLABLE_POLICY>`, applied through every callable declaration) owns the expected-answer monitoring filter, any interception it declares (a verify-email dialog), and the standard error toast; a monitoring adapter owns its own capture. A React Query READ is owned by the query layer instead: a callable-backed read calls its declared reader, which neither toasts nor captures, the rendered `<LOAD_ERROR_STATE>` is its one surface, and `<QUERY_ERROR_REPORTER>` is its one capture, routed through the same callable classifier (RULE-STD-FRONTEND-109).

**Why.** Double-capture doubles monitoring noise and double-toasting confuses the user; the wrapper is the single owner of that failure's observability and UX.

**Prohibits.**
- A call-site `try/catch` re-capturing an error the adapter or wrapper already captured.
- A call-site error toast duplicating the standard toast a declared action already raises.
- A callable-backed read keeping a toast or capture of its own beside the query layer's surface and capture.

**References.** RULE-STD-FRONTEND-105, RULE-STD-FRONTEND-109; RULE-STD-QUALITY-102; RULE-STD-ENG-009.

### RULE-STD-QUALITY-104 — Must-complete background work exposes durable failure/retry state
**Scope.** apps

**Rule.** Work that must eventually complete for correctness either commits atomically with its trigger or uses the established durable outbox/queue/retry model with observable state — never a fire-and-forget post-commit block. Post-commit best-effort effects stay isolated, are captured, and never convert an already-committed primary action into a reported failure. The notification system is the model: a product flow enqueues its notification job atomically with its product write, deliveries land in the one delivery ledger with an explicit `retry` class, and the scheduled materializer scan is the durable fallback that eventually materializes every queued, orphan, or retry row.

**Why.** Correctness work with no durable state to recover is a silent loss the moment its one attempt fails; a false success removes the signal that would have gotten it fixed.

**Prohibits.**
- Required-for-correctness work placed in a non-blocking post-commit block.
- A background obligation with no durable failure/retry state to observe or recover from.
- Failing a callable after its primary state already committed.

**References.** RULE-STD-BACKEND-301, RULE-STD-BACKEND-302, RULE-STD-BACKEND-304, RULE-STD-BACKEND-306; RULE-STD-ENG-009.

### RULE-STD-QUALITY-105 — Callable error-exits go through `<CALLABLE_ERROR_EXIT>`; designed refusals are silent
**Scope.** apps

**Rule.** Every `onCall` callable's catch-block error-exit goes through the app-local `<CALLABLE_ERROR_EXIT>` (the callable's name, the error, and an internal message). A designed `HttpsError` refusal — any expected-answer code per the canonical `isExpectedCallableAnswerCode` set in `@ttt-productions/firebase-helpers` (which includes the `aborted` optimistic-concurrency conflict) — or, where the app has one, the maintenance refusal, recognised by its structured details (`<APP_DATA_PACKAGE>`'s recogniser), never by its code — rethrows SILENTLY: no ERROR log, no capture; its only trace is the platform request log's WARNING. The exit and the backend monitoring filter decide with the one predicate `<DESIGNED_ANSWER_PREDICATE>`. Everything else logs at ERROR + captures + rethrows (unexpected-code `HttpsError` as-is; anything else wrapped `internal`). A code that is a designed refusal in ONE callable but a genuine fault elsewhere is declared per-callable at the exit and logs its own structured WARNING at the throw site — never by widening the canonical set, and never on a callable that can also produce that code as a real fault. A remap that synthesizes an expected-answer code for a genuine FAULT (an integrity/verification failure surfaced as a refusal for UX) keeps an explicit `logger.error` + `captureException` before its throw — the code alone does not make it designed. Post-commit best-effort captures (RULE-STD-BACKEND-301) are a different surface and keep their own capture.

**Why.** Callables that each carry their own inline log/capture/rethrow tail log every designed refusal at ERROR with a stack trace, making a routine "you need a cover image first" answer indistinguishable — in exactly the channel a real fault must stand out in — from a genuine failure.

**Prohibits.**
- An inline `logger.error` + `captureException` + rethrow tail in an `onCall` catch block (the exit's guard bans both an ad-hoc error-naming convention and the shape).
- Logging or capturing an expected-answer refusal at the callable exit.
- Restating the expected-answer code set instead of importing the canonical predicate (RULE-STD-ENG-005).
- A `run*` core reached from a callable that logs or captures a fault and rethrows it — the exit classifies and captures once; a core-level catch-all ERROR-logs every designed refusal and captures every fault twice. (A trigger or worker whose rethrow drives the platform retry has no exit behind it and keeps its own capture.)

**References.** RULE-STD-QUALITY-101, RULE-STD-QUALITY-103, RULE-STD-QUALITY-107; RULE-STD-ENG-009.

### RULE-STD-QUALITY-106 — Telemetry carries diagnostics, never request content
**Scope.** both

**Rule.** Every backend runtime — the Cloud Functions codebases and the Next server and edge runtimes — sends monitoring the error and allowlisted diagnostic fields only, under one policy:
- **No request data.** No event carries the incoming request — its URL, query, body, headers (the Authorization bearer and the App Check token included), cookies, or client address — nor a request path the framework records.
- **No traces.** No trace sample rate is set and every transaction is dropped before it is sent.
- **No breadcrumbs.** None is sent (console lines and HTTP records carry content).
- **Allowlisted fields only.** The user as an account id; in tags, extras, and scope contexts, numbers and flags under any key and text only under a diagnostic key, as a whitespace-free token; the SDK's own runtime contexts.

The allowlist is ONE definition: monitoring-core's `createTelemetryContentPolicy` (the mechanism) built from `<APP_TELEMETRY_POLICY>` in `<APP_DATA_PACKAGE>` (the diagnostic keys, key suffixes, and code-name context). The Functions backend applies it in its one pre-send hook before the telemetry scrubber, and its init keeps only the SDK's error-grouping defaults (monitoring-core `keepDefaultIntegrations`; every other default — request data, HTTP and fetch instrumentation, console breadcrumbs, local variables — is off). The Next server and edge inits run every event through the same policy and then the scrubber before it is sent, leave out the SDK's request-data integration, set `maxBreadcrumbs: 0`, and drop every transaction. A capture site — app or package — passes ids and codes, never a stored document, a title or other user-authored text, a file name, a storage or document path, or an error's free text as an extra, and sets only tag keys the policy keeps.

**Why.** The SDK's default integrations attach the whole incoming request — an id or a date of birth in its body, the bearer and App Check tokens in its headers, a one-time code in a query — and a capture site that hands over a whole stored record ships titles, free text, and file names; the pattern scrubber cannot recognise free text, so only an allowlist keeps it out.

**Prohibits.**
- A backend monitoring init (Functions, Next server, or edge) that captures request data, sets a trace sample rate, sends a transaction, or records breadcrumbs; a Functions init that runs an SDK default beyond its error-grouping set.
- A second copy of the content-policy mechanism or of the app's policy, or a backend runtime that does not build its policy from `<APP_TELEMETRY_POLICY>`.
- A Functions capture path that bypasses the pre-send hook, or a widening of the content policy's diagnostic keys to a key that holds prose, a document, a file name, or a path.
- A capture context carrying a stored document, user-authored text, a file name, a storage path, or `error.message` as an extra, or a tag key the policy drops.

**References.** RULE-STD-QUALITY-101, RULE-STD-QUALITY-102; RULE-STD-BACKEND-203 (the same never-user-text rule for audit payloads); monitoring-core `createTelemetryContentPolicy` (the one mechanism); ttt-packages `docs/packages/monitoring-core.md`.

### RULE-STD-QUALITY-107 — Every failure reaches one capture owner; a catch never ends at the user's screen
**Scope.** apps

**Rule.** Every failure of a call that leaves the process — a callable, a Firestore read, a Firebase Auth operation, an `/api` route fetch, a Storage upload, a third-party SDK — reaches monitoring through exactly ONE capture owner for its failure class, unless it is a designed answer the person was given. A `catch` that shows a message (a toast, an inline error, an error state) and does not rethrow is silent unless its class's owner captures it. The client owners: callable rejections → the callable wrapper (`<CALLABLE_POLICY>`); read failures → `<QUERY_ERROR_REPORTER>`; an app async action → `<ASYNC_ACTION_ERROR_HANDLER>` — an action that passes its own `onError` owns its capture; Firebase Auth operations → `<AUTH_FAILURE_CAPTURE>`, which captures only what auth-core cannot classify as an answer. The backend owners are the callable exit (RULE-STD-QUALITY-105), the post-commit block (RULE-STD-BACKEND-301), and a trigger's or worker's own capture before its rethrow. A failure class with no owner gets one — an adapter (RULE-STD-QUALITY-102) — before its first catch ships, never a scatter of per-site captures.

**Why.** A failure whose only trace is the message on one person's screen is invisible: nobody learns the flow is broken until a user reports it, and the class's other call sites stay just as silent. The owners above each see only their own class, so a catch around anything else is silent by default.

**Prohibits.**
- A catch around an external call that shows a message and neither rethrows nor reaches its class's capture owner.
- A per-site `captureException` for a class that has an owner, or a second owner for one class (RULE-STD-QUALITY-103).
- Shipping a catch for a new external-call class that has no capture owner.

**References.** RULE-STD-QUALITY-102, RULE-STD-QUALITY-103, RULE-STD-QUALITY-105; RULE-STD-BACKEND-301; RULE-STD-FRONTEND-109 (the user-facing copy of the same failures); RULE-STD-ENG-009.
