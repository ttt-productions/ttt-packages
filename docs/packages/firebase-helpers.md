# @ttt-productions/firebase-helpers

Generic Firebase helper package.

## Owns

- Firestore path helpers
- Timestamp conversion helpers
- Pagination and batch helpers
- Admin SDK init helper on `./server`
- Client Firebase init helper
- Generic file-url helper `getFileNameFromUrl`
- Firestore's `in`-filter cap, `FIRESTORE_IN_FILTER_LIMIT` (30 values in one `in`, `not-in`, or `array-contains-any` filter), beside `chunk`, which splits an id list into one read per chunk of that size. It is a Firestore platform limit, so every chunked `in` read in either app or a package splits by this one constant, never its own `30`.
- Generic callable hook/client helpers on `./react`, and the callable factories (`createCallables`) every app declares its callables through
- The designed-refusal readers on the root, beside `isExpectedCallableAnswerCode`: `callableRefusalCode` (the bare expected-answer code of a refusal, either wire form, or null) and `callableRefusalReason` (a `failed-precondition` refusal's `details.reason` when it is one of the caller's reasons, or null) — a refusal is told apart by its code and `details.reason`, never its message

## Boundary

App config, Firebase project values, toast behavior, monitoring behavior, and callable names live in the app. `firebase-helpers/react` exposes generic primitives and factories; the consuming app decides how errors are surfaced, through the policy it hands `createCallables`.

## Callable invocation contract

`callCallable(getFunctions, functionName, data?, callbacks?, transport?)` is the ONE invocation primitive (`useCallableMutation` delegates to it). `useCallableMutation().isLoading` is true while ANY call from that hook instance is in flight — overlapping calls keep it true until the last one settles, and every call, a failed one included, settles it. It is instance-wide, not per action: a control that needs its own in-progress state takes it from its own action. The primitive owns:

- **Acquiring Functions** — it takes a `FunctionsProvider` (`() => Functions | null | undefined`,
  or a promise of one for a lazily imported init) and calls it inside its own error tail. A
  provider that throws, or answers no instance (`FUNCTIONS_UNAVAILABLE_MESSAGE`), fails the call
  like any other failure: one `captureException`, one `onError`, rethrow. A synchronous
  provider invokes the SDK in the same tick; an async one is awaited within the deadline.

- **The undefined-strip** — `undefined`-valued keys are dropped deep before the wire (the SDK
  encodes them as `null`, which strict optional-not-nullable zod inputs reject).
- **The error-callback split** — `onError` receives `{ functionName, requestData }` for
  caller-local handling; `captureException` (the telemetry channel) receives BOUNDED metadata
  only (`{ functionName, timeoutMs }`) and never the request payload.
- **The optional total-invocation deadline** — `CallCallableTransport.timeoutMs` starts an outer
  timer BEFORE the SDK is invoked (the SDK's own `timeout` starts only after its auth/App Check
  header phase, so a stalled token mint is otherwise unbounded) and also forwards the value to the
  SDK's `timeout` option. Expiry rejects with a Firebase-shaped error, `code:
  "functions/deadline-exceeded"`. Expiry cannot cancel started work — the server may still
  commit, so callers treat the outcome as UNKNOWN, never as a definite failure, and never
  auto-retry a mutation on it. The package ships NO default; the consuming app owns the policy
  value and threads it via `useCallableMutation({ timeoutMs })` / `createCallableClient`
  overrides / the `callCallable` transport argument.
- **The optional limited-use App Check opt-in** — `CallCallableTransport.limitedUseAppCheck`
  (default false, threaded by `useCallableMutation` too) sets the SDK's
  `limitedUseAppCheckTokens`, so the call mints a SINGLE-USE App Check token and a backend
  running `consumeAppCheckToken` can actually REFUSE a replay instead of only recording one.
  It costs an attestation round trip PER CALL, so it is for sensitive callable groups only —
  never a blanket default. Rollout order is load-bearing: handler-side `alreadyConsumed`
  refusal must stay off until the consumers of that callable have adopted the option, because
  a cached (non-limited-use) token presents as already consumed. Absent unless explicitly
  enabled — the SDK options object is omitted entirely when no transport option is set.
- **The limited-use throttle fallback** — the limited-use path has no soft failure of its own:
  the SDK asks the App Check provider for a fresh token with no catch, so one failed exchange
  opens the provider's in-memory backoff window and every later limited-use invocation rejects
  (`appCheck/initial-throttle`, then `appCheck/throttled`) before reaching the wire. When a
  limited-use invocation rejects with either code, `callCallable` retries EXACTLY ONCE with the
  option omitted, taking the standard cached-token path. Retrying is safe against double
  submission because both codes are thrown in the SDK's pre-transport token phase — the first
  attempt never reached the backend. The retry races the SAME deadline (the timer is never
  restarted, so both attempts together stay inside `timeoutMs`), and a retry failure flows
  through the normal `captureException` + `onError` + rethrow tail exactly once. No other error
  class retries, and a call that did not request limited-use never does.

  The fallback itself is reported through `captureException` with
  `{ functionName, timeoutMs, limitedUseAppCheckFallback: true }` — bounded safe metadata, never
  the payload.

  **ROLLOUT CAVEAT.** The fallback is effective only while server-side token consumption is
  record-only. Once a handler arms `alreadyConsumed` refusal, a reused standard token would be
  refused, so the fallback must be revisited at that point.
- **The App Check throttle predicate** — `isAppCheckThrottleError(error)` is exported from the
  server-safe root beside `isExpectedCallableAnswerCode`, as the ONE definition of that error
  class (`APP_CHECK_THROTTLE_CODES`); `callCallable` classifies with it rather than restating
  the codes.

## Callable declarations contract

`createCallables(policy)` (`./react`) binds an app's policy once and returns the four callable
kinds. Each named callable is declared once in the app — `createCallableHook<TInput, TResult>(functionName,
{ limitedUseAppCheck?: true })`, and likewise for the others — so the function name, its types, and
its App Check posture live beside each other, and a call site sees only the named hook. Every kind
calls through `callCallable` with the policy's Functions provider and deadline; the kind fixes the
retry, surface, and capture:

- **action** (`createCallableHook`) — a TanStack mutation hook with `retry: false` that no call site
  can override (a deadline expiry is an unknown outcome, never retried). A call site passes the
  mutation options (minus `mutationFn` and `retry`) plus `showErrorToast`, `answeredRefusals`,
  `isAnswerSurfacedByCaller`, and `captureFaults` (false for a caller that re-sends on a fault and
  captures the final failure itself).
- **reader** (`createCallableReader`) — a hook returning the function a query's `queryFn` calls. It
  routes its failure with `showErrorToast: false` and captures no fault (the query layer captures
  it once).
- **invoker** (`createCallableInvoker`) — a hook returning a function a package hook drives inside its
  own mutation: the failure is routed and its fault captured once, and the call rejects so that
  mutation settles on it.
- **resumable** (`createResumableCallableHook(functionName, merge, declaration?)`) — an action for
  work the server does a budget at a time: one request calls again with the same input until the
  answer is `complete` or `MAX_RESUMABLE_CALLS` calls were made, `merge` folding each later answer
  into the earlier ones. It settles on a `ResumableOutcome` — the merged answer plus
  `interruption`: a failure on the first call rejects the request; a failure on a later one settles
  on the merged progress, never `complete`, with that failure as `interruption`, so earlier calls'
  committed work is never lost. A `merge` that throws rejects the request.

The policy (`CallablePolicy`) is everything app-specific; the package names no app copy and
imports no toast or monitoring module (QUALITY-102):

- `getFunctions` and `timeoutMs` — the Functions provider and the total-invocation deadline.
- `resolveLimitedUseAppCheck(requested)` — the effective limited-use mode for a callable declared
  limited-use or not.
- `captureFault(error, context)` — receives every `callCallable` report (failures and the
  recovered-fallback report) for a call whose kind owns its capture. For a reader or a
  `captureFaults: false` action, `captureRecoveredFallback` receives only the recovered-fallback
  report — the package filters it out by its own marker — and the failure is captured by neither,
  since another layer owns it.
- `onActionError(error, { showErrorToast, answeredRefusals, isAnswerSurfacedByCaller })` — called
  once for every failed call of every kind, with the call site's routing (defaults `true` and
  `[]`), so the app owns which answers have their own surface and which failures toast.

`@tanstack/react-query` is an optional peer, used only by the `./react` entry.

Backend code should prefer `@ttt-productions/firebase-helpers/server` when it needs Admin SDK handles.

## Entry points

The root is pure/server-safe — pure path, timestamp, and chunking helpers that never load a browser Firebase runtime. Client-only and Admin-only runtimes live behind explicit subpaths.

- `.` — pure helpers (paths, timestamps, `chunk` and `FIRESTORE_IN_FILTER_LIMIT`, `getFileNameFromUrl`, the expected-answer and App Check throttle classifiers, the designed-refusal readers); server-safe. Pagination and batch are NOT on root — they live on `./firestore-client` (client SDK) and `./server` (Admin SDK batch), since both need a runtime `firebase/firestore` import. The names typed on `firebase/firestore` (`DocSnap`, `QueryDocSnap`, `withId`, `TimestampLike`, `formatDateDisplay`) live on `./firestore-client` too, so the root's declaration files reach no Firebase type.
- `./server` — Admin SDK init helper, server-only handles, and the Admin-SDK batch and Timestamp helpers. The universal helpers (`chunk`, the Firestore types, `toMillis` / `toDate`, `getFileNameFromUrl`) are root-only; backend code imports them from `.`.
- `./react` — generic callable hook/client primitives and the callable factories (`createCallables`).
- `./client` — Firebase **client** app init helper (browser runtime).
- `./firestore-client` — client Firestore helpers (browser runtime) and the Firestore-typed names above.
