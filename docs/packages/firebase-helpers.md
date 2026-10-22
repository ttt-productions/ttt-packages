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
- Generic callable hook/client helpers on `./react` (`useCallableMutation`, `createCallableClient`)
- The designed-refusal readers on the root, beside `isExpectedCallableAnswerCode`: `callableRefusalCode` (the bare expected-answer code of a refusal, either wire form, or null) and `callableRefusalReason` (a `failed-precondition` refusal's `details.reason` when it is one of the caller's reasons, or null) — a refusal is told apart by its code and `details.reason`, never its message

## Boundary

App config, Firebase project values, toast behavior, monitoring behavior, and callable names live in the app. `firebase-helpers/react` exposes generic primitives; the consuming app decides how errors are surfaced, through the callbacks it hands them and the policy it hands query-core's `createCallables`.

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
  timer BEFORE the SDK is invoked (the SDK's own `timeout` starts only after its token phase, so
  a stalled token mint is otherwise unbounded) and also forwards the value to the
  SDK's `timeout` option. Expiry rejects with a Firebase-shaped error, `code:
  "functions/deadline-exceeded"`. Expiry cannot cancel started work — the server may still
  commit, so callers treat the outcome as UNKNOWN, never as a definite failure, and never
  auto-retry a mutation on it. The package ships NO default; the consuming app owns the policy
  value and threads it via `useCallableMutation({ timeoutMs })` / `createCallableClient`
  overrides / the `callCallable` transport argument.
- **The optional limited-use App Check opt-in** — `CallCallableTransport.limitedUseAppCheck`
  (default false, threaded by `useCallableMutation` too) sets the SDK's
  `limitedUseAppCheckTokens` for that call. It costs an attestation round trip per call; which
  callables use it is the app's. Absent unless explicitly enabled — the SDK options object is
  omitted entirely when no transport option is set.
- **The limited-use throttle fallback** — when a limited-use invocation rejects with an App Check
  throttle code (`appCheck/initial-throttle`, `appCheck/throttled`), which the SDK throws in its
  pre-transport token phase before anything reaches the backend, `callCallable` retries EXACTLY
  ONCE with the option omitted. The retry races the SAME deadline (the timer is never restarted,
  so both attempts together stay inside `timeoutMs`), and a retry failure flows through the
  normal `captureException` + `onError` + rethrow tail exactly once. No other error class
  retries, and a call that did not request limited-use never does. The fallback itself is
  reported through `captureException` with `{ functionName, timeoutMs, limitedUseAppCheckFallback:
  true }` — bounded safe metadata, never the payload. Whether the fallback suits a callable is
  the app's decision, made through its policy's `resolveLimitedUseAppCheck`.
- **The App Check throttle predicate** — `isAppCheckThrottleError(error)` is exported from the
  server-safe root beside `isExpectedCallableAnswerCode`, as the ONE definition of that error
  class (`APP_CHECK_THROTTLE_CODES`); `callCallable` classifies with it rather than restating
  the codes.

## Callable factories live in query-core

The callable factories every app declares its callables through (`createCallables`) are query-core
`./react`'s, built on `callCallable` and on query-core's session-aware mutation owner. This package
supplies the primitive and `isRecoveredFallbackReport(context)` (`./client`), the one check of the
marker `callCallable` sets on its recovered limited-use fallback report.

Backend code should prefer `@ttt-productions/firebase-helpers/server` when it needs Admin SDK handles.

## Entry points

The root is pure/server-safe — pure path, timestamp, and chunking helpers that never load a browser Firebase runtime. Client-only and Admin-only runtimes live behind explicit subpaths.

- `.` — pure helpers (paths, timestamps, `chunk` and `FIRESTORE_IN_FILTER_LIMIT`, `getFileNameFromUrl`, the expected-answer and App Check throttle classifiers, the designed-refusal readers); server-safe. Pagination and batch are NOT on root — they live on `./firestore-client` (client SDK) and `./server` (Admin SDK batch), since both need a runtime `firebase/firestore` import. The names typed on `firebase/firestore` (`DocSnap`, `QueryDocSnap`, `withId`, `TimestampLike`, `formatDateDisplay`) live on `./firestore-client` too, so the root's declaration files reach no Firebase type.
- `./server` — Admin SDK init helper, server-only handles, and the Admin-SDK batch and Timestamp helpers. The universal helpers (`chunk`, the Firestore types, `toMillis` / `toDate`, `getFileNameFromUrl`) are root-only; backend code imports them from `.`.
- `./react` — generic callable hook/client primitives (`useCallableMutation`, `createCallableClient`); no react-query.
- `./client` — Firebase **client** app init helper, `callCallable`, and `isRecoveredFallbackReport` (browser runtime).
- `./firestore-client` — client Firestore helpers (browser runtime) and the Firestore-typed names above.
