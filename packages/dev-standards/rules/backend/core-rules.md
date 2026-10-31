# Backend core rules — authentication & authorization

Shared rulebook — format, IDs, scope, placeholders, and app layering: [../README.md](../README.md).

**This file is read in full whenever a task routes to backend** — callables, privileged route
handlers and server modules, triggers, schedules, data-writing scripts, Firestore/Storage writes or
rules, auth, audit, money, or moderation. These rules sharpen RULE-STD-ENG-006 (the backend is the
security boundary) for the backend. The app's own backend rules, additions, and overrides live at
the same-named files in its `docs/engineering-rules/backend/`.

**The three topic files are conditional — read one only when the work touches its topic:**

- [firestore-storage-and-transactions.md](firestore-storage-and-transactions.md) (100s) — a
  Firestore or Storage read/write, transaction/batch, index, or a `firestore.rules` /
  `storage.rules` change.
- [sensitive-writes-and-audit.md](sensitive-writes-and-audit.md) (200s) — money, moderation,
  roles/status/claims, an admin action, a repair, or an audit event.
- [background-work-and-external-effects.md](background-work-and-external-effects.md) (300s) —
  post-commit effects, triggers/schedules/workers, an outbox/queue/retry path, notifications, or an
  external service.

### RULE-STD-BACKEND-001 — Authentication boundary: `assertAuth` first, canonical hostname
**Scope.** apps

**Rule.** Every callable establishes identity through the app-local `assertAuth(request, requirements)`, wired once from `createAssertAuth<TUser>` in `@ttt-productions/auth-core/server`, and rejects missing or insufficient authentication before any business logic, resource read, or write runs. Auth is not coupled to parse order — a harmless schema parse (RULE-STD-BACKEND-002) may precede or accompany it — but nothing happens for an unauthenticated caller. The canonical public origin is `<CANONICAL_ORIGIN>`; all metadata, action URLs, payment and OAuth callbacks, attestation domains, and release URLs use it, and every other host permanently redirects to it. Links and callbacks are derived through one shared URL helper from the app's one configured public-site-URL variable — never a host written into source or derived from the incoming request.

**Why.** Anything the client can send, an attacker can send without the UI; a non-canonical origin silently breaks auth cookies, callbacks, and CSP, and a host taken from the request lets the caller choose where a link points.

**Prohibits.**
- Inline `request.auth` / `email_verified` / status / admin checks in callable bodies.
- Importing `assertAuth` from the package outside the wiring file; new generic auth primitives duplicating it.
- Any resource read, write, or side effect before authentication is asserted.
- Hardcoded non-canonical origins in source, config, or secrets; a host derived from the incoming request.
- A URL assembled from string fragments at a call site.

**References.** RULE-STD-FRONTEND-106 (the client gate half); RULE-STD-BACKEND-002.

### RULE-STD-BACKEND-002 — Schema-validate untrusted input before use
**Scope.** apps

**Rule.** Every `onCall` callable parses `request.data` with its Zod schema before the value is used, and the parsed result (never raw `request.data`) flows to the `run*` core. Schemas are `.strict()`, live in `<APP_DATA_PACKAGE>`'s schema entries composed from shared atoms (or a package's `./schemas` subpath), and express every constraint Zod can — presence, type, enum, length, `discriminatedUnion`, `z.literal(true)` for consent fields. Validation order is independent of the auth check (RULE-STD-BACKEND-001): a parse before or alongside auth is fine, but an unauthenticated caller still triggers no business logic.

**Why.** Ad-hoc `typeof`/truthy checks drift and miss cases; one strict wire schema is the single boundary check shared by every current and future client.

**Prohibits.**
- `as FooInput` casts, or `if (!data.foo)` / `if (typeof data.foo …)` in place of schema fields.
- `interface FooInput` declared alongside a schema (use `z.infer`); `.passthrough()` without an explaining comment.
- Per-callable input schemas defined locally in `functions/src/`, backend-only shapes included.

**References.** RULE-STD-ENG-005; RULE-STD-ARCH-101; RULE-STD-BACKEND-001.

### RULE-STD-BACKEND-003 — Resource authorization inside the transaction
**Scope.** apps

**Rule.** The callable entry takes the caller from `request.auth.uid` through `assertAuth` (RULE-STD-BACKEND-001) and hands the core an actor built from it, from which the core derives `callerUid`; the input's identity fields are never the check. A core that writes a resource reads the permission-owning doc **inside the same transaction** it writes in and throws `permission-denied` on mismatch, before any write — group-scoped resources through the app's scoped-authorization rule, user-owned resources through their stored owner field (`userId` / `createdBy.uid`).

**Documented exception.** When authorization is a global claim with no per-resource permission model, the wrapper's `assertAuth(request, { admin: <the app's admin options> })` is the sole boundary — only when the resource has no ownership/membership field AND the write path is structurally gated upstream.

**Why.** A pre-flight check outside the transaction is a TOCTOU hole — the permission doc can change between check and write.

**Prohibits.**
- Pre-flight auth checks outside the transaction; trusting input identity fields as the check.
- A core that takes the caller from anywhere but the actor its entry built from `request.auth.uid`.
- Admin-claim booleans as authorization branches (RULE-STD-BACKEND-004); skipping the check on "safe" idempotent actions.

**References.** RULE-STD-BACKEND-004; RULE-STD-BACKEND-116 (every other write precondition).

### RULE-STD-BACKEND-004 — Admin authority is explicit; the claim is metadata
**Scope.** apps

**Rule.** Admin authority exists only when a callable constructs an `adminReview` / `adminOverride` actor context after passing `assertAuth(request, { admin })` — the resolved system role reaches the actor at the wrapper boundary, with no second auth call. The admin claim is recorded as metadata only. An action both a member and an admin can perform uses the twin-callable pattern — `updateX` (`<MEMBER_ACTOR_MODE>`) + `adminUpdateX` (`adminOverride`) sharing one `runX(input, actor, …)` core that branches on `actor.mode`. A normal callable never becomes an override because the caller happens to hold a claim.

**Optional admin is still resolved admin.** The same holds when admin is not REQUIRED but OPTIONAL — a wrapper that admits any caller and merely widens a read-only projection for an admin. That "is this caller an admin?" question is answered ONLY by the app's one admin-authority resolver, which reads the authoritative roster, at the wrapper boundary. A raw admin-claim read is prohibited anywhere in backend code outside that resolver and the one allowlisted reader that copies the claim into audit metadata and never branches on it.

**Why.** Conflating "holds an admin claim" with "is acting as an admin override" is how privileged actions get performed without the deliberate authority check and correct audit attribution. A token claim is also up to an hour stale, so a demoted admin's token still carries the claim — a projection that widens on the claim keeps serving admin-only data after the demotion.

**Prohibits.**
- The admin claim (or its audit-metadata copy) as an authorization branch.
- A normal callable escalating on a claim; resolving admin authority anywhere but the wrapper boundary.
- A raw claim read (member access, bracket access, or destructuring it off a token) in backend code outside the admin-authority resolver and its one allowlisted metadata reader.
- A privileged callable gated only on a route guard or a hidden UI control.
- An error message claiming an authority the code does not enforce.

**References.** RULE-STD-BACKEND-205; RULE-STD-BACKEND-011.

### RULE-STD-BACKEND-005 — Identity fields must match the authenticated caller
**Scope.** apps

**Rule.** A callable that accepts `actorId`, `userId`, `createdBy`, `senderId`, or any identity field verifies it equals `request.auth.uid`. When the operation legitimately acts for a different identity (admin-on-behalf), the caller is authorized through the explicit admin actor (RULE-STD-BACKEND-004) — never by trusting the supplied field.

**Why.** A client that can name the actor can impersonate any user; identity must be proven, not asserted.

**Prohibits.**
- Writing a client-supplied uid without the equality check.
- Deriving "who did this" from the payload instead of `request.auth.uid` / the constructed actor.

**References.** RULE-STD-ARCH-106 (client-supplied fields); RULE-STD-BACKEND-004.

### RULE-STD-BACKEND-010 — Callables enforce App Check attestation
**Scope.** apps

**Rule.** Every `onCall` callable sets `enforceAppCheck: true` in its options, so only the genuine first-party app — attested through the platform's attestation provider in deployed environments — can invoke it. App Check attests the CLIENT and is layered beneath `assertAuth` (RULE-STD-BACKEND-001), which attests the USER; both hold independently and neither substitutes for the other. An App Check debug token is a bypass for local runs, CI, and the app's hosted end-to-end harness, and never reaches a deployed environment's config, secret, or client bundle; a deployed app's own clients attest only through the real provider. The hosted harness may present a debug token registered on the dev project only, held in the harness's own untracked environment and set only in the browser pages the harness drives; at least one harness engine stays on the real provider every run, so real attestation stays proven. No debug token is ever registered on the production project.

**Why.** Without App Check, anyone holding a stolen ID token or a leaked callable name can hit the backend directly, bypassing the app; attestation is what keeps the callable surface first-party-only. A debug token shipped in a deployed bundle disables that protection in the open. A hosted harness run for hours gets its browser profiles scored as bots by the attestation provider, which throttles them; a dev-only token in the harness's own pages keeps long runs going, and the engine left on the real provider keeps proving that real attestation still works.

**Prohibits.**
- A new `onCall` callable omitting `enforceAppCheck: true` without a documented reason.
- An App Check debug token in any deployed-environment config, secret, or bundle.
- A debug token registered on the production project, or a hosted-harness token read anywhere but the harness, set anywhere but the pages the harness drives, or used on every harness engine at once.
- Treating App Check as a substitute for `assertAuth` (or vice-versa) — attestation is not authentication.

**References.** RULE-STD-BACKEND-001; RULE-STD-ENG-006.

### RULE-STD-BACKEND-011 — Admin capability is self-sufficient; never coupled to a participant status
**Scope.** apps

**Rule.** An admin acting in review/support capacity reaches and executes every admin capability on the admin claim/actor ALONE. A client mount chain never hides an admin-gated control behind a participant-status gate (a creator capability, a group membership or standing, an account type), and a server path that serves an admin never asserts a participant status ahead of — or instead of — its admin branch. Participation gates are untouched: an admin gets NO bypass to create, join, hold a stake, or otherwise act AS a participant; this rule covers review/support reachability only.

**Why.** An admin-only support action that mounts only for participants, served by a projection that asserts participation first, exists only while the admin coincidentally holds that status. Works-by-coincidence authority disappears silently the day the coincidence breaks.

**Prohibits.**
- An admin-gated control nested inside a participant-gated mount with no admin-reachable route to the same capability.
- A callable serving admin review/support that rejects a non-participant admin via a participant assert.
- "The current admin happens to hold that status" as a justification for the coupling.

**References.** RULE-STD-BACKEND-004 (admin authority is explicit); RULE-STD-ENG-006; RULE-STD-FRONTEND-106.

### RULE-STD-BACKEND-012 — Privileged route handlers and server modules carry the callable obligations
**Scope.** apps

**Rule.** A route handler or server module that accepts request input while holding Admin-SDK privilege is a backend entry point, not app wiring, and carries the callable obligations: it parses untrusted input with a strict Zod schema composed from `<APP_DATA_PACKAGE>` definitions before the value is used (RULE-STD-BACKEND-002); it derives identity and target locations server-side rather than from the payload (RULE-STD-ARCH-106, RULE-STD-BACKEND-005); and it enforces the attestation its design names, failing CLOSED on each check, through the ONE shared guard module that owns those checks rather than a per-route re-implementation — before it reads the request body, with a body its authentication must cover read within a byte budget first (RULE-STD-ARCH-005). Any environment-gated relaxation of one of those checks gates strictly on the sanctioned emulator flag (RULE-STD-BACKEND-308); a build mode is never a security gate.

**Why.** These entry points sit OUTSIDE the callable boundary — some accept no ID token at all — so there is no `assertAuth`, no App Check option flag, and nothing behind them to catch what they let through. A build-mode relaxation disables the attestation everywhere the build is not exactly production — a preview, a hosted dev deploy, a misconfigured start — in precisely the surfaces that hold no ID token.

**Prohibits.**
- Using raw request-body values without the schema parse, or trusting a client-supplied identity/target/ownership field.
- Dropping an attestation check on a privileged route without its design doc stating why; a per-route copy of the shared guard.
- A build mode, a development helper, or any non-emulator flag gating a security check in a route handler or server module.

**References.** RULE-STD-BACKEND-002, RULE-STD-BACKEND-005, RULE-STD-BACKEND-010 (the callable halves); RULE-STD-BACKEND-308 (the sanctioned emulator gate); RULE-STD-ARCH-005, RULE-STD-ARCH-106; RULE-STD-ENG-006.

### RULE-STD-BACKEND-013 — Named surface classes carry a rate-limit decision
**Scope.** apps

**Rule.** Five entry-point classes carry a deliberate rate-limit decision, made through the app's canonical limiter and recorded in the file: money movement; credential or secret verification and step-up; signed-grant minting; public or pre-auth endpoints (every route reachable with no ID token); and content-write surfaces (RULE-STD-BACKEND-106). Functions code limits through `@ttt-productions/rate-limit-core` wired once in the app with named presets; a route handler, where that Functions-side limiter is not installed, uses the ONE app-side equivalent with its own named presets, which keeps the Functions limiter's failure posture. "No limit here" is a legitimate answer only as an explicit in-file decision naming the primary defense; silence is not a decision.

**Why.** Every one of these classes is a surface where unmetered repetition is the attack itself — brute-forcing a step-up code, farming signed grants, flooding a pre-auth endpoint, draining payment or write budget. Each is added one entry point at a time, so an unlimited surface is never noticed until it is used.

**Prohibits.**
- A new entry point in one of the five classes with neither a limiter call nor a documented decision.
- Charging an unrelated preset's bucket, or constructing a limiter or store primitive at a call site instead of going through the adapter.
- An inline window/max literal at a call site instead of a named preset.

**References.** RULE-STD-BACKEND-307 (one adapter per external service); RULE-STD-QUALITY-102 (the adapter list); RULE-STD-BACKEND-012.
