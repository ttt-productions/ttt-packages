# Callable and Backend Functions Playbook

## Purpose

One local, AI-run audit of Cloud Functions callables, HTTP functions, triggers, and scheduled jobs —
verifying secure inputs, the authentication and authorization boundary, App Check posture, rate
limits, secrets, transaction integrity, response payloads, safe error surfacing, and negative-path
test coverage against the shared rules. Steps 1–11 cover `functions/src`; step 12 covers the
attestation posture of the app's privileged request handlers outside the callable boundary
(RULE-STD-BACKEND-012); step 13 closes the secret boundary from the other side. Methodology only;
the per-step contract, boundary, and verdict are [README.md](README.md)'s.

It is NOT a rulebook, NOT a design doc (the app's callable-validation and Functions architecture
design docs explain the system), and NOT a findings log. Async depth → `async-workflow-playbook.md`;
auth and rules depth → `auth-boundary-playbook.md` — where a step touches that depth it is a tripwire
that points at the owning audit.

**Boundary notes.** Deployed secret-binding verification is a hosted check and runs only under DJ's
authorization in the app's own CI/CD audit. No step runs a full gate: step 10 judges test coverage
against the repo's one gate rather than re-running it.

## When to run

Before launch; after adding or changing any file under `functions/src/**`; before exposing a new
public callable or webhook; after a package adoption that touches an auth, schema, or audit shape.

## Audit Steps

### 1. Inventory the function surface
**Rules:** the app's Functions architecture design doc (surface enumeration; feeds
RULE-STD-BACKEND-303, RULE-STD-BACKEND-307, and every step below). **Scope:** `functions/src`.
```bash
rg -n "export const \w+ = (onCall|onRequest|onDocumentCreated|onDocumentUpdated|onDocumentWritten|onObjectFinalized|onSchedule)" functions/src -g '*.ts' -g '!*.test.ts'
```
**Expected:** each entry point enumerated — name, kind, options (region, `concurrency`, `invoker`,
`enforceAppCheck`, `secrets`), and downstream writes. This inventory scopes steps 2–11 and verifies no
rule on its own; there is nothing to PASS or FAIL until a later step tests it. The privileged request
handlers are inventoried in step 12.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 2. Authentication first; identity is proven, not supplied
**Rules:** RULE-STD-BACKEND-001, RULE-STD-BACKEND-005. **Scope:** `functions/src`. Deep →
`auth-boundary-playbook.md`.
```bash
rg -l0 "onCall\(" functions/src -g '*.ts' -g '!**/__tests__/**' -g '!*.test.ts' | xargs -0 -r rg --files-without-match "assertAuth\("
rg -n "request\.data\.(userId|ownerId|createdBy|actorId|senderId)" functions/src -g '*.ts' -g '!*.test.ts'
```
**Expected:** the first command lists only the documented pre-auth exceptions (the app's additions
name them); any other is a RULE-STD-BACKEND-001 violation. `assertAuth` establishes identity before
any resource read, write, or business logic (a harmless schema parse may precede it). Every identity
field the second grep prints is verified equal to `request.auth.uid`, or resolved through the
explicit admin actor, before use (RULE-STD-BACKEND-005).
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 3. Untrusted input is schema-validated before use
**Rules:** RULE-STD-BACKEND-002, RULE-STD-ARCH-102. **Scope:** `functions/src`.
```bash
rg -l0 "onCall\(" functions/src -g '*.ts' -g '!**/__tests__/**' -g '!*.test.ts' | xargs -0 -r rg --files-without-match "\.parse\("
rg -n "as \w+Input|request\.data as|if \(typeof request\.data|interface \w+Input" functions/src -g '*.ts' -g '!*.test.ts'
```
**Expected:** every `onCall` that reads `request.data` parses it with its `.strict()` schema from
`<APP_DATA_PACKAGE>` and flows the parsed result, never raw `request.data`, to its core. A callable
that never reads `request.data` has nothing to parse and is an expected hit of the first command; any
file there that does read it is the violation. Every second-grep hit is a backend-only core input
type or a post-parse cast — never a wire schema restated as an interface beside its schema (use
`z.infer`), and never a cast standing in for validation. Every constraint the schema library can
express lives in the schema. **Semantic review — parse → write:** a user-typed text field's schema is
its `<APP_DATA_PACKAGE>` text-field declaration, and the core writes exactly the parsed value — no
second trim, no late blank check, no bound of its own. A text that becomes a path segment is followed
through every input that carries it, and a value read back from storage is judged again by its
declaration before a path is built or a write lands.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 4. Authorization after auth; resource check inside the transaction
**Rules:** RULE-STD-BACKEND-003, RULE-STD-BACKEND-004, RULE-STD-BACKEND-116. **Scope:**
`functions/src`. Deep → `auth-boundary-playbook.md`.
```bash
rg -n "input\.isAdmin|parsed\.isAdmin|token\?\.isAdmin|token\.isAdmin|actorIsAdmin" functions/src -g '*.ts' -g '!*.test.ts'
```
**Expected:** after the `assertAuth` floor, each write core reads the permission-owning document
INSIDE the transaction it writes in and throws `permission-denied` before any write — a pre-flight
read, a check, then a transaction write is the RULE-STD-BACKEND-003 TOCTOU violation. Each
admin-claim hit is metadata only (passed to the audit writer or stored), never an authorization
branch (RULE-STD-BACKEND-004). The app's additions carry its resource-scoped authorization helpers
and their retired-authority tripwires.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 5. Abusable surfaces ride the one rate-limit adapter
**Rules:** RULE-STD-BACKEND-013, RULE-STD-BACKEND-307, RULE-STD-BACKEND-106. **Scope:**
`functions/src`.
```bash
<GUARD_SUITE> -t "every rate-limit charge names its own preset"
```
**Expected:** every surface class RULE-STD-BACKEND-013 names carries a deliberate rate-limit
decision — through the canonical limiter, or an in-file decision naming its primary defense — and
every limiter call goes through the one app adapter, never the raw provider SDK
(RULE-STD-BACKEND-307). Each charge spends its own surface's bucket: the guard is green, and a new
callable needing its own window gets its own preset, never a sibling surface's bucket. An abusable
surface with no decision is the finding. An app with no request limiter records the override its
rulebook states (the app's additions name it).
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 6. App Check posture is deliberate on every public function
**Rules:** RULE-STD-BACKEND-010. **Scope:** `functions/src`.
```bash
<GUARD_SUITE> -t "every callable declares its App Check posture"
rg -n "invoker:\s*['\"]public['\"]" functions/src -g '*.ts' -g '!*.test.ts'
```
**Expected:** the guard is green: every `onCall` sets `enforceAppCheck: true` — the client-attestation
boundary beneath `assertAuth`, never a substitute for it — and every allowlisted exemption carries
its justification. A callable that omits it needs a documented reason (a webhook is `onRequest` and
verifies its own signature instead). `invoker: 'public'` is normal client-invoked HTTPS, not an auth
bypass. A debug attestation token is local and CI only and never reaches a deployed config, secret,
or bundle.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 7. Secrets come from the secret manager, and every consumer binds them
**Rules:** RULE-STD-BACKEND-307. **Scope:** `functions/src`, local source only.
```bash
<GUARD_SUITE> -t "every Cloud Function binds exactly the secrets it consumes"
```
**Expected:** the guard is green — every entry point whose handler or options consume a
`defineSecret` value declares it in its own `secrets: [...]`. The same guard checks the inverse
direction (step 13); read this one run for both. No secret value exists in source: secrets are read
from the secret manager, never an env file or source; the app's additions carry its secret-literal
search patterns and their known non-findings.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 8. Multi-doc writes are atomic or durable; retryable handlers are idempotent
**Rules:** RULE-STD-BACKEND-101, RULE-STD-BACKEND-302, RULE-STD-BACKEND-304. **Scope:**
`functions/src`. Deep → `async-workflow-playbook.md`.
```bash
rg -n "runTransaction|writeBatch|\.batch\(\)" functions/src -g '*.ts' -g '!*.test.ts'
```
**Expected:** multi-document writes commit in one transaction or batch (every read before any write),
or ride the durable outbox when the work is required for correctness — never a best-effort
post-commit block for must-complete work. Re-deliverable handlers are idempotent. Semantic: for each
multi-write handler, trace what persists if write 2 fails after write 1.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 9. Errors surface safely and monitor through the adapter
**Rules:** RULE-STD-ENG-009, RULE-STD-QUALITY-101, RULE-STD-QUALITY-102, RULE-STD-QUALITY-106.
**Scope:** `functions/src`. Deep → `observability-playbook.md`.
```bash
rg -n "from '@sentry/node'|Sentry\.(withScope|captureException)" functions/src -g '*.ts' -g '!*.test.ts' -g '!functions/src/test/**'
rg -n "throw new HttpsError" functions/src -g '*.ts' -g '!*.test.ts'
```
**Expected:** the first grep is zero — every function captures through `@ttt-productions/monitoring-core`'s
`withScope`, never the raw SDK; the exclusion globs matter, because a mocked `withScope` in a test reads
exactly like a real capture. A test that asserts a capture installs the app's monitoring recorder
seam, never a local mock of the monitoring package. User-facing errors throw `HttpsError` with a safe,
non-leaking code and message; unexpected failures are captured, never swallowed. Logs and captures
carry operation context — operation, ids — never secrets, raw tokens, or a full external payload.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 10. Negative-path and audit tests exist
**Rules:** RULE-STD-QUALITY-001, RULE-STD-BACKEND-202, RULE-STD-BACKEND-204. **Scope:**
`functions/src`.
```bash
# Coverage indicator — onCall modules with no sibling spec at all:
for f in $(rg -l "onCall\(" functions/src -g '*.ts' -g '!*.test.ts'); do [ -f "${f%.ts}.test.ts" ] || echo "NO SPEC: $f"; done
```
**Expected:** this step judges coverage, not green/red. Each `NO SPEC:` line is classified: a thin
adapter whose core is tested elsewhere is fine; a sensitive-action callable is a coverage gap. Each
sensitive-action spec covers missing auth, invalid input, unauthorized caller, and success — plus,
where relevant, duplicate or retry, the rate-limit branch, and a dependency failure; a happy-path-only
spec is the violation. Every sensitive callable asserts exactly one audit event of the expected shape
on success and a failure event on the refusal paths it logs. A defect fix ships a regression test
that fails before the fix. The app's additions name its sensitive-action folders for the depth
check.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 11. What a callable RETURNS is a boundary too
**Rules:** RULE-STD-BACKEND-105, RULE-STD-BACKEND-108, RULE-STD-ENG-006. **Scope:** `functions/src`.
Firestore cannot hide fields, so the rules layer compensates with audience buckets; a callable can
hide fields, which makes it the one place a raw document spread leaks server-only state past every
other control.
```bash
rg -n "\.\.\.[A-Za-z_$]*[Dd]ata\b|\.\.\.\w+\.data\(\)" functions/src -g '*.ts' -g '!*.test.ts'
```
**Expected:** each whole-object spread is classified: a spread into a stored document or an internal
argument is out of scope here; **a spread of document data into a callable's returned value is the
finding shape**. Sample every callable that reads a private, server-only, or provider-reference
document: each returns a deliberate named projection listing the fields that cross the boundary,
never the document whole. A callable returning a named subset records which fields cross.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 12. Attestation posture on the privileged request handlers
**Rules:** RULE-STD-BACKEND-012, with RULE-STD-BACKEND-010, RULE-STD-BACKEND-308, RULE-STD-ENG-006.
**Scope:** the app's privileged request handlers outside the callable boundary (the app's additions
name them). They are not `onCall`s and inherit none of step 6. **Method (semantic review).**
**Expected:** an explicit attestation decision is recorded for each handler, so "no attestation" is a
decision rather than an omission, and attestation is reached through the one shared guard module,
failing closed. **The two finding shapes:** a handler re-implementing part of the shared guard
locally, and an environment-gated relaxation on anything but the sanctioned emulator flag
(RULE-STD-BACKEND-308) — a build mode is never a security gate. Authentication and attestation cover
different threats; neither substitutes for the other. A deliberate divergence is stated in the
handler's design doc; silence is the violation.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 13. Declared secrets are actually consumed — the inverse of step 7
**Rules:** RULE-STD-BACKEND-307, RULE-STD-ENG-006. **Scope:** `functions/src`, local source only.
```bash
# Step 7 already runs the guard; read its over-declared findings from that run.
rg -n "secrets: \[" functions/src -g '*.ts' -g '!*.test.ts' | wc -l
```
**Expected:** no over-declared finding — an entry declaring a secret nothing in its import closure
consumes mounts the value for no reason and grows the blast radius of a leak and the redeploy set of a
rotation. The import closure over-approximates what an entry calls, which is why it is sound only as a
negative claim: a secret consumed nowhere in an entry's closure cannot be consumed by it. The
correction drops the name from the entry's `secrets: [...]`. The one legitimate exception is a value
read by an installed package rather than app source; it is a reviewed entry in the guard's config
with its reason, and a first entry there is itself a reviewable event.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

## Pass / Fail

Per [README.md](README.md) § Verdict. **FAIL** — a callable can be abused anonymously, spoof identity
or ownership, corrupt data on retry, or expose secrets or private data.
