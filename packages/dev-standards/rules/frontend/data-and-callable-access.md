# Frontend — data & callable access (FRONTEND 100s)

Format, scopes, and rule IDs: [../README.md](../README.md).

How the client reads server state, builds cache keys, invalidates, calls callables, and gates actions. Read with [core-rules.md](core-rules.md) for any task that fetches data or invokes a callable from the client. These sharpen RULE-STD-ENG-002 and RULE-STD-ENG-006 for the data layer.

### RULE-STD-FRONTEND-101 — React Query owns all server state
**Scope.** apps

**Rule.** All server-state reads and mutations go through React Query hooks in `src/hooks/`. Never fetch Firestore data with a raw `useEffect` + `useState`. Every query sets an explicit `staleTime` — never lean on the app-wide default (the app's addition states its query defaults) for data that changes less often. Read-derived state — a pager's cursor, page number, and has-next; a live window's rows; a listener's source status and error — lives in the keyed query result, never in component or hook-instance state beside it, so a cache hit, a remount, a second instance of the same key, or a key change cannot leave it describing a different read. A second hook instance is never a handle for refreshing or inspecting another instance's page — refresh by key (`refetchQueries` on the key).

**Why.** Ad-hoc effect-based fetching has no shared cache, no invalidation story, and no consistent loading/error surface — it drifts from the one data layer instantly. State kept beside the query drifts the same way: a pager cursor kept in an instance survives a remount and labels page 1 as page 2, a live window keeps rows from its previous subscription, and a Refresh button reloads a hidden copy instead of the page on screen.

**Prohibits.**
- `useEffect(() => { getDoc(...) }, [])` + `useState` for Firestore data.
- A query with no explicit `staleTime`; a bespoke fetch outside a `src/hooks/` React Query hook; a `useQuery` in a component or page.
- Cursor, page, has-next, live-row, or source-status state held in `useState` / `useRef` beside a query instead of in its keyed result; a second hook instance used to refresh or read another instance's page.

**References.** RULE-STD-ENG-003; RULE-STD-FRONTEND-102; ttt-packages `docs/packages/query-core.md`.

### RULE-STD-FRONTEND-102 — Query keys come from `<QUERY_KEYS_MODULE>`; freshness from `STALE_TIMES`
**Scope.** apps

**Rule.** Every cache key is a named method on a `*Keys` object in `<QUERY_KEYS_MODULE>` (`itemKeys.detail(id)`, `itemKeys.activePaginatedPrefix()`), and each queryable scope has exactly one builder — no aliases. Hooks and components import from that file — never `keys` from `@ttt-productions/query-core` directly, never a hand-typed `queryKey: [ … ]` array, and never a key-prefix literal at a call site. Each discriminator string appears in `<QUERY_KEYS_MODULE>` exactly once; families with variants expose a `*Prefix(...)` helper for the invalidation registry. Cache keys are app-local: they never cross into `<APP_DATA_PACKAGE>` or server code. Freshness uses a named `STALE_TIMES` preset (`short`/`medium`/`long`/`forever`) imported from `@ttt-productions/query-core`; a non-preset number is allowed only when deliberate and commented.

**Why.** Two parallel key factories and hand-typed arrays let an invalidation target a differently-shaped key no query reads — a silent no-op that leaves the UI stale; two builders for one scope are the same split in one file.

**Prohibits.**
- A hand-typed `queryKey: [...]` array or a key-prefix literal outside `<QUERY_KEYS_MODULE>`; importing `keys`/`createKeyScope` from query-core outside `<QUERY_KEYS_MODULE>`.
- A second builder (an alias) for a scope that has one.
- A cache key built or imported in `<APP_DATA_PACKAGE>` or server code.
- An uncommented raw `staleTime` number where a preset fits.

**References.** RULE-STD-ENG-002; RULE-STD-FRONTEND-103; ttt-packages `docs/packages/query-core.md`.

### RULE-STD-FRONTEND-103 — Invalidation is registry-owned; infinite feeds are patched, never invalidated
**Scope.** apps

**Rule.** Cache invalidation is owned by the domain-event registry: mutation hooks notify the registry (`<DOMAIN_EVENT_REGISTRY>`) of their domain event from their success path, and the registry is the ONLY production file that may call `queryClient.invalidateQueries(...)` (ESLint-enforced). **Never call `invalidateQueries` on an infinite-list query, and never reload one from an action — not to its first page, not page by page** — an action's change is placed, moved, or patched IN PLACE at the row's position in the list's own order, with every other loaded row, page, and cursor kept: through the app's feed and list cache helpers and, where the action's result or event carries no row, the one committed document read and placed through query-core's `placeRowInPages`. Only a member's own refresh may reload the list: pull-to-refresh, or a Refresh button (which re-reads every loaded page through the query's own `refetch`). Re-running a read that failed before it loaded any rows is not a reload — it holds no page to lose (the app's loaded-pages check scopes such a retry away from every list that does). `cancelQueries` is always scoped with a key filter, never called bare — with ONE sanctioned owner of the exception, the session-retirement owner (`<SESSION_RETIREMENT_OWNER>`, RULE-STD-FRONTEND-108): when a session ends it cancels every query and clears the query cache, because every read in the cache then belongs to the session that ended; any scope-ending removal beyond that lives in the same owner and is named in the app's addition. Nothing else cancels without a key, removes by predicate, or clears a cache. A `queryFn` is side-effect-free — no Firestore writes inside it. Every cache write — a patch, a helper, a registry entry — targets a key some live query READS, built by the same `<QUERY_KEYS_MODULE>` method the reading hook uses, and a mutation's test proves it by reading the result back through the consuming hook. A mutation reconciles every cached view of the row it changed (each status tab, the browse list and its counts), and a patch respects the list's order — a new row is prepended only to newest-first lists, never to a ranked one.

**Why.** Invalidating an infinite feed refetches every cached page (hundreds of rows at once); scattered `invalidateQueries` calls and a differently-shaped key silently no-op. A write aimed at a key nothing reads is the same silent no-op — a dialog keeps offering an action the server already refused because its mutation patched keys the dialog never read.

**Prohibits.**
- `queryClient.invalidateQueries(...)` outside `<DOMAIN_EVENT_REGISTRY>`; any `invalidateQueries` on an infinite list; an action-driven `resetQueries`, `refetchQueries`, or `removeQueries` of an infinite list, or a cache write that trims one back to its first page — only a member's own refresh (pull-to-refresh or a Refresh button) reloads the list.
- A `cancelQueries` without a key (bare or predicate-only), a predicate `removeQueries`, or a query/mutation cache `clear()` outside the session-retirement owner; a Firestore write inside a `queryFn`.
- A patch or registry entry targeting a key no query reads; a mutation that leaves another cached view of the same row (a status tab, a browse list, a count) showing the pre-mutation state; prepending a new row onto a ranked list.

**References.** RULE-STD-FRONTEND-010 (state shared across tabs), RULE-STD-FRONTEND-102, RULE-STD-FRONTEND-108; RULE-STD-QUALITY-103; ttt-packages `docs/packages/query-core.md`.

### RULE-STD-FRONTEND-104 — Components never import `firebase/firestore` directly
**Scope.** apps

**Rule.** Components never import runtime Firestore operations from `firebase/firestore`. Every read goes through a React Query hook in `src/hooks/`; every write goes through a callable (RULE-STD-FRONTEND-105) or a mutation hook that calls one. The only sanctioned direct-Firestore sites are inside a `queryFn` and root-provider hydration.

**Why.** A component reaching into Firestore bypasses the cache, the shared subscription registry, and the one data layer — the parallel-system failure at the read level; a client write helper standing in for a callable bypasses the server boundary at the write level.

**Prohibits.**
- `import { getDoc, onSnapshot, collection, … } from 'firebase/firestore'` in a component.
- A component-level Firestore read or write outside a hook / `queryFn`.
- A client write helper standing in for a callable.

**References.** RULE-STD-ENG-003; RULE-STD-FRONTEND-101, RULE-STD-FRONTEND-105, RULE-STD-FRONTEND-107; RULE-STD-BACKEND-106.

### RULE-STD-FRONTEND-105 — One callable invocation path; never raw `httpsCallable`
**Scope.** apps

**Rule.** Every callable is declared once in `<CALLABLE_DECLARATIONS>`, through the factory kind from query-core `./react`'s `createCallables` that fixes its retry, surface, and capture — an action, a reader, an invoker, or a resumable action — built from the one app callable policy (`<CALLABLE_POLICY>`). Screens and hooks call the declared hook, and the callable's name is written nowhere else. The factories ride firebase-helpers' `callCallable` primitive, which owns the **undefined-strip** (the SDK encodes `undefined` as `null`, which strict `.optional()` `<APP_DATA_PACKAGE>` schemas reject — the primitive drops undefined keys deep), and the policy owns the **error taxonomy**: the expected-answer monitoring filter, the standard error toast, and the answers that have their own surface (the app's addition lists them) — announced and never toasted, which a caller-owned surface skips through the policy's surfaced-elsewhere predicate. A hook that wraps both a callable and a non-callable leg (e.g. a Storage upload) toasts only the leg the callable can't see — gate its local `onError` on the policy's callable-rejection predicate returning false, or declare the call `{ showErrorToast: false }` and own the copy. A React Query READ calls its declared reader, which neither toasts nor captures, and its failure is a rendered state (RULE-STD-FRONTEND-109). **One rejection gets ONE toast, and that budget spans files**: a hook's declared action with its toast on and an `onError`/`catch` toast in a component that calls that hook are one surface between them, so exactly one side owns the copy — either the hook declares the toast off, or the call site drops its toast and lets the action own it.

**Why.** A raw `httpsCallable` skips the undefined-strip (the schema rejects valid input) and the error taxonomy (double toasts, unfiltered monitoring noise, and answers that have their own surface toasted as errors).

**Prohibits.**
- Importing `httpsCallable`/`getFunctions` from `firebase/functions`, or `callCallable`, anywhere in `src/`; a callable's name written outside `<CALLABLE_DECLARATIONS>`, including as a bare string at a call site; a file-local `callable()` wrapper.
- A callable hook that double-surfaces one rejection as two destructive toasts — in ONE file, or split across the hook module and its consuming component.

**References.** RULE-STD-FRONTEND-109; RULE-STD-QUALITY-103; ttt-packages `docs/packages/query-core.md`, `docs/packages/firebase-helpers.md`.

### RULE-STD-FRONTEND-106 — Gated actions go through the canonical auth gate
**Scope.** apps

**Rule.** Identity, claims, and auth loading come from the one auth-core provider through one accessor. Every auth-gated frontend action gates through the one shared readiness evaluator: the app's declarative render-prop gate for controls, or its imperative counterpart inside a submit handler where a wrapper doesn't fit (the app's addition names both). Both derive from the same evaluator — there is no duplicated gate state machine. Never hand-roll verified-email / role / status checks inline at a control, never build a second auth-gate primitive, and never stand in for the gate with a `useEffect` + router redirect. The gate never stays loading forever: an auth state that cannot resolve renders a terminal state. The client gate is UX only — the callable behind the action still re-checks every precondition server-side (RULE-STD-BACKEND-001, RULE-STD-ENG-006).

**Why.** One evaluator keeps the gate dialogs consistent and stops the client gate drifting from the server's auth requirements; a redirect effect flashes gated content before it runs, and a second auth context or claims parser is a second truth about who is signed in.

**Prohibits.**
- Inline `if (!user.emailVerified)` / claim / status checks at a gated control instead of the shared gate or its imperative counterpart.
- A new component or hook that re-implements the gate; a second auth context, claims parser, or profile listener; trusting the client gate as authority instead of re-checking in the callable.
- A `useEffect` + router redirect standing in for the gate; a gate that can stay loading forever.

**References.** RULE-STD-BACKEND-001, RULE-STD-ENG-006; RULE-STD-FRONTEND-110 (every other action gate); ttt-packages `docs/packages/auth-core.md`.

### RULE-STD-FRONTEND-107 — The client never writes sensitive state
**Scope.** apps

**Rule.** Sensitive state — role/privilege flags, account status, money-adjacent fields, moderation decisions, admin-curated fields — is never written from the client. Those writes route through a Cloud Function callable that validates preconditions server-side and uses the Admin SDK. This is the frontend mirror of the backend boundary: no `updateDoc(userRef, { role })`, `{ status }`, `{ banned }`, or a `Partial<T>` mutation that forwards arbitrary fields.

**Why.** Anything the client can write, an attacker can write without the UI; sensitive fields must live behind a server-validated callable.

**Prohibits.**
- A client `updateDoc`/`setDoc` to a role/status/money/moderation/admin-curated field or collection.
- A mutation signature `{ userId, data: Partial<T> }` forwarding `data` to `updateDoc`.

**References.** RULE-STD-BACKEND-201 (canonical owner), RULE-STD-BACKEND-209.

### RULE-STD-FRONTEND-108 — Auth-scoped subscribers reset on identity change
**Scope.** both

**Rule.** Any global subscriber, cache, or "me" read scoped to the signed-in user is keyed by uid and resets when identity changes, so the new uid's first snapshot is fresh — never a stale carry-over from the previous session; every auth-scoped query key takes the uid. The same holds for UI state bound to the signed-in user — an open dialog, a selection, an unsent draft, a remembered destination, an analytics identity: a surface that can stay mounted across a direct A→B switch keys that state by uid (or remounts on a uid change), so B never sees or submits A's. An async completion from a superseded identity or lifecycle — a grant, a socket event, a mutation callback, a retry — is fenced by the uid or a generation before it touches current state.

**Apps:** a continuation that runs after an awaited hop captures the uid when its attempt starts and re-checks it through its one session predicate before every later step, toast, or navigation; work that must run when a session ends (expiring a cookie, clearing an identity) lives in a component that stays mounted through the sign-out render — beside the app shell in the root layout, never among the children the shell swaps out when the session ends; and the query cache itself is retired by ONE owner, `<SESSION_RETIREMENT_OWNER>`: every way a session ends detaches that session's listeners, cancels its in-flight reads, and clears its cached reads before the next session renders.

**Why.** A subscriber that keeps the previous user's data after a sign-out/sign-in shows one account another account's state — a correctness and privacy bug. The same leak runs through plain component state (an open thread and its unsent draft carried from A to B, who could send it as B), through late completions (a stale grant after a close→connect opens a second socket), and through a continuation that toasts or navigates for a user who signed out mid-await; a sign-out effect mounted inside the shell's swapped children never runs, so session state outlives the session.

**Prohibits.**
- A module-level or auth-scoped subscriber/cache that survives an identity change without re-seeding for the new uid; an auth-scoped query key without the uid.
- Reusing a previous session's snapshot as the new user's first render.
- User-bound UI state (dialog open, draft, selection, saved route) held above or across the session with no uid binding.
- A continuation after an awaited hop that runs a later step, toast, or navigation without re-checking the uid it captured.
- A session-end effect in a subtree the shell unmounts when the session ends; a late completion from a previous identity or lifecycle applied to the current one.

**References.** RULE-STD-FRONTEND-103; ttt-packages `docs/design/display-identity-invariant.md`, `docs/packages/auth-core.md`, `docs/packages/query-core.md`.

### RULE-STD-FRONTEND-109 — One owner per data-layer failure's user-facing copy; never a raw SDK string
**Scope.** apps

**Rule.** A data-layer failure's user-facing text comes from that failure class's ONE owner, never from `error.message` or a stringified error.

- **Callable rejections** → the policy's describe function in `<CALLABLE_POLICY>` (the error, and an optional fallback) — the standard wrapper toast, and equally every caller-owned surface: a `{ showErrorToast: false }` hook's own `onError`, a component `catch`, an inline error line, a dialog. The two TRANSPORT classes always get their canonical copy: an App Check throttle never reached the wire, so nothing was sent; a client deadline is an UNKNOWN outcome, never a failure. A surface that needs its own domain wording passes it as the `fallback`, never as a second taxonomy.
- **Read failures** (React Query / Firestore) → the canonical `<LOAD_ERROR_STATE>` component, which builds the one sentence from the short noun the surface names and takes per-surface guidance as `hint`. A read failure is a RENDERED state, not a toast. `<LOAD_ERROR_STATE>` is the RULE-STD-FRONTEND-001 canonical error state — a surface never hand-writes its own "could not load X" markup or copy.

Classification predicates are generic and come from `@ttt-productions/firebase-helpers` (`isAppCheckThrottleError`); the COPY is `<APP_NAME>` policy and stays app-side (RULE-STD-ARCH-201). Monitoring capture for a read failure is single-owner at the query layer (`<QUERY_ERROR_REPORTER>`) — a rendering surface never captures again (RULE-STD-QUALITY-103). A CALLABLE-backed read hook therefore calls its declared reader, which neither toasts nor captures, and every consumer renders its failure through the read-state module from the read's held `retryState` (RULE-STD-FRONTEND-001, RULE-STD-FRONTEND-206), whose seat `<LOAD_ERROR_STATE>` receives the read's `error` so an answer the app policy surfaces elsewhere renders as that answer's own state rather than a load failure; `<QUERY_ERROR_REPORTER>` captures the settled failure through the policy's one callable classifier (`<CALLABLE_POLICY>`), so an expected refusal is never an error issue.

**Why.** A raw SDK string reaches the user as the whole answer — "AppCheck: Requests throttled." tells them nothing and, for a request that never left the browser, is not even about their action; a Firestore read error's message is an internal diagnostic. Every local handler that reads `.message` is a second copy of the error taxonomy, and every hand-written "could not load" line is a second copy of the copy, so each new failure class has to be re-learned at dozens of call sites.

**Prohibits.**
- `description: error.message`, `setError(error.message)`, `error instanceof Error ? error.message : '…'`, `String(error)`, or a JSX-rendered `{error.message}` as the copy for any data-layer failure.
- A call-site re-implementation of the throttle/deadline classification, or its copy restated at a call site.
- A hand-written read-failure sentence instead of `<LOAD_ERROR_STATE>` — `Could not load` / `Failed to load` / `Error loading`, or the same sentence around another read verb (`Could not search …`, `Couldn't fetch …`), in any casing (a title-cased `Error Loading X` included) — or a local read-error component; a destructive toast for a read failure.
- A callable-backed read that does not call its declared reader, so it keeps a toast or a capture of its own (a second surface and a second capture for one failed read).
- Putting `<APP_NAME>` user-facing copy in a generic package, or a package-side predicate re-declared app-side.

**References.** RULE-STD-FRONTEND-001 (one canonical pending/empty/error state), RULE-STD-FRONTEND-105 (one invocation path, one toast per rejection); RULE-STD-ENG-002, RULE-STD-ENG-005, RULE-STD-ENG-009; RULE-STD-QUALITY-103; RULE-STD-ARCH-201; ttt-packages `docs/packages/firebase-helpers.md`.

### RULE-STD-FRONTEND-110 — An offered action mirrors the backend's predicate
**Scope.** apps

**Rule.** Whether the UI offers an action — its status gate (open, closed, locked, published), deadline, cap, self-target, standing, account type — derives from the same canonical predicate the backend enforces: an `<APP_DATA_PACKAGE>` rule or constant (an action catalog, a readiness or deadline helper — the app's addition names its own), never a gate restated in the component. The UI neither offers an action the backend refuses in the current state nor hides one it allows, and while the predicate's inputs are loading or failed the control waits (RULE-STD-FRONTEND-206). The backend stays the authority (RULE-STD-ENG-006); this rule keeps the offer honest.

**Why.** A control the server refuses reads as a broken app — an entry offered on a closed round, a follow offered on the viewer's own item, a date the picker offered and the server refused — while a gate stricter than the server's strands a user with no path to an allowed action, and a gate restated in a component drifts from the core's on the next policy change.

**Prohibits.**
- A component re-deriving an action gate (status, deadline, cap, self-target, standing) instead of importing the canonical predicate.
- A control offered for an action the backend refuses in the current state, or hidden for one it allows.
- A picker whose selectable range disagrees with the backend's rule for the value.

**References.** RULE-STD-ENG-002, RULE-STD-ENG-006; RULE-STD-FRONTEND-106 (the auth-readiness gate), RULE-STD-FRONTEND-206.

### RULE-STD-FRONTEND-111 — Admin actions outside the admin area go through the one admin-actions affordance
**Scope.** both

**Rule.** **Apps:** outside the app's admin area, an admin action is offered only through the app's one shield-marked admin-actions affordance, never as an inline control beside a member's own actions. Outside the admin area, a read of the viewer's admin standing is allowed for three purposes only: navigation to the admin area, an admin's viewing reach (seeing what a member could not), or the admin's own inbox. Each such read is a reviewed entry naming its purpose, and every other read of admin standing outside the admin area is a violation. The backend stays the authority on every admin action (RULE-STD-BACKEND-004). **Packages:** a React package never renders a control gated on admin standing. It takes no admin flag; an admin action on a package's surface is the app's, offered through the app's affordance.

**Why.** An inline admin control looks like a member action. One page offers it and the next one doesn't, and every screen that gates on admin standing is one more place where that gate can drift away from the one owner. When a package carries an admin control, every app that installs it gets an admin action outside its admin affordance.

**Prohibits.**
- An admin action rendered outside the admin area other than through the admin-actions affordance; a second admin-actions affordance.
- A read of admin standing outside the admin area that is not a reviewed entry for navigation, viewing reach, or the admin's inbox.
- A React package component, prop, or config field that shows, hides, or enables a control on admin standing.

**References.** RULE-STD-ENG-002, RULE-STD-ENG-006; RULE-STD-ARCH-201; RULE-STD-BACKEND-004, RULE-STD-BACKEND-011; RULE-STD-FRONTEND-001, RULE-STD-FRONTEND-110.
