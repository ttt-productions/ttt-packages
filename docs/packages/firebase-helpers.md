# @ttt-productions/firebase-helpers

Generic Firebase helper package.

## Owns

- Firestore path helpers
- Timestamp conversion helpers
- Pagination and batch helpers
- Admin SDK init helper on `./server`
- Client Firebase init helper
- Generic file-url helper `getFileNameFromUrl`
- Generic callable hook/client helpers on `./react`

## Boundary

TTT config, Firebase project values, toast behavior, monitoring behavior, and callable names live in app wrappers. `firebase-helpers/react` exposes generic primitives; the consuming app decides how errors are surfaced.

## Callable invocation contract

`callCallable` is the ONE invocation primitive (`useCallableMutation` delegates to it). `useCallableMutation().isLoading` is true while ANY call from that hook instance is in flight — overlapping calls keep it true until the last one settles. It is instance-wide, not per action: a control that needs its own in-progress state takes it from its own action. The primitive owns:

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

Backend code should prefer `@ttt-productions/firebase-helpers/server` when it needs Admin SDK handles.

## Entry points

The root is pure/server-safe — pure path, timestamp, pagination, and batch helpers that never load a browser Firebase runtime. Client-only and Admin-only runtimes live behind explicit subpaths.

- `.` — pure helpers (paths, timestamps, `getFileNameFromUrl`); server-safe. Pagination and batch are NOT on root — they live on `./firestore-client` (client SDK) and `./server` (Admin SDK batch), since both need a runtime `firebase/firestore` import.
- `./server` — Admin SDK init helper, server-only handles, and admin-SDK batch helpers.
- `./react` — generic callable hook/client primitives.
- `./client` — Firebase **client** app init helper (browser runtime).
- `./firestore-client` — client Firestore helpers (browser runtime).
