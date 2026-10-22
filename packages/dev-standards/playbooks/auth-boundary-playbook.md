# Auth Boundary Playbook

## Purpose

One local, AI-run audit of whether identity, role, ownership, admin standing, membership, and App
Check boundaries are enforced in the backend and rules layers — not only in the UI. The backend is
every privileged surface the app has: its Cloud Functions (steps 1–11), its privileged request
handlers and server modules outside the callable boundary (step 12), and any separately deployed tree
that verifies what another tree mints (step 13). Methodology only; the per-step contract, boundary,
and verdict are [README.md](README.md)'s.

It is NOT a rulebook (the shared rules own every must/never), NOT a design doc, and NOT a findings
log. Callable input, rate-limit, and secret mechanics → `callable-functions-playbook.md`; deep
client-write coverage → `client-write-security-audit-playbook.md`; rules depth →
`firestore-storage-rules-playbook.md`.

**Boundary notes.** Every check is an `rg` over local source, a local review of the rules files, or a
local emulator test. The rules test (step 10) needs the user-started emulators; without them it is
`NOT RUN`.

## When to run

Before launch; after modifying a rules file, the admin-authority resolver, a claim-setting function,
or any callable or request handler; before enabling admin workflows, role or status changes,
payments, messaging, reports, voting, or media processing.

## Audit Steps

### 1. Entry-point matrix
**Rules:** RULE-STD-BACKEND-001; the app's Functions architecture design doc. **Scope:**
`functions/src`.
```bash
rg -n "export const \w+ = (onCall|onRequest|onDocumentCreated|onDocumentUpdated|onDocumentWritten|onObjectFinalized|onSchedule)" functions/src -g '*.ts' -g '!*.test.ts'
```
**Expected:** for each entry point record — auth required, role or standing required, App Check
posture (`enforceAppCheck`), rate limit, writes performed, and whether identity comes from
`request.auth.uid`. This matrix scopes steps 2–11; an entry missed here silently voids the checks that
range over it. The privileged request handlers have their own inventory in step 12, and any other
verifying tree in step 13.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 2. Callables reject missing auth; identity is not client-supplied
**Rules:** RULE-STD-BACKEND-001, RULE-STD-BACKEND-005. **Scope:** `functions/src`.
```bash
rg -l0 "onCall\(" functions/src -g '*.ts' -g '!**/__tests__/**' -g '!*.test.ts' | xargs -0 -r rg --files-without-match "assertAuth\("
rg -n "request\.data\.(userId|ownerId|createdBy|actorId|senderId)" functions/src -g '*.ts' -g '!*.test.ts'
```
**Expected:** the first command lists callables that never call `assertAuth` — documented pre-auth
exceptions only (the app's additions name them); any other user-impacting callable that does not
reject missing auth is a RULE-STD-BACKEND-001 violation. Any trust in a payload identity, owner,
role, or membership field without a server lookup or an equality check against `request.auth.uid` is
a RULE-STD-BACKEND-005 violation — identity is proven, never asserted by the payload.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 3. Public callable exposure is deliberate
**Rules:** RULE-STD-BACKEND-001, RULE-STD-BACKEND-010. **Scope:** `functions/src`.
```bash
rg -n "invoker:\s*['\"]public['\"]" functions/src -g '*.ts' -g '!*.test.ts'
rg -n "enforceAppCheck" functions/src -g '*.ts' -g '!*.test.ts'
```
**Expected:** every public invoker has an explicit reason, an `assertAuth` check where the action
needs identity, a rate-limit decision where abusable, and an App Check decision. `invoker: 'public'`
on an `onCall` is normal client invocation, not an auth bypass. App Check enforcement is
RULE-STD-BACKEND-010 (`enforceAppCheck: true` on every `onCall`, held by the repo-guards `appCheck`
guard). A public function with no App Check and no signature verification of its own is the exposure
to flag.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 4. Admin authority is explicit and server-side
**Rules:** RULE-STD-BACKEND-004, RULE-STD-BACKEND-205, RULE-STD-BACKEND-111. **Scope:**
`functions/src` — the admin-authority resolver, the claim writers, the status writer, and every
admin-task, review, appeal, and config function.
```bash
rg -n "setCustomUserClaims" functions/src -g '*.ts' -g '!*.test.ts' -g '!**/test/**'
rg -n "token\.isAdmin|token\?\.isAdmin" functions/src -g '*.ts' -g '!*.test.ts' -g '!**/test/**'
<GUARD_SUITE> -t "the admin claim is read only by its resolver"
```
**Expected:** admin authority exists only when a callable builds an admin `ActorContext` after
passing `assertAuth(request, { admin })`, with the actor mode (and system role for admin modes) on
every audited action — never a frontend flag and never a bare admin-claim branch. The first grep
prints only the one claim owner, which always merges onto existing claims (RULE-STD-BACKEND-111). The
second prints only metadata reads that feed the audit actor; every authorization branch resolves
admin through the canonical resolver reading the server-side roster. The guard is green. **The
finding is any raw-claim read that drives an `if` or a ternary**, whatever surface it serves.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 5. Firestore rules gate sensitive fields
**Rules:** RULE-STD-BACKEND-109, RULE-STD-BACKEND-201. **Scope:** `firestore.rules`.
```bash
rg -c "allow (write|create|update|delete)" firestore.rules
rg -n "allow (write|create|update|delete)" firestore.rules | rg -v "if false"
```
**Expected:** a regression tripwire. The first command prints a count that moves with the rule blocks
and is not itself the check. The second prints every client write grant that is not `if false`; each
one carries an owner-field check AND a `diff().affectedKeys()` allowlist with every other field
backend-only, or holds its sensitive fields in a separate backend-only document, or the write routes
through a callable (RULE-STD-BACKEND-109, RULE-STD-BACKEND-201), and it re-checks the preconditions
the UI checks. A grant read as normal without that review is the shape this step exists to prevent.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 7. Private / public data split
**Rules:** RULE-STD-BACKEND-105, RULE-STD-BACKEND-108, RULE-STD-BACKEND-206. **Scope:**
`firestore.rules` + the `<APP_DATA_PACKAGE>` document schemas + `src`. **Method (semantic review of
every readable collection's rule block).**
**Expected:** public and signed-in-readable surfaces carry only display-safe projected fields, are
server-mirrored, and are never client-written (RULE-STD-BACKEND-206); private data, payment, report,
moderation, claim, and age fields are never on a readable document (RULE-STD-BACKEND-105) and sit in
the correct audience bucket (RULE-STD-BACKEND-108). A per-document read carve-out inside a bucket's
match block is the exposure shape RULE-STD-BACKEND-108 forbids.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 8. Storage authorization matches the pipeline
**Rules:** RULE-STD-MEDIA-002, RULE-STD-MEDIA-004, RULE-STD-ARCH-001, RULE-STD-ENG-006. **Scope:**
`storage.rules` + the media-processing pipeline.
```bash
rg -n "match /|allow (read|write|create)" storage.rules | head -80
```
**Expected:** clients upload only to the canonical temp-upload path — final paths are backend-owned
(RULE-STD-ARCH-001) — and the rule enforces ownership (the uid segment equals `request.auth.uid`),
the allowed content type, and the size cap the pipeline expects. Processors derive target paths from
the canonical path builders and asset fields from server-side maps, never from client `targetInfo`
(RULE-STD-MEDIA-004). Every other path gates on ownership or membership. A no-login path exists only
as a documented, create-only, attested exception with every read denied (the app's additions name
its exceptions); a new one, or a read grant on one, is the finding.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 9. UI-only gates have a backend twin
**Rules:** RULE-STD-ENG-006, RULE-STD-FRONTEND-106, RULE-STD-FRONTEND-110. **Scope:** `src` + the
enforcing callable or rule.
```bash
# The app's additions add its auth gate's own names to this pattern.
rg -n "emailVerified|isAdmin" src -g '*.ts' -g '*.tsx' -g '!**/__tests__/**'
```
**Expected:** every UI gate — verified email, accepted agreements, admin standing, role or status
checks, disabled buttons, route guards, permission hooks — has an equivalent server-side enforcement
in a callable or a rule; client gating is UX only, through the one auth gate
(RULE-STD-FRONTEND-106). A gated surface with no backend equivalent — a hidden admin button whose
callable would still perform the action — is the violation.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 10. Negative and spoofing tests
**Rules:** RULE-STD-QUALITY-001, RULE-STD-BACKEND-120. **Scope:** the rules tests + `functions` tests.
```bash
npm run test:rules
npx vitest run --root functions
```
**Expected:** green (the rules run needs the user-started emulators, else `NOT RUN`). Coverage exists
for non-owner writes, member vs non-member, each admin tier, spoofed owner fields, anonymous reads,
and stale custom claims. Every rules test builds its environment through the app's one rules-test
harness against an isolated test project — never a real project id — and seeds fixtures through
`withSecurityRulesDisabled` with no access assertion inside it (RULE-STD-BACKEND-120). Add any missing
negative test before sign-off.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 12. Privileged request handlers — the second privileged boundary
**Rules:** RULE-STD-BACKEND-012, with RULE-STD-BACKEND-002, RULE-STD-BACKEND-005,
RULE-STD-BACKEND-010, RULE-STD-BACKEND-013, RULE-STD-BACKEND-308, RULE-STD-ARCH-106,
RULE-STD-ENG-006. **Scope:** the app's request handlers and server modules that hold Admin-SDK
privilege outside the callable boundary (the app's additions name the trees). Step 1's matrix cannot
see them: no `assertAuth`, no `enforceAppCheck` option, and no callable audit contract reaches them.
**Method (inventory + semantic review).**
**Expected:** every privileged handler is listed, and for each: its authentication mechanism, its
attestation posture, its rate-limit decision, the Admin-SDK writes it performs, and the audit events
it emits — each held to the callable bar or with the divergence stated in its design doc. The general
obligations are RULE-STD-BACKEND-012's: a strict schema parse before any value is used (a TypeScript
`as` cast is not validation); identity and targets derived server-side, never read from the payload;
the attestation its design names enforced through the one shared guard module, failing closed; and a
relaxation gated only on the sanctioned emulator flag (RULE-STD-BACKEND-308), never on a build mode.
**The findings:** a handler that re-implements part of the shared guard locally, a check gated on
anything but the sanctioned flag, and a raw body value reaching a privileged write.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 13. Cross-tree verifiers fail closed and share one definition
**Rules:** RULE-STD-ARCH-005, with RULE-STD-ENG-006, RULE-STD-BACKEND-010. **Scope:** every tree that
verifies a token, grant, or signed request another tree mints, and the shared package that defines
the contract (the app's additions name its trees). An app with one deployed tree records `NOT RUN`.
**Method (semantic review per verifier).**
**Expected:** the minting side and the verifying side import the ONE shared definition of the
contract; no tree re-implements the signing or verification primitive the shared package provides. A
malformed, mistyped, expired, or unsigned token is a refusal, never a partially-trusted claim set;
the scope claim is enforced, not merely present (a grant for one resource cannot serve another); and
the mint and trust sides move in the same change set with a test that proves the PAIR — two per-tree
tests of the halves separately do not satisfy RULE-STD-ARCH-005. A verifier that treats an empty
payload as "no claims, continue" is the fail-open shape this step exists to catch.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 14. The session's identity never outlives an account switch
**Rules:** RULE-STD-ENG-009, RULE-STD-FRONTEND-108. **Scope:** `src` + the installed
`@ttt-productions/auth-core`.
```bash
rg -n "claimsLoading|claims\?\.isAdmin|claims\.isAdmin" src -g '*.ts' -g '*.tsx' -g '!**/__tests__/**'
rg -n "redirectKey|saveRedirectPath|readRedirectPath|clearRedirectPath" src node_modules/@ttt-productions/auth-core/dist -g '*.ts' -g '*.tsx' -g '*.js' -g '!**/__tests__/**'
```
**Expected:** claims reach the app only through auth-core's `useAuth()`, which derives them from a
claims read keyed to the signed-in user plus a generation, so a late read for one account never pairs
with another. A decision that must not guess (a maintenance takeover, an admin page, an acceptance
gate) reads `claims` together with `claimsLoading` and waits while they load; one that decides from
`claims` alone during a load is the finding. The post-login redirect is saved only for a visitor's
deep link and cleared on an observed signed-in → signed-out transition; an app-side write of the
redirect key is the finding. Interleavings to walk: account A's claims refresh resolving after B
signed in; a sign-out on a protected route followed by B's sign-in.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

## Pass / Fail

Per [README.md](README.md) § Verdict. **PASS** — every sensitive action is authorized server-side or by
strict rules, negative tests cover spoofing, and public data is intentionally public. **FAIL** —
privilege, status, payment, membership, moderation, or private-data access depends only on the UI or
on client-provided identity.
