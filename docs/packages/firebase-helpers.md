# @ttt-productions/firebase-helpers

Generic Firebase helper package.

## Owns

- Firestore path helpers
- Timestamp conversion helpers
- Pagination and batch helpers
- Admin SDK init helper on `./server`
- The one server Firestore contract on `./server` — `ServerFirestore`, `ServerTransaction`, `ServerCollectionRef`, `ServerQuery`, `ServerQuerySnapshot`, `ServerDocSnapshot`, `ServerDocRef`, `ServerWriteBatch`: the structural slice of the Admin SDK every server package handler takes, so the Admin SDK's own `Firestore` and `Transaction` are passed as they are, with no cast, and a test fake implements one contract
- The one Firebase client setup on `./client` (below)
- The consent-gated Firebase Analytics React pieces on `./react` (below)
- Generic file-url helper `getFileNameFromUrl`
- Firestore's `in`-filter cap, `FIRESTORE_IN_FILTER_LIMIT` (30 values in one `in`, `not-in`, or `array-contains-any` filter), beside `chunk`, which splits an id list into one read per chunk of that size. It is a Firestore platform limit, so every chunked `in` read in either app or a package splits by this one constant, never its own `30`.
- Generic callable hook/client helpers on `./react` (`useCallableMutation`, `createCallableClient`)
- The Firebase test kits every app's tests run on, one per runtime (below)
- The designed-refusal readers on the root, beside `isExpectedCallableAnswerCode`: `callableRefusalCode` (the bare expected-answer code of a refusal, either wire form, or null) and `callableRefusalReason` (a `failed-precondition` refusal's `details.reason` when it is one of the caller's reasons, or null) — a refusal is told apart by its code and `details.reason`, never its message

## Boundary

App config, Firebase project values, toast behavior, monitoring behavior, and callable names live in the app. `firebase-helpers/react` exposes generic primitives; the consuming app decides how errors are surfaced, through the callbacks it hands them and the policy it hands query-core's `createCallables`.

## The Firebase client setup (`./client`)

`initFirebaseClient(config, options)` is the one client setup every app uses; it runs once and
returns the same handles on every later call (`__resetFirebaseClientCache` is the test seam).
`getFirebaseClient()` returns them or throws if the setup has not run; `tryGetFirebaseClient()`
returns `undefined` instead. Every value comes from the app, and every behaviour is an option:

- **Config validation.** `requiredConfigKeys` names the Firebase config keys the app requires; a
  missing one throws `Firebase configuration is incomplete. Missing: …`, naming every missing key.
- **Firestore cache.** `persistentFirestoreCache` uses the multi-tab persistent local cache in the
  browser — never under the emulators — and reuses the existing instance if Firestore was already
  initialized (a hot reload).
- **App Check.** `appCheck: { siteKey, debugToken }` initializes App Check with the reCAPTCHA
  Enterprise provider and token auto-refresh, in the browser only and once per page (a hot reload
  does not initialize it twice). Under the emulators it is skipped unless a debug token is given; a
  missing site key logs a warning and skips it. `whenAppCheckReady()` waits for the first token,
  retrying through `awaitFirstToken`'s backoff, and resolves either way (fail-open, with a warning);
  it runs once however often it is awaited, and resolves at once when App Check is off.
- **The Auth boot lookup guard.** `authBootLookupGuard` installs `installAuthBootLookupGuard` before
  Auth starts: it classifies a failed boot `accounts:lookup` (`classifyBootLookupFailure` — identity,
  attestation, network, transient), retries the non-identity classes (an attestation retry first
  forces a fresh App Check token), and hands the SDK an identity failure untouched so it signs the
  account out — a session is never dropped for an outage. `getLastBootLookupFailureClass()` reads
  the last class.
- **Emulators.** `useEmulators` connects Auth, Firestore, Functions, and Storage once per page, in
  the browser only, on `emulatorPorts` (`host`, a separate `storageHost`, and each port);
  `useBrowserLocalPersistence` keeps the Auth session in local storage there.
- **Analytics.** `analytics` is a consent-gated handle that creates nothing until `enable()`:
  `enable()` initializes Analytics once (with the app's `analyticsConfig` gtag config) and turns
  collection on, `setCollectionEnabled(false)` stops collection (the SDK cannot be torn down),
  `get()` reads the handle, and `subscribe(listener)` tells a reader once, when the handle is first
  created. An app's consent switch (consent-core's `onAnalyticsChange`) drives `enable` /
  `setCollectionEnabled`.

## Firebase Analytics in React (`./react`)

- `useFirebaseAnalyticsHandle(handle)` — the handle, re-read when it is created.
- `useFirebaseAnalyticsEvents<TEventName>(handle, enabled)` — one stable `logEvent(name, params)`
  per consent state; it logs only while `enabled` and the handle exists, reading the handle when the
  event is logged. The app types the event names.
- `FirebaseAnalyticsPageViews({ handle, enabled, pathname })` — one `page_view` (`page_path`,
  `page_title`) per pathname under consent: on a load with a stored grant it waits for the handle,
  and withdrawing and re-granting consent on the same page sends no second one. The app turns the
  library's own page view off in its `analyticsConfig` so this is the only one.
- `FirebaseAnalyticsIdentity({ handle, enabled, uid, userProperties })` — attaches the signed-in
  account's `user_id` and the app's user properties under consent, and clears both when the session
  ends, the account changes (before it attaches the next), or consent is withdrawn.

## The test kits (`./server/testing`, `./firestore-client/testing`)

Both run under Vitest (an optional peer) and load the real SDK through `vi.importActual`, so a
suite's own `vi.mock` of the SDK can hand the kit's functions out.

- **`./server/testing`** — the Admin SDK side. `makeInMemoryFirestore()` is a real `Firestore`
  over an in-memory store. Its queries take every field filter operator, `orderBy` in either
  direction, `startAfter` (a snapshot or field values), `limit`, `select()`, `count()` and
  `aggregate()`, on a collection or a collection group, and answer as Firestore does: the client
  kit's value model compares every value (a range filter matches only its operand's type, `!=` and
  `not-in` leave out a null or missing field, an Admin `Buffer` is bytes and a reference a
  reference), an inequality field and then the document name order the result after the explicit
  orders, ties break in the last order's direction, and a document missing an order field is left
  out. `startAt`, `endAt`, `endBefore`, `limitToLast`, `offset`, and a composite `Filter` throw.
  Batches and transactions commit atomically, transactions with read-before-write and contention
  retry; a commit's `serverTimestamp()` is stored as the commit's `Timestamp`, every document keeps
  its update time, and a stale `delete({ lastUpdateTime })` is refused. Test hooks fail or hold
  reads, queries, and commits and log each query's filters and orders. `FieldValueSentinel` is the
  `FieldValue` it applies (its statics are spies, and the values it does not apply throw).
  `testAdminApp()` is one Admin app whose Auth and Storage reach a closed local port with no
  credential and with Storage's retries off, so a case spies the call it needs and an unspied one
  fails at once instead of calling Google; asked again with other options, it throws.
- **`./firestore-client/testing`** — the client SDK side. `makeInMemoryClientFirestore()` answers
  `getDoc`, `getDocFromServer`, `getDocs`, `getDocsFromServer`, `getCountFromServer`, and
  `onSnapshot` (every overload) from seeded documents, typed exactly as `firebase/firestore`'s, so
  a suite mocks only those reads and builds every reference and query with the real SDK — an
  invalid query fails as in production. It evaluates the real query (each filter operator,
  composite filters, the normalized order with documents missing an order field left out,
  `limit` / `limitToLast`, and cursors), and answers real SDK snapshots built from Firestore's
  bundle format, with the reference's converter, `fromCache` false, and real `Timestamp`s, so a
  snapshot it answers works as a `startAfter` cursor. A live listener answers after the call
  returns and again, on a later turn, after each change to its result, as the SDK delivers one;
  each later query answer's `docChanges()` holds its removals, additions, and modifications since
  the answer before it. Hooks fail a read (`FirestoreError` `unavailable` by default), break a live listener the way the SDK ends one (`failListeners`: its
  error callback once, nothing after), answer matching listeners from cache until switched back
  (`answerFromCache` / `answerFromServer` — a listener that asked for metadata changes hears each
  switch, as in the SDK), hold a read's answer, or run after it — `firestoreError(code,
  message)` builds the SDK's own error for them — and `queries()` logs every read's path, filters,
  orders, limit, and whether a listener asked for metadata changes, for a case whose rule is the
  query's shape. The SDK's built query, its missing-document and count snapshots, a cached
  answer's metadata, and a later answer's changes have no public reader or constructor, so one
  module reads them, and its test fails the moment an SDK upgrade changes them.

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
- `./server/testing` — the Admin SDK test kit (above); Node and Vitest only.
- `./server` — Admin SDK init helper, server-only handles, the Admin-SDK batch and Timestamp helpers, and the server Firestore contract (types only). The universal helpers (`chunk`, the Firestore types, `toMillis` / `toDate`, `getFileNameFromUrl`) are root-only; backend code imports them from `.`.
- `./react` — generic callable hook/client primitives (`useCallableMutation`, `createCallableClient`) and the Firebase Analytics React pieces; no react-query.
- `./client` — the Firebase **client** setup, `callCallable`, and `isRecoveredFallbackReport` (browser runtime).
- `./firestore-client` — client Firestore helpers (browser runtime) and the Firestore-typed names above.
- `./firestore-client/testing` — the client Firestore test kit (above); Vitest only.
