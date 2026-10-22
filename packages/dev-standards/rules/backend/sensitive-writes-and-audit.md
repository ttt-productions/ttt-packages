# Backend — sensitive writes & audit

Shared rulebook — format, IDs, scope, placeholders, and app layering: [../README.md](../README.md).

Rules for money-adjacent, privilege, and moderation state, repairs of completed records, and the
append-only audit log that records them. Read with [core-rules.md](core-rules.md).

### RULE-STD-BACKEND-201 — Sensitive state is backend-owned
**Scope.** apps

**Rule.** Sensitive state — privilege flags, role/status claims, money-adjacent fields, moderation decisions, admin-curated fields — is never written from the client. Sensitive writes go through Cloud Function callables that validate preconditions server-side and use the Admin SDK. What counts as sensitive: if a user or admin does it and someone could later ask "who did this, when, and why did we let them?", it's sensitive — privilege changes, money (every payment event, purchase, or refund), moderation decisions, admin actions affecting another user, and content submitted to a reviewed surface. Usually not sensitive: a user's own post/comment/message, follow/unfollow, and profile edits that don't affect privileges or money. When in doubt, treat it as sensitive. The app's addition lists its sensitive state.

**Why.** Anything the client can write, an attacker can write without the UI; sensitive state must be enforced and recorded server-side.

**Prohibits.**
- `updateDoc(userRef, { role })` / `{ status }` / `{ banned }` — any client write to a role/status/money/moderation field.
- A Firestore trigger that branches on a client-writable field to perform a sensitive side effect.

**References.** RULE-STD-ENG-006; RULE-STD-BACKEND-109; RULE-STD-FRONTEND-107.

### RULE-STD-BACKEND-202 — The audit event commits atomically with the action
**Scope.** apps

**Rule.** Every callable performing a sensitive action calls the app's audit writer before returning success, in the SAME batch/transaction as the state change — the writer derives the actor mode, system role, actor uid, admin metadata, and the request origin from the actor context (RULE-STD-BACKEND-211). If the commit fails, neither the action nor its event persists: no action without its audit event, no audit event without its action. A request that changes nothing writes nothing — adding a standing already held, removing one already absent, restoring what is already restored returns without a state write, a version bump, a fanout, or an audit event. New event-type strings are added to the audit event-type union in `<APP_DATA_PACKAGE>` (past-tense, dotted namespace) — never a local type file, never `type: string` — and the design doc for a new sensitive action names its audit event type and payload shape.

**Why.** An audit write outside the action's atomic commit can drift from it — a committed action with no event, or an event for an action that rolled back. An event recorded for a no-op is the same false record from the other side: a "…Changed" audit with identical before and after, plus a fanout and a version bump for nothing.

**Prohibits.**
- Writing the audit event outside the action's batch/transaction.
- A local audit event-type definition; a non-exhaustive `type: string`.
- A write, version bump, fanout, or audit event for a request that changed nothing.

**References.** RULE-STD-BACKEND-101; RULE-STD-BACKEND-211; RULE-STD-ENG-009.

### RULE-STD-BACKEND-203 — Audit events are append-only
**Scope.** apps

**Rule.** No one updates or deletes an audit event — not even an admin, and not a backup, restore, or migration path. If an event is wrong, write a compensating manual-intervention event explaining it. The client SDK never touches the audit collection (rules deny all client reads and writes); only the Admin SDK writes, via callables. Because an event outlives every edit and every erasure, its payload records identifiers, field names, lengths, and decisions — never user-authored text (a title, a description, a body, a caption, a narrative, a message). An admin's own decision reason is not user content and may be recorded; any further text an app records is listed in its addition, and member text stays forbidden there too.

**Why.** A mutable audit log is not forensically sound — its whole purpose is an immutable record of decisions. The same permanence makes it the wrong home for anything a member wrote: text copied into an event survives the member's own edit and their account erasure.

**Prohibits.**
- `update` / `delete` on an audit event doc; rewriting history instead of writing a compensating event.
- A backup, restore, or migration path that rewrites audit documents.
- Any client-SDK read or write of the audit collection.
- User-authored text in an audit payload — an authoring event records the changed field names and their lengths, never the prose.

**References.** RULE-STD-BACKEND-202, RULE-STD-BACKEND-211.

### RULE-STD-BACKEND-204 — Log failed sensitive attempts
**Scope.** apps

**Rule.** When a sensitive action is rejected at auth/authorization, write a failure audit (`{ result: 'failure', failureReason: '...' }`) that records the actor and the target alongside the reason. A failure audit is best-effort by nature — the refusal stays the caller's answer — so it goes through the audit core's failure entry points: one that takes the actor context, and, for a refusal made before any actor context exists, one that takes the caller and origin from the request and records only a deliberate refusal (a fault the gate threw is not an attempt). Both never throw, and both log and capture a write that failed.

**Why.** Recording rejected attempts catches probing that would otherwise be invisible. A failure audit swallowed with `.catch(() => undefined)` vanishes with no log and no capture — the probe goes unrecorded and nobody learns the audit write is failing; one that keeps only the error cannot say who probed what.

**Prohibits.**
- Silently rejecting a sensitive attempt with no failure audit on the paths you chose to log.
- Recording only the error and dropping the actor or the target.
- A `.catch(...)` chained onto an audit write; a second local "best-effort audit" helper.

**References.** RULE-STD-BACKEND-202, RULE-STD-BACKEND-211; RULE-STD-QUALITY-102 (the audit adapter).

### RULE-STD-BACKEND-205 — Every audited action declares its actor mode explicitly
**Scope.** apps

**Rule.** Every audited action declares its actor mode (`'user' | <MEMBER_ACTOR_MODE> | 'adminReview' | 'adminOverride' | 'system'`); admin modes also declare the system role from the app's admin role union — both compiler-enforced at the write-helper call site. Attribution goes through the audit writer with an actor context built at the entry from the authenticated request; cores derive `callerUid = actor.uid ?? ''`. The admin claim is metadata, never authority (RULE-STD-BACKEND-004).

**Why.** Without an explicit mode, "an admin happened to do this" is indistinguishable in the record from "an admin override superseded normal permission"; an actor the payload names is whoever the caller says it is.

**Prohibits.**
- A missing actor mode, or a system role present on a non-admin mode / absent on an admin mode.
- A core that accepts a bare actor-uid (+ system role) pair for attribution instead of an actor context.
- An actor copied from `request.data`.
- Naming anyone but the caller who acted as the event's actor — a displaced holder or the action's subject belongs in the payload, never in the actor fields.

**References.** RULE-STD-BACKEND-004, RULE-STD-BACKEND-005, RULE-STD-BACKEND-211.

### RULE-STD-BACKEND-206 — Projections and moderation cascades are server-owned
**Scope.** apps

**Rule.** A projection or read model — a public mirror of a private document, a denormalized listing, a derived summary — is written only by the backend path that writes its source, and the rules deny the client write path to it outright. A cascade that changes derived documents because a source changed (a moderation hide and its restore among them) is server-owned the same way: it runs in the backend path that owns the source, never from a client. The app's addition names its projections and its cascade rules.

**Why.** A client-written projection drifts from its source and corrupts the derived read model that every reader trusts; a cascade a client can start or skip leaves moderation state that no source explains.

**Prohibits.**
- A client write to a projection or read-model collection; a rules grant that leaves one client-writable.
- A projection written by any path but the one that writes its source.
- A cascade run from the client, or split from the source write that requires it.

**References.** RULE-STD-BACKEND-102 (the full-recompute mirror is outside it); RULE-STD-BACKEND-114; RULE-STD-ARCH-001.

### RULE-STD-BACKEND-209 — No Partial<T> sensitive mutations
**Scope.** apps

**Rule.** A mutation that writes sensitive state accepts a known, named set of fields — never `Partial<FullUser>` or a generic `{ userId, data: Partial<T> }` forwarded to `updateDoc`. If a new field must be writable, add a new named mutation.

**Why.** A generic partial shape lets a caller smuggle a sensitive field into an otherwise-innocent mutation.

**Prohibits.**
- `Partial<T>` / generic `data` shapes forwarded to a sensitive write.

**References.** RULE-STD-BACKEND-109; RULE-STD-FRONTEND-107.

### RULE-STD-BACKEND-210 — An account holding admin standing is never restricted
**Scope.** apps

**Rule.** An account whose uid is on the admin roster is never restricted — banned, or given any other restricting account status — through any writer, for every caller, the automated paths included. The one account-status writer reads the roster inside its status transaction, so a concurrent roster change conflicts with it instead of racing it, and refuses with a failure audit (RULE-STD-BACKEND-204) and a `failed-precondition` whose details name the refusal. Taking the role away goes through the roster's own writer, never a status action, and that writer never leaves the roster with no full admin. The UI offers no restricting action for an admin-standing account (RULE-STD-FRONTEND-110). The app's addition lists its restricting actions and any part of an automated path that still applies.

**Why.** A ban that goes around the roster's guard can disable the one account able to undo it, with no in-product fix.

**Prohibits.**
- Restricting an admin-standing account through any writer, or a second account-status writer that skips the roster check.
- Deciding the refusal from a roster read outside the status transaction.

**References.** RULE-STD-BACKEND-116, RULE-STD-BACKEND-204; RULE-STD-FRONTEND-110.

### RULE-STD-BACKEND-211 — One audit writer; an event's origin comes from the request
**Scope.** apps

**Rule.** Every audit event document is written by the app's one audit core, through its entry points (the success writer and the failure writers of RULE-STD-BACKEND-204) — never by a direct Firestore write, a second wrapper of `@ttt-productions/audit-core`, or a writer in another tree. No caller passes an event's address or user agent: a person-actor carries the origin of the request it acted through, read once by the one origin reader from the address the platform records for the request (never a value the caller can set), set on the context at authentication and copied by the actor constructors; person-actors are built only by those constructors. Every event a person-actor writes keeps that origin — member or admin, success or refusal — so each recorded action proves where it came from; only a `system` actor, which acted through no request, records none. Any exception an app allows is listed in its addition. No sign-in waits on a Cloud Function: no Identity Platform blocking function is deployed, because the platform refuses a sign-in whose blocking function misses its time limit and a cold start alone can exceed it.

**Why.** When each call site has to pass the address itself, some recorded decisions carry no address or device while their refusals do; a record of who acted from where cannot depend on every caller remembering to supply it.

**Prohibits.**
- A write to the audit collection (by its collection constant, its path builder, or a path string), or an import of `@ttt-productions/audit-core`, outside the core.
- Passing an address or user agent to an audit write; reading the raw request for its origin anywhere but the one origin reader; trusting a caller-settable value as the origin.
- An event written for a person's request that drops its address or device.
- A person-actor object built outside the actor constructors.

**References.** RULE-STD-BACKEND-202, RULE-STD-BACKEND-203, RULE-STD-BACKEND-204, RULE-STD-BACKEND-205.

### RULE-STD-BACKEND-212 — Repair actions record a reason and the state they replaced
**Scope.** apps

**Rule.** An admin action that changes a completed record — reopen, any `recalculate*`, backfill, a data migration, a backup restore, a bulk delete — requires a caller-supplied reason and records the prior state alongside the new one: which documents it touched, what the affected aggregates were before, and what they became. Repair actions are audited even when they are idempotent. Rebuilding a derived copy from an untouched source is not a repair of a completed record: the source record does not change, so it takes no reason, and its writer still follows RULE-STD-BACKEND-206. An app that exempts any other action from the reason does so only as an explicit override, and that action's audit event still records who did what.

**Why.** A repair that replaces an aggregate destroys the only evidence of what the record used to say, so a wrong one is indistinguishable afterward from a legitimate correction.

**Prohibits.**
- A repair callable with no required reason argument.
- Replacing an aggregate without recording the value it replaced.
- Treating "the numbers can be recalculated" as a substitute for recording the change.

**References.** RULE-STD-BACKEND-202; RULE-STD-BACKEND-114 (repair scripts); RULE-STD-FRONTEND-202 (the dialog gathers the reason).
