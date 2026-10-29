# Backend — background work & external effects

Shared rulebook — format, IDs, scope, placeholders, and app layering: [../README.md](../README.md).

Post-commit effects, durable async obligations, concurrency, idempotency, scheduled-job isolation,
callable naming, notifications, emulator-only behavior, and external-service boundaries. Read with
[core-rules.md](core-rules.md).

### RULE-STD-BACKEND-301 — Post-commit side effects are non-blocking
**Scope.** apps

**Rule.** Work after the main commit (a celebration post, Storage cleanup, an Auth update) sits in its own `try/catch`, logs and captures to monitoring (RULE-STD-QUALITY-101), and the callable returns success regardless. The greppable marker comment sits directly above every such block:

```
Post-commit side effect (non-blocking) — see engineering-rules RULE-STD-BACKEND-301.
```

The block is AWAITED: a `void`-ed or otherwise unawaited call is not a side effect at all — nothing captures its failure, and Cloud Functions throttle the instance's CPU once it has answered, so the work may never run. A write composed into a caller's transaction is awaited too — a `void`-ed composition loses its rejection, so the transaction commits without that write; no `void` call is sanctioned.

**Why.** The primary state already committed — failing the callable now tells the client a lie.

**Prohibits.**
- Throwing inside the post-commit catch; a missing marker comment; a catch that logs without capturing.
- Folding post-commit work into the transaction "to make it atomic."
- Required-for-correctness work in a post-commit block (see RULE-STD-BACKEND-302).
- A `void`-ed or unawaited write or core call (`void ref.create(record)`, `void writeAudit(actor, { …, transaction })`) anywhere in a callable, trigger, or worker.

**References.** RULE-STD-ARCH-002 (thin entry adapters); RULE-STD-ENG-009; RULE-STD-BACKEND-302.

### RULE-STD-BACKEND-302 — Required work commits atomically or rides a durable outbox
**Scope.** apps

**Rule.** Work that MUST complete for correctness either commits inside the primary transaction/batch or is enqueued to the established durable outbox/queue/retry mechanism — never a post-commit best-effort block. Payments, email, and push need the outbox designed BEFORE shipping. A record that says the work is done — a terminal status (`completed`, `retired`, `restored`, `resolved`), a manifest's done flag, a success audit, a "filed" answer — is written only after, or atomically with, every effect it records; while an effect can still fail, the record stays non-terminal (or names the failed leg) so the retry path re-drives it. A trigger whose work must succeed sets `retry: true` and is written to survive the re-fire (RULE-STD-BACKEND-304).

**Why.** A best-effort block silently drops required work when it throws; the primary action reports success while the obligation is lost. A terminal record written before its effects turns one failed effect into a permanent lie — a manifest read complete while its effects never landed — and nothing ever re-drives it.

**Prohibits.**
- Required-for-correctness work in a post-commit best-effort block.
- Shipping a must-complete async obligation without a durable outbox/retry.
- A terminal status, done flag, or success audit committed before the effects it claims; a failed effect swallowed after its record went terminal.
- A must-succeed trigger with `retry: false`.
- A comment promising the work "can be retried" with nothing that retries it.

**References.** RULE-STD-QUALITY-104; RULE-STD-ENG-009; RULE-STD-BACKEND-301, RULE-STD-BACKEND-304.

### RULE-STD-BACKEND-303 — Cloud Functions concurrency is explicit on every heavy function
**Scope.** apps

**Rule.** The Gen-2 platform default is **80** concurrent requests per instance whenever the function has a full CPU (and `cpu` defaults to 1 for ≤2GB memory) — a function with NO `concurrency` line is an 80-concurrency function, not one-at-a-time.

- **Memory-heavy / long-running / cascade / batch functions MUST set `concurrency: 1` explicitly** (media processing, ffmpeg/transcode, batch workers, fanout/outbox drains, scheduled sweeps).
- Hot, I/O-bound, stateless callables set `concurrency: 10` (or a deliberate 20) inline in `onCall` options — no per-request module-level mutable state.
- Rarely-hit admin/low-frequency callables may stay unset (default 80) deliberately.

Instance counts move only with a measured reason: a `maxInstances` is raised, and a `minInstances` floor is set, only as a deliberate, measured activation.

**Why.** "Leave it unset and it runs one-at-a-time" is false: one container multiplies its peak memory by every concurrent event it accepts, and a heavy function left at the default runs out of memory under a burst.

**Prohibits.**
- A heavy function with no `concurrency` line; a shared default-config wrapper hiding per-function flags.
- `concurrency > 1` on a function with per-request mutable state or cascade/batch paths.
- A raised `maxInstances` without a measured reason; `minInstances` before a deliberate, measured activation.

**References.** RULE-STD-BACKEND-309.

### RULE-STD-BACKEND-304 — Retried background work is idempotent
**Scope.** apps

**Rule.** Triggers, scheduled jobs, webhooks, and outbox/fanout drains that can be re-delivered are idempotent — a redelivery is a safe no-op, not a double-apply. Use a deterministic id + create-if-absent (`ALREADY_EXISTS` = idempotent no-op), a CAS on a revision snapshot, or a pre-existence read — never an unguarded increment or append. Lifecycle triggers that must not leak on transient failure carry `retry: true` and are written to survive re-fire. Replay safety has four more parts. A retried handler decides from the LIVE state of its source — it re-reads the source doc in its transaction — never from the event's `before`/`after` snapshot, which a late or out-of-order delivery makes stale. The idempotency check runs FIRST, before any cap, gate, or accounting, so already-applied work is recognized instead of re-counted or re-refused. A deterministic id names exactly ONE occurrence: where the same key can legitimately recur (a second review of a resubmitted item), the id carries that occurrence's identity (a generation, a decision id). And an ordered step carries a fence (a version, generation, or decision id): a stale step is dropped, never applied over a newer one, and a receiver's `conflict` answer is never acked as a delivery.

**Why.** Gen-2 Eventarc does not redeliver on a thrown error, so must-succeed triggers set `retry` — and retry means the handler runs again; a non-idempotent handler double-charges, double-notifies, or leaks a reservation. Replays also arrive late and out of order: a redelivered older event can restore a state a newer one removed, a cap can count the retry's own evidence, and a second legitimate occurrence can fail as a duplicate of the first.

**Prohibits.**
- An increment / append / reservation write in a retryable handler with no idempotency guard.
- Assuming a trigger fires exactly once.
- A retried handler that writes its event's `before`/`after` data as the new state, or acts without re-reading its source's live state.
- A cap, gate, or counter evaluated before the idempotency check; a deterministic id reused for a second legitimate occurrence.
- Applying a stale step over a newer one; acking a `conflict` as delivered.

**References.** RULE-STD-ENG-009; RULE-STD-BACKEND-302, RULE-STD-BACKEND-306.

### RULE-STD-BACKEND-305 — Callable names reveal their Firestore effect
**Scope.** apps

**Rule.** Every callable that performs a write uses a verb prefix matching its effect: `create*` (new doc / new ID), `update*` (modifies an existing doc in place), `delete*` (removes a doc or well-defined state), `submit*` (sends to a reviewed surface — a submission, an appeal), `admin*` (the `adminOverride` twin of a normal callable, sharing one `runX` core — RULE-STD-BACKEND-004); the app's addition lists any further sanctioned verbs. One callable per action: never combine distinct actions behind a `kind`/`type` discriminator. Once `<HOLDS_LIVE_DATA>` is yes, deployed callable names are frozen.

**Why.** The name tells a reader the blast radius before they open the file; a discriminator-multiplexed callable hides it and bypasses the one-owner model.

**Prohibits.**
- A new multi-operation callable; a new callable multiplexing distinct actions on a `kind`/`type` field.
- A verb prefix that doesn't match the Firestore effect; a normal callable becoming an override on a claim.
- Renaming a deployed callable once `<HOLDS_LIVE_DATA>` is yes.

**References.** RULE-STD-BACKEND-004; RULE-STD-ENG-011.

### RULE-STD-BACKEND-306 — Notifications: sanctioned lanes, one ledger and materializer
**Scope.** apps

**Rule.** Notifications use one notification system whose backend creation lanes are exactly the sanctioned lanes the app's addition lists, and clients never write notification documents. Every lane writes its occurrences to one delivery ledger, atomically with the product write that causes them (or as an idempotent create from the trigger that does), and one materializer is the SOLE global queued/orphan/retry materializer over that ledger. An inline delivery attempt after the commit never substitutes for the durable ledger row. The app's notification policy (type catalog, per-type config, audience resolution) lives in `<APP_DATA_PACKAGE>`; `@ttt-productions/notification-core` stays generic — it only ever sees uids + payload.

**Why.** A parallel sender, worker, ledger, or config source drifts and silently drops or double-sends notifications; a delivery attempted inline with no durable row is lost the first time it fails.

**Prohibits.**
- A creation lane the app's addition does not list; a second/parallel worker, ledger, materializer, or config source.
- An inline post-commit delivery attempt standing in for the durable ledger row.
- A client write to any notification delivery/active document.

**References.** RULE-STD-ENG-003; RULE-STD-BACKEND-302, RULE-STD-BACKEND-304, RULE-STD-BACKEND-310.

### RULE-STD-BACKEND-307 — External services bind through one app adapter
**Scope.** apps

**Rule.** Each external service (payments, rate-limit store, media moderation, monitoring, and every other third-party API) is configured, monitored, and policy-bound through ONE app-side adapter; call sites use the adapter, not the raw SDK/primitive. The canonical adapter list lives in the app's RULE-STD-QUALITY-102 addition — one list, not two. Secrets come from the platform's secret manager — never env files or source.

**Why.** Scattered raw-SDK call sites duplicate config, monitoring, and policy and drift apart; one adapter is the single change point.

**Prohibits.**
- Importing an external SDK/primitive directly at a call site when an adapter exists.
- Secrets in env files or source.

**References.** RULE-STD-ENG-004; RULE-STD-QUALITY-102 (monitoring-agnostic packages); RULE-STD-ARCH-201.

### RULE-STD-BACKEND-308 — Emulator-only bypasses gate on the sanctioned emulator flag; no development-mode security bypass
**Scope.** apps

**Rule.** A behavior that differs in the emulator gates strictly on the sanctioned emulator flag — one set only by local emulator tooling, never by any deployed environment — and ships no dead prod code path. A security check is NEVER bypassed by a development-mode branch or any dev/emulator shortcut outside this sanctioned pattern. The app keeps the list of its emulator-only behaviors, privately; an unlisted one is a defect.

**Why.** A development-mode security bypass is a known escalation pattern — if it can reach prod, it disables the check in prod.

**Prohibits.**
- A development-mode branch (or any non-sanctioned flag) bypassing a security check.
- An emulator bypass whose flag could be truthy in a deployed environment.

**References.** RULE-STD-ENG-006; RULE-STD-BACKEND-012; RULE-STD-ARCH-209.

### RULE-STD-BACKEND-309 — A scheduled job isolates its passes and its rows
**Scope.** apps

**Rule.** A scheduled job, sweep, or drain that runs independent passes gives each pass its own try/catch with capture, so one pass's throw never skips the next. Within a pass, a per-row loop isolates each row — its own try/catch, or its own transaction whose failure is recorded on the row — so one poison row never stops the rows behind it, and a row that keeps failing leaves the window (backoff, a failure marker, dead-letter) instead of pinning the head of an oldest-first query (RULE-STD-BACKEND-112). The job's summary reports each pass's own outcome, never success for a pass that threw.

**Why.** One try around two independent passes lets a throw in the first silently skip the second, stranding everything it would have released; and one persistently failing row, first in its query order, aborts every run at the same row.

**Prohibits.**
- Independent passes of one job sharing one try, so the first pass's throw skips the rest.
- A per-row loop where one row's throw ends the pass for every row behind it; a failing row that stays at the head of the window forever.
- A job summary that reports a pass as done after it threw.

**References.** RULE-STD-BACKEND-112 (progress), RULE-STD-BACKEND-302; RULE-STD-QUALITY-104; RULE-STD-ENG-009.

### RULE-STD-BACKEND-310 — A user-visible lane's first event has a signal
**Scope.** apps

**Rule.** A lane that delivers something to a member — a thread, a message, a decision, an invite — signals its FIRST event the way it signals the events after it: the write that creates the member-visible item co-writes the member's notification occurrence(s) on a sanctioned lane (RULE-STD-BACKEND-306) in the same transaction or batch, one per recipient the lane addresses (the user, or every active member of the group it addresses), idempotent on the occurrence's deterministic id so a retried creation writes none twice. The occurrence carries a type and wording that are true for a first event.

**Why.** A thread whose opening message writes no notification while every later reply does is found only when the member happens to open it — and a warning nobody sees is not a warning.

**Prohibits.**
- A creation path for a member-visible item that writes no notification while the lane's later events do.
- A first-event occurrence written outside the creating transaction or batch, or one a retried creation writes again.
- Signalling a first event with a later event's type or wording ("An admin has responded" for a thread's opening message).

**References.** RULE-STD-BACKEND-306, RULE-STD-BACKEND-304.

### RULE-STD-BACKEND-311 — A Functions deploy group fits the platform's per-minute budget
**Scope.** apps

**Rule.** No Functions deploy group (codebase) holds more than 55 functions, and a release deploys its groups one at a time with a pause between, deploying the group a moving function enters before the group it leaves.

**Why.** The platform allows 60 function mutations per minute per project and region, the deploy CLI changes every function of a group it deploys at once, and a create that hits the limit is dropped while the deploy still reports success; a moving function's old group deployed first deletes it until its new group lands.

**Prohibits.**
- A codebase holding more than 55 functions.
- One deploy that changes several codebases at once.
- A move between codebases deployed source-first, or functions moving both ways in one release.

**References.** RULE-STD-BACKEND-303; the app's Functions architecture and release pipeline design docs; repo-guards' `codebaseManifest` guard and `deployFunctionsInPasses`.
