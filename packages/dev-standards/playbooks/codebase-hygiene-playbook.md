# Codebase Hygiene Playbook

## Purpose

One local, AI-run integration audit of an app (with `<PACKAGES_REPO>` in scope where a step says so).
It finds architectural drift, duplicate ownership, unsafe boundaries, stale contracts, UI
inconsistency, and missing structural enforcement — verifying the codebase still obeys the shared
rules. It is the reference implementation of the per-step contract; the contract, the boundary, the
command traps, the enforcement ladder, and the verdict are [README.md](README.md)'s.

It is NOT a rulebook, NOT a design doc, NOT a human runbook, and NOT a findings log. Deep security,
rules, media, observability, accessibility, and async audits live in their own playbooks; where a
step here touches that depth it is a short tripwire pointing at the owning audit. Other docs cite these
steps by number, so a surviving step is never renumbered and a deleted step's number is never reused.

**Guards.** Most steps here are backed by a build-failing repo-guards guard. A step names a guard by
its id and runs it alone with `<GUARD_SUITE> -t "<its title>"`; the step's Expected never restates
what the guard proves, and a guard is never loosened to get green. The app's own business guards are
named in its additions.

## When to run

After any change touching a swath of code; before launch as the final once-over; after a major
package adoption; quarterly once live.

## Area index

A step can protect more than one area; overlap is intentional.

- **Architecture:** 9, 10, 12, 16–18, 25, 31, 35, 38, 41, 51, 52, 55, 61, 63, 64, 80, 83, 96, 99
- **Backend:** 10, 13, 20, 21, 23, 29, 32, 33, 36, 40, 49, 50, 56, 67, 77, 80, 87, 97, 98, 102, 105,
  107, 108, 111, 112, 121
- **Frontend:** 1–3, 7, 15, 17, 21, 28, 35, 36, 57, 60, 65, 66, 68, 82, 91, 99, 101, 103, 104, 114,
  121
- **Media:** 4–6, 11, 14, 37, 39, 53, 58, 59, 83
- **Quality / documentation:** 25, 27, 28, 30, 40, 42, 46, 63, 69, 73, 75, 88, 89, 90, 95, 117–120

## Audit Steps

### 1. React Query conventions
**Rules:** RULE-STD-FRONTEND-101, RULE-STD-FRONTEND-102, RULE-STD-FRONTEND-103. **Scope:** `src`.
```bash
# a. Every file using a query hook declares a staleTime somewhere (`|| true`: no file missing is the clean case).
rg -l0 "useQuery\(|useInfiniteQuery\(" src -g '*.ts' -g '*.tsx' -g '!**/__tests__/**' \
  | xargs -0 -r rg --files-without-match "staleTime" || true
# b. Non-preset numeric staleTimes — each carries its justification comment.
rg -n "staleTime:\s*[0-9]" src -g '*.ts' -g '*.tsx' -g '!**/__tests__/**' -g '!src/test/**'
# c. useEffect wrapped around a Firestore call:
rg -n -A4 "useEffect" src -g '*.tsx' -g '!**/__tests__/**' | rg "getDoc\(|getDocs\(|onSnapshot\("
# d. Read-derived state held beside a query (pager cursor/page/has-next):
rg -n "const \[\w*([Pp]age|[Cc]ursor|hasMore|HasMore)\w*\s*," src -g '*.ts' -g '*.tsx' -g '!**/__tests__/**'
```
**Expected:** (a) prints no file. (b) every hit is the app's QueryClient-wide default or a per-query
number carrying a comment that says WHY the `STALE_TIMES` presets do not fit — a comment restating the
arithmetic is the finding; the presets come from `@ttt-productions/query-core`, never a re-declared
local map. (c) is zero. Key centralization is the repo-guards `queryKeys` guard (step 63), not
re-grepped here; infinite-feed invalidation is step 2. **Manual clauses:** each `queryFn` is
side-effect-free; (d) each page or cursor hit is a purely local slice of data already loaded, and each
pager consumer reads its page, cursor, and has-next from the keyed result — state kept beside the
query, or a second hook instance used to refresh another's page, is the RULE-STD-FRONTEND-101 finding.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 2. Domain-event invalidation enforcement
**Rules:** RULE-STD-FRONTEND-103, RULE-STD-FRONTEND-102. **Scope:** `src` + `functions/src`.
```bash
<GUARD_SUITE> -t "every core domain-event variant has a registry entry with well-formed invalidations|every domain-event notification hands its refresh promise on"
rg -n "\.invalidateQueries\(" src -g '*.ts' -g '*.tsx' -g '!**/__tests__/**'
```
**Expected:** the guards are green, and every `invalidateQueries` hit is inside the app's one
domain-event registry module. Allowed cache operations outside it are not invalidation: in-place
patches (`setQueryData`, `setQueriesData`, `cancelQueries`, the cache-helper modules), a refetch of a
read that is not an infinite list, and a member's own refresh. **An action never reloads an infinite
list** — a reset, refetch, or remove whose key reaches one, or a cache write trimming a list to its
first page, is the finding outside a member's own refresh (the app's guard for this is named in its
additions). The backend emits domain events only, never query keys. Outside the registry, each cache
helper and each mutation `onSuccess` patch targets a key a query reads, built by the same key builder
the reading hook uses; an infinite list is patched in place; a mutation reconciles every cached view of
the row it changed; and a new row is placed only on a newest-first list, never prepended onto a ranked
one.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 3. Orphaned domain-event registrations
**Rules:** RULE-STD-FRONTEND-103. **Scope:** `src` + `functions/src` + the installed `<APP_DATA_PACKAGE>`.
```bash
<GUARD_SUITE> -t "every registered domain event has a producer in the app"
```
**Expected:** green — each registry key appears outside the registry in the app's own code. The
reverse direction (a producer emitting an unregistered type) is compiler-enforced. On a failure,
classify the dead key: the producer drifted (fix it) or the flow was removed (delete the entry) — never
allowlist a dead key.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 4. Single global upload-processing subscriber
**Rules:** RULE-STD-MEDIA-007. **Scope:** `src`.
```bash
<GUARD_SUITE> -t "no component subscribes to upload processing itself"
```
**Expected:** green — exactly one frontend subscriber to backend upload processing; local upload UI
reads it through the package's per-upload hooks.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 5. Upload hooks consume their variables schema
**Rules:** RULE-STD-MEDIA-005, RULE-STD-MEDIA-006. **Scope:** the app's hooks folder.
```bash
rg -l "useGuardedUpload" src -g '*.ts' -g '*.tsx' -g '!**/__tests__/**'
```
**Expected:** each upload mutation types its variables as `z.infer` of its `<APP_DATA_PACKAGE>`
variables schema and parses them as the `mutationFn`'s first statement. The command selects whole
files, so scope the prohibition to the upload mutation's own variables type — a local type belonging
to a non-upload mutation in the same file is not a finding. A local type that EXTENDS the schema's
inferred shape with app-only fields, still parsing through the canonical schema first, is sanctioned;
one that REPLACES it is the finding.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 6. Canonical upload-contract enforcement
**Rules:** RULE-STD-MEDIA-002, RULE-STD-MEDIA-003, RULE-STD-MEDIA-006, RULE-STD-MEDIA-007. **Scope:**
`src` + `<PACKAGES_REPO>/packages`. Deep → `media-pipeline-playbook.md`.
```bash
rg -n "uploadFileResumable" src <PACKAGES_REPO>/packages -g '*.ts' -g '*.tsx' -g '!**/dist/**' -g '!**/__tests__/**'
rg -n "@ttt-productions/upload-core/react" src <PACKAGES_REPO>/packages -g '*.ts' -g '*.tsx' -g '!**/dist/**'
rg -n "phase:\s*['\"]processing" src -g '*.ts' -g '*.tsx' -g '!**/__tests__/**'
rg -n "processing\.isProcessing" src -g '*.ts' -g '*.tsx' -g '!**/__tests__/**'
```
**Expected:** the low-level resumable primitive has exactly ONE consumer across app and packages — the
guarded upload helper in upload-ui; its definition and doc comments are the other package hits, and an
app-side hit outside a test mock, or a second package consumer, is the violation. Upload-core's React
surface is zero. A local `processing` phase is zero (local phases end at finalizing; processing is
backend-only). Backend processing state never feeds a picker's loading or disabled prop. App-side
upload-guard wiring destructures only the sanctioned members (the imperative navigation confirm, a
read-only in-flight count); hand-rolled register/unregister wiring is the finding. A test referencing
the guarded helper wraps it in the guard provider or mocks the package. The progress callback takes one
argument; the guarded helper emits no terminal progress, so the consuming mutation's success and error
paths each clear it first.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 7. No direct Firestore SDK reads in components
**Rules:** RULE-STD-FRONTEND-104. **Scope:** `src`.
```bash
<GUARD_SUITE> -t "no component or route imports the Firestore runtime"
```
**Expected:** green. The documented exceptions are a read inside a `queryFn` and root-provider
hydration.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 9. Timestamps are epoch-millisecond numbers
**Rules:** RULE-STD-ARCH-105. **Scope:** `src` + `functions/src`.
```bash
<GUARD_SUITE> -t "no Firestore Timestamp is minted with Timestamp.now()"
rg -n "Timestamp\.now|Timestamp\.fromMillis|serverTimestamp\(\)|: Timestamp\b" src functions/src \
  -g '*.ts' -g '*.tsx' -g '!**/__tests__/**' -g '!*.test.ts' -g '!*.test.tsx'
```
**Expected:** the guard is green. Timestamps are `Date.now()` numbers; conversion through
firebase-helpers' `toMillis()` / `formatDate()`; never `FieldValue.serverTimestamp()` or
firebase-helpers' `serverNow()`. **The one exception, stated in its general form:** a field bound to a
declared native-TTL policy is a real `Timestamp`, written with `Timestamp.fromMillis(...)`, named for
its purpose, never the source of a displayed or sorted value, **and its write site names its TTL policy
in a comment** — that comment is the derivation; an enumeration of TTL fields here is prohibited. A
shared factory declaration that only builds such a value writes nothing; follow it to its call sites.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 10. Canonical Firestore path helpers
**Rules:** RULE-STD-ARCH-104, RULE-STD-BACKEND-114. **Scope:** `src` + `functions/src` + `scripts`.
```bash
<GUARD_SUITE> -t "no Firestore path is assembled by hand|no typed path segment reaches a Firestore accessor|no retired Firestore segment survives in a path string"
rg -n "collection\(db,\s*[\"']|doc\(db,\s*[\"']" src functions/src -g '*.ts' -g '*.tsx'
# Data-writing scripts (RULE-STD-BACKEND-114) — Admin-SDK shape; outside the guards' scan.
rg -n "\.collection\([\"']|\.doc\([\"']" scripts -g '*.mjs' -g '*.ts'
```
**Expected:** the guards are green and both greps print nothing. Collection names and paths come from
the `<APP_DATA_PACKAGE>` constants and path builders (the backend wraps segment tuples into a slash
path); a document path assembled from a constant and an id is the same finding as a literal, and a
literal is a violation even when its text equals a constant's value — the guards' allowlists are empty
or reviewed by design. A script is outside the guards' scan, so its grep is its only enforcement.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 11. Canonical Storage path construction
**Rules:** RULE-STD-MEDIA-002. **Scope:** `src` (+ `<PACKAGES_REPO>/packages`).
```bash
# SINGLE quotes are required — in double quotes bash collapses "\$" and rg never matches.
rg -n 'uploads/\$\{' src -g '*.ts' -g '*.tsx' -g '!**/__tests__/**'
rg -n 'uploads/\$\{' <PACKAGES_REPO>/packages -g '*.ts' -g '*.tsx' -g '!**/dist/**'
```
**Expected:** the first prints nothing — temp upload paths come from the `<APP_DATA_PACKAGE>`
temp-path builder. The second prints only that builder's own definition; any other package hit is a
hand-assembled path to migrate or document.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 12. Firestore naming convention
**Rules:** RULE-STD-ARCH-104. **Scope:** `firestore.rules`, `firestore.indexes.json`, the
`<APP_DATA_PACKAGE>` collection constants, new code. **Method (semantic review + one enumeration).**
```bash
# Every single-word collection segment in the rules (`databases` is Firebase's own root segment).
rg -oIN "match /[A-Za-z_]+" firestore.rules | sed 's|match /||' | sort -u | rg -v "[A-Z]"
```
**Expected:** the command prints only `databases`. RULE-STD-ARCH-104 governs COLLECTION names, not
document ids (a singleton document id inside a compound collection is out of scope; step 56 owns
placement), and not Storage object prefixes. Every collection name is compound camelCase; single-word
names are forbidden; subcollections carry context prefixes; id fields use a camelCase id suffix. **No
exceptions** — renaming a live collection is a planned migration, never a loosened Expected. The review
grades only names it can see; the step-10 guards force every segment name back into the constants
where this step sees it.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 13. Callable naming reveals effect
**Rules:** RULE-STD-BACKEND-305. **Scope:** `functions/src`.
```bash
rg -n "export const .* = onCall" functions/src -g '*.ts' -g '!*.test.ts'
```
**Expected:** the verb prefix matches the effect — `create*` / `update*` / `delete*` / `submit*` /
`admin*` and the app's own sanctioned prefixes (its additions name them and any frozen legacy prefix).
Once `<HOLDS_LIVE_DATA>` is yes, deployed names are frozen. **Classifying a discriminant:** it is
sanctioned when its branches are one task's decision set sharing one actor-context and audit spine AND
the callable's own name names the effect; it is the violation when it multiplexes unrelated effects
behind one neutral name.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 14. One media renderer
**Rules:** RULE-STD-MEDIA-101. **Scope:** `src` + every package except the media-viewer package.
Deep → `media-pipeline-playbook.md`.
```bash
<GUARD_SUITE> -t "a stored picture draws only through its renderer owners|no code classifies media from a MIME prefix"
rg -n "from ['\"]next/image['\"]|<img[ />]|<video[ />]|<audio[ />]|<source[ />]|backgroundImage" src -g '*.tsx' -g '*.ts' -g '!**/__tests__/**'
npm run typecheck
```
**Expected:** the guards are green, and every grep hit is the media-viewer package itself or a
live-capture viewfinder — anything else bypasses the app's one renderer around media-viewer. The
renderer's props require a media type, MIME, or name, so a call site that carries none fails the
typecheck (an extensionless serving URL with no type silently renders a download fallback). The value
passed is the server's inspected media kind, never the client-declared MIME stored with the upload.
Feed surfaces keep the viewer's unload-on-exit and metadata-only preload unless the video is the page's
primary content.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 15. CSS token hygiene
**Rules:** RULE-STD-FRONTEND-002, RULE-STD-FRONTEND-003, RULE-STD-FRONTEND-008. **Scope:** `src`.
**Method (semantic review — the literal halves are guards).**
```bash
<GUARD_SUITE> -t "every color in app code and stylesheets resolves through a theme token|every theme token is declared in :root, .dark, and .high-contrast, and high contrast is monochrome|every stack-\*, icon-\*, and spinner-\* class app code uses is declared by a loaded stylesheet|a status foreground is painted only on its own solid status fill"
<GUARD_SUITE> -t "every app box-shadow pairs with an identical --tw-shadow|app code adds no shadow through a Tailwind shadow utility"
```
**Expected:** the guards are green — they own the color-literal half (a hex, a raw `hsl()`/`rgb()`, or a
Tailwind palette class all fail), the three-theme token declaration, the theme scale classes, status
foregrounds, and shadow ownership; this step does not re-grep them. What the review owns: (a) the entry
stylesheet's import order matches RULE-STD-FRONTEND-002; (b) no `className` override on a ui-core
component unless deliberately single-instance; (c) every new component works in every theme; (d) art
rendered on two seats of opposite lightness declares a ladder for each; (e) a new floating surface
wears theme-core's elevation hook and a new card composes the shared card recipe, never a bespoke
shadow; (f) a color value that does not exist yet is added to the brand token sheet first, and that
sheet holds tokens only.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 16. Shared-package alignment (local manifests only)
**Rules:** RULE-STD-ARCH-101, RULE-STD-ARCH-205, RULE-STD-ENG-005. **Scope:** local manifests, lockfile,
and installed `node_modules/@ttt-productions/*` metadata. Never the npm registry without DJ's
authorization (`dependency-audit-playbook.md` owns the published-vs-declared check).
```bash
rg -n '"@ttt-productions/' package.json functions/package.json
```
**Expected:** each declared `@ttt-productions/*` version matches the installed package and the
lockfile. Imported types and constants are the canonical shared shape, never a re-declared local copy;
a backend-only or frontend-only type lives in the app's one types home for its tree with a justifying
comment. An app type that narrows or lists a package union's members derives from that union
(`Extract<…>`, a catalog keyed by it), never a re-typed member list.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 17. Package entry-point and environment safety
**Rules:** RULE-STD-ARCH-202, RULE-STD-ARCH-203, RULE-STD-FRONTEND-102. **Scope:** `src` +
`functions/src`.
```bash
<GUARD_SUITE> -t "each package is imported from the entry point matching the runtime|every package definition is imported from the entry that owns it"
rg -n "@ttt-productions/[^\"']*/react" functions/src -g '*.ts'
rg -n "declare module ['\"]@ttt-productions/" functions/src -g '*.d.ts'
rg -n "from ['\"]@ttt-productions/query-core/keys" src -g '!**/__tests__/**'
```
**Expected:** the guards are green. (1) Functions importing any `/react` surface is SEVERE — it crashes
the emulator on cold start. (2) React runtime symbols come from `/react`; type-only imports and
server-safe constants stay on the main entry. (3) No utility module launders a React runtime symbol
(an `import type` is erased and not a finding). (4) Every bare style specifier has its module
declaration. (5) Every ambient Functions shim has a reason, and is deleted once the package exposes
the symbol server-safely. (6) The query-core keys subpath is reached only by the app's one query-key
module (RULE-STD-FRONTEND-102).
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 18. Frontend↔backend contract alignment
**Rules:** RULE-STD-ARCH-101, RULE-STD-BACKEND-002. **Scope:** `functions/src` ↔ `src`. **Method
(semantic review).**
**Expected:** for every callable processing a client-built payload (media uploads especially), trace
`request.data` field by field against what the client sends. A loosely typed payload field
(`Record<string, unknown>`, `any`) gets a schema in `<APP_DATA_PACKAGE>` pinning both sides. A field
captured by the client and never sent, or sent and never read, is drift.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 20. Audit events on every sensitive action (tripwire)
**Rules:** RULE-STD-BACKEND-202, RULE-STD-BACKEND-203, RULE-STD-BACKEND-204, RULE-STD-BACKEND-205,
RULE-STD-BACKEND-211. **Scope:** `functions/src` (plus scripts and server modules for the one-writer
guard). Deep coverage is in the app's private safety and security audits and
`callable-functions-playbook.md`.
```bash
<GUARD_SUITE> -t "audit documents are written by the one audit writer|person-actors are built only by the actor constructors|no member-written text is copied into an audit payload"
<GUARD_SUITE> -t "no backend work is fired and forgotten, and no audit write is swallowed|no handler is chained onto a failure-audit entry point"
rg -n "rawRequest" functions/src -g '*.ts' -g '!*.test.ts'
```
**Expected:** the guards are green. Cross-reference the audit event type union against every
sensitive callable: the success event in the same batch or transaction as the change; the failure
event, through the audit core's never-throwing entry points, on a refusal path. No call site passes a
request origin — the origin rides the actor, from the request; the `rawRequest` locator prints only
the app's one request-origin reader. Each payload holds ids, field names, lengths, counts, and
decisions only — a member's free text in a payload is the RULE-STD-BACKEND-203 finding (record field
names and lengths). Two review clauses the guards only locate: a core that can receive a no-op request
returns before its write, version bump, fanout, and audit; and every event's actor is the caller who
acted — a displaced holder or subject rides in the payload. An event type nothing writes is classified:
an unaudited action (a finding) or dead vocabulary to remove. No inventory table here
(RULE-STD-QUALITY-202).
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 21. No legacy direct-write bypasses
**Rules:** RULE-STD-BACKEND-201, RULE-STD-FRONTEND-107, RULE-STD-BACKEND-209. **Scope:** `src`. Deep →
`client-write-security-audit-playbook.md`.
```bash
# a. THE GATE — client Firestore write primitives anywhere in the app tree.
rg -n "\b(updateDoc|setDoc|writeBatch|addDoc|deleteDoc)\(" src -g '*.ts' -g '*.tsx' -g '!**/__tests__/**'
# b. Independent and cheap — always run.
rg -n "Partial<Full\w+>" src -g '*.ts' -g '*.tsx' -g '!**/__tests__/**'
```
**Expected:** (a) is zero where the app routes every write through callables — then no client write
can reach a sensitive field, and the first half passes on (a) alone; when (a) is non-zero, run the
app's sensitive-field locator (its additions) and classify each hit for a client write context. (b) a
`Partial<…>` of a full document type forwarded into a client mutation is the violation (add a named
mutation instead).
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 23. No build-mode security shortcuts
**Rules:** RULE-STD-BACKEND-308, RULE-STD-BACKEND-012, RULE-STD-ENG-006. **Scope:** `src` (server modules
and request handlers included) + `functions/src`.
```bash
rg -n "isDevelopment|process\.env\.NODE_ENV.*development|NODE_ENV\s*!==\s*['\"]production" src functions/src -g '*.ts' -g '*.tsx'
```
**Expected:** authentication and authorization never branch on environment. An emulator-only bypass
gates strictly on the sanctioned emulator flag the rule names, ships no dead production path, and is
reviewed and listed where the app lists its emulator quirks (its additions name the place). A predicate
ORing a build mode or a public variable into the emulator flag is truthy in any non-production process,
so it relaxes the check wherever the build is not exactly production — a RULE-STD-BACKEND-012
violation on a privileged handler, not a style issue.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 25. Dead code from finished migrations
**Rules:** RULE-STD-ENG-008, RULE-STD-ARCH-203. **Scope:** `src` + `functions/src` + `e2e`.
```bash
# Top-level exports whose name appears exactly once in the audited trees (a dead-export candidate list).
comm -12 \
  <(rg -oNI '^export (?:async )?(?:function|const|class|type|interface|enum) ([A-Za-z0-9_]+)' -r '$1' src functions/src e2e -g '*.ts' -g '*.tsx' | sort -u) \
  <(rg -oNI '\b[A-Za-z_][A-Za-z0-9_]*\b' src functions/src e2e -g '*.ts' -g '*.tsx' | sort | uniq -c | rg '^ *1 ' | rg -o '[A-Za-z0-9_]+$' | sort -u)
```
**Expected:** a short candidate list, each entry triaged: old direct-write hooks, superseded aliases,
unrendered components, specs targeting removed UI, comments citing deleted docs, and dead transitional
package subpaths (RULE-STD-ARCH-203). Report with a recommendation; DJ decides removal scope. **Know the
limits:** the search is lexical — it sees `export <keyword> Name` only, and a symbol reached only by a
string or dynamic reference, or only from a tree outside the search, looks unused; confirm no importer
before recommending deletion. The repo-guards unused-index-member report (the app's thin script) lists
folder-index members nothing outside the folder imports — drop each, or keep it because the folder's
public surface needs it. `ts-prune` is not a dependency; `npx`-fetching it leaves the local boundary.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 27. Documentation drift
**Rules:** RULE-STD-QUALITY-201, RULE-STD-QUALITY-202, RULE-STD-ENG-008. **Scope:** the app's design
docs (`<DESIGN_DOCS>`). **Method (semantic review + one locator).**
```bash
rg -n -i "not yet built|approved but not yet|status:\s*(proposed|in-progress)|\(planned\)|eventual implementation|will be built" docs/design -g '*.md'
```
**Expected:** for each design doc, spot-check signatures, field names, flows, and callable names against
the code — the code is the truth. Every status marker the command prints is checked: a feature it calls
unbuilt that the code has built (or the reverse) is drift. Where two sections or two docs state one
behavior, they agree — a contradiction is drift even when one side matches the code. Fix only small,
unambiguous mechanical drift, and only when doc editing is authorized; surface substantive
disagreement with a recommended resolution, never silently picking one.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 28. E2E hygiene
**Rules:** RULE-STD-QUALITY-004, RULE-STD-ENG-002. **Scope:** `e2e`.
```bash
# a. Hardcoded URLs.
rg -n "https?://" e2e -g '*.spec.ts'
```
**Expected:** (a) every hit is a documentation comment, a deliberately absolute external URL, or an
emulator-service origin — an in-app navigation or request target comes from `baseURL`. An emulator
origin belongs in the e2e constants module beside its siblings; one typed inline in a spec is the
finding. Every spec that drives a shared lifecycle (admin task checkout, moderation state, role
changes) declares serial mode. `waitForTimeout` is a build-failing guard (step 63), not re-grepped.
**Review clauses:** no assertion whose only evidence is a toast — assert the resulting state; fixtures
over inline UI logins; specs never reseed or clear emulator data; and monitoring is a no-op under the
emulator (the app's inits gate it).
**Retries and caught failures:** `<GUARD_SUITE> -t "no end-to-end retry loop repeats a user action"`
and `-t "no end-to-end action or state read swallows its failure"` pass. Every reviewed entry of
either is an outcome-verified helper's own loop or the polling of a background result, with a why
that says so — a loop or catch kept only because it made a run pass is the finding.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 29. Local config alignment
**Rules:** RULE-STD-BACKEND-010, RULE-STD-BACKEND-307, RULE-STD-QUALITY-008. **Scope:** the app's local
config files only — never a deployed config or hosted lookup.
```bash
<GUARD_SUITE> -t "local-only variables never appear in deployed configuration|the env files a deploy delivers carry public values only"
```
**Expected:** the guards are green: a local-only variable (an emulator flag, a debug attestation token)
never appears in deployed configuration, not even as a secret reference, and every env file a deploy
delivers carries public values only — a tracked env file is graded by its contents, never excused
because an ignore rule exists. Every deployed-config entry is an inline value or a secret-manager
reference. The project mapping and the declared runtime match the app's stated facts (its additions
name the files).
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 30. Entry files are thin and truthful
**Rules:** RULE-STD-QUALITY-205, RULE-STD-ENG-001. **Scope:** the repo's `CLAUDE.md` and `AGENTS.md`. <!-- no-check -->
**Method (semantic review; citation integrity is step 69).**
**Expected:** each entry file is its values block, its own facts (repo map, essential commands,
environment and boundary facts), and its import of the shared base — NOT a duplicated rule catalog, a
duplicated design explanation, or a business-policy inventory. Every value the shared docs' placeholders
need is declared once, in the block. Walk every remaining rule, convention, or do-not line: each is
still true against the code, or removed.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 31. One change point and authoritative owner (semantic)
**Rules:** RULE-STD-ENG-002, RULE-STD-ENG-003, RULE-STD-ENG-004, RULE-STD-ARCH-001, RULE-STD-ARCH-002, RULE-STD-ARCH-003,
RULE-STD-ARCH-004, RULE-STD-ARCH-005,
RULE-STD-BACKEND-111, RULE-STD-BACKEND-306, RULE-STD-MEDIA-001, RULE-STD-FRONTEND-105,
RULE-STD-FRONTEND-010, RULE-STD-ARCH-101, RULE-STD-ARCH-102, RULE-STD-QUALITY-102. **Scope:**
`functions/src` + `src` (plus every other deployed tree for the cross-tree owner check).
This is the main semantic audit of the one-owner principle. Search for parallel implementations, then
inspect **semantics** — a similarly named function is not automatically a duplicate. Verify every
symbol against the current code before asserting a finding.

**Owner checks (minimum; the app's additions add its domain owners):**
- **Notifications (RULE-STD-BACKEND-306):** only the app's sanctioned creation lanes create
  notification work; they converge on one ledger, one materializer, and one config source. A client
  write, a third lane, or a parallel worker, ledger, or config source fails. Topology → step 50.
- **Upload and media (RULE-STD-MEDIA-001):** every intake origin uses the one upload contract and the
  one processing core, except a documented trust-boundary intake. Detail → steps 5, 6, 58.
- **Callable invocation (RULE-STD-FRONTEND-105):** each callable is called through its one declaration.
  Detail → step 60.
- **Business definitions (RULE-STD-ARCH-101/102):** cross-layer schemas, constants, paths, and domain
  definitions come from `<APP_DATA_PACKAGE>`. Detail → step 61.
- **Account-durable preferences (RULE-STD-ENG-002, RULE-STD-FRONTEND-010):** the server document is the
  one authority; browser storage holds only device-local settings with no server field, plus at most the
  sanctioned optimistic mirrors the app's rulebook names.
- **Monitoring (RULE-STD-QUALITY-102):** integrations use the established adapters. Detail → step 40.
- **Cross-tree trust contracts (RULE-STD-ARCH-005):** a header name, token shape, or secret-and-host
  pair shared between separately deployed trees has ONE definition in a shared package every
  participating tree imports, and the test that proves it proves the PAIR.
```bash
# a. Custom claims — one owner (RULE-STD-BACKEND-111).
rg -n "setCustomUserClaims" functions/src -g '*.ts' -g '!**/__tests__/**' -g '!*.test.ts' -g '!functions/src/test/**'
# b. No HTTPS callable composition — the server never calls another callable (RULE-STD-ARCH-003).
rg -n "httpsCallable|getFunctions" functions/src -g '*.ts' -g '!**/__tests__/**' -g '!*.test.ts'
# c. Browser storage never becomes a second authority (RULE-STD-FRONTEND-010).
<GUARD_SUITE> -t "browser storage is touched only through the guarded helper"
rg -n "localStorage|sessionStorage" src -g '*.ts' -g '*.tsx' -g '!**/__tests__/**'
```
**Expected:** (a) prints only the one claim owner. (b) is zero. (c) the guard is green, and every grep
hit is a device-local setting with no server field (keys from the `<APP_DATA_PACKAGE>` storage-key
contract) or a sanctioned mirror; a second browser copy of a server-owned preference is the violation.
Every storage access tolerates a throwing store (a browser that blocks site data throws on the access
itself), and a store other open tabs act on subscribes to the `storage` event. **Triggers and schedules
are thin** — extract input, call the core, return; business logic in a trigger or schedule body is a
violation. A domain-private shared helper is imported only by its owning core.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 32. Resource authorization on writes
**Rules:** RULE-STD-BACKEND-003, RULE-STD-BACKEND-002, RULE-STD-BACKEND-001, RULE-STD-BACKEND-004.
**Scope:** `functions/src`. Deep → `auth-boundary-playbook.md`.
```bash
rg -n "input\.isAdmin|input\.actorIsAdmin|input\.bypass|parsed\.isAdmin" functions/src -g '*.ts' -g '!**/__tests__/**' -g '!*.test.ts'
rg -l0 "onCall\(" functions/src -g '*.ts' -g '!**/__tests__/**' -g '!*.test.ts' | xargs -0 -r rg --files-without-match "request\.auth"
```
**Expected:** for each core — a harmless schema parse may precede the auth check, but the resource read
happens INSIDE the transaction, the caller uid (from `request.auth.uid`, never an input field) is checked
against the permission model BEFORE any write, and failure throws `permission-denied`. A pre-flight read
→ check → transaction write is a TOCTOU violation. The first grep is zero. The second lists callables
never referencing `request.auth` — each checks auth by delegation or is a violation.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 33. Post-commit side effects and durability
**Rules:** RULE-STD-BACKEND-301, RULE-STD-BACKEND-302, RULE-STD-QUALITY-104. **Scope:** `functions/src`.
Deep → `async-workflow-playbook.md`.
```bash
<GUARD_SUITE> -t "no backend work is fired and forgotten, and no audit write is swallowed|no backend read or write has its failure swallowed|every post-commit side effect captures its failure"
# The marker half — comment lines only; everything this prints must be the canonical sentence.
rg -n "\(non-blocking\)" functions/src -g '*.ts' -g '!**/__tests__/**' -g '!*.test.ts' \
  | rg ":[0-9]+:\s*(//|\*)" | rg -v "Post-commit side effect \(non-blocking\) — see engineering-rules RULE-STD-BACKEND-301\."
rg -n "retry:\s*false" functions/src -g '*.ts' -g '!*.test.ts' | rg -v ":[0-9]+:\s*(//|\*)"
```
**Expected:** the guards are green: no fire-and-forget call, no swallowed read or write, and every
marked effect captures and never throws. The marker command prints nothing — every comment-form marker
is the canonical sentence (a prefix or trailing clause on the same line is fine); a different wording is
a marker to normalize. Each `retry: false` trigger is one-shot by design only when a durable backstop
owns its failure; a must-succeed trigger with `retry: false` is the RULE-STD-BACKEND-302 violation. A
comment promising work "can be retried" with nothing that retries it is a violation. **Terminal-record
ordering:** for every job, saga, restore, or removal that records completion, the terminal status or
success audit is written after (or atomically with) every effect it claims; a record that reads done
while an effect failed is the finding. Then sanity-check for unmarked candidates: a try/catch after a
commit either gets the marker or moves required work into the transaction or the durable outbox.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 35. Identity projection and no-snapshot
**Rules:** RULE-STD-ARCH-103, RULE-STD-FRONTEND-108, RULE-STD-QUALITY-007. **Scope:** `src` +
`functions/src`.
```bash
<GUARD_SUITE> -t "every live Firestore subscription is on the reviewed list"
rg -n "onSnapshot\(|subscribe: true" src -g '*.ts' -g '*.tsx' -g '!**/__tests__/**'
# Module-level subscribers or caches that could outlive a sign-out (`|` inside the group, never `\|`).
rg -n "^(const|let) .*=.*(new Map|new Set|onSnapshot|subscribe)" src -g '*.ts' -g '*.tsx' -g '!**/__tests__/**'
rg -n "prev\w*Uid|last\w*Uid|prevUserId" src -g '*.ts' -g '*.tsx' -g '!**/__tests__/**'
```
**Expected:** display identity resolves by uid through the public-user lookups, never from a stored
name or a mention's stored text; no producer writes a display-name snapshot outside an audit-trail
field named as a snapshot. **Live subscriptions:** the guard is green and the grep hits are exactly its
reviewed list — the signed-in user's own documents plus named, inherently real-time surfaces, each with
its reason; a public projection read live is the regression the guard exists to fail, and a new
subscription is reviewed onto the list or removed. **Identity change:** every module-level binding the
third command prints is identity-independent static data; one holding per-user data, a live handle, or a
user-seeded registry is the finding — key it by uid or tear it down on identity change. Every
auth-scoped query key carries the uid (the repo-guards `authScopedKeys` guard). Each component the
`prev…Uid` locator prints runs session-change work and is mounted where it survives the session ending;
a surface that can stay mounted across a direct A→B switch keys its state by uid; a late completion
checks the uid or a generation before it writes current state.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 36. Authentication boundary consistency
**Rules:** RULE-STD-BACKEND-001, RULE-STD-FRONTEND-106. **Scope:** `functions/src` + `src`. Deep →
`auth-boundary-playbook.md`.
```bash
rg -l0 "onCall\(" functions/src -g '*.ts' -g '!**/__tests__/**' -g '!*.test.ts' | xargs -0 -r rg --files-without-match "assertAuth\("
rg -n "from ['\"]@ttt-productions/auth-core/server['\"]" functions/src -g '*.ts' | rg -v "import type|export type"
<GUARD_SUITE> -t "the client has one auth boundary|the signed-in check before an awaited call has one owner"
```
**Expected:** callables missing `assertAuth` are the documented pre-auth exceptions only. Exactly one
VALUE import of auth-core's server entry — the app's one `assertAuth` wiring. An inline
`email_verified` or `request.auth` branch in a callable body, or an admin resolver used INSTEAD of
`assertAuth`, is a violation. On the client, every gated action runs through the one auth gate (its
declarative wrapper or imperative form over the same evaluator); a parallel gate primitive, a redirect
effect standing in for the gate, or a gate that can stay loading forever is the finding. Hostnames come
from the one site-URL helper over `<CANONICAL_ORIGIN>` — never a host written into source or derived
from the request (the app's additions carry its host-literal grep). A client request bound to the
session re-checks the session through its one owner immediately before the call whenever an awaited
hop sits between the gate and the request; a skip is never captured as a failure.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 37. Upload cancellation and navigation guarding
**Rules:** RULE-STD-MEDIA-009, RULE-STD-FRONTEND-205. **Scope:** `src`.
```bash
rg -n "useGuardedUpload\b" src -g '*.ts' -g '*.tsx' -g '!**/__tests__/**'
rg -n "uploadState=" src -g '*.tsx' -g '!**/__tests__/**'
rg -n "beforeunload" src -g '*.ts' -g '*.tsx' -g '!**/__tests__/**'
```
**Expected:** cancel UI lives in the package (no bespoke cancel outside direct `MediaInput` consumers;
a programmatic cancel aborts its controller). Every guarded-upload consumer threads an `AbortSignal`
into the helper. Every `MediaInput` given an upload state also gets its cancel handler. In-app
navigation is guarded app-wide through the one navigation helper (step 82); the package's imperative
confirm remains the sanctioned guard for a dialog close that unmounts an upload surface. `beforeunload`
is zero in app code — the package's guard provider owns it, and the navigation helper passes the
full-page flag for exactly the navigations that unload the page.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 38. Duplicate exported names
**Rules:** RULE-STD-ARCH-203, RULE-STD-ENG-002, RULE-STD-ARCH-004. **Scope:** `src` + `functions/src`.
**Cadence:** a hand-run report, never a gate stage (the judgment is semantic) — run it during a full
audit, after a large feature, before a milestone, and when consolidating an area.
**Expected:** the repo-guards duplicate-exports report (the app's thin script) prints `CLEAN`, with a
count of reviewed groups kept quiet; any reported name is new work. A reviewed name reports again when a
copy appears outside its listed set. Resolve by consolidating onto the owner (cross-tree value
collisions are `<APP_DATA_PACKAGE>` candidates), deleting a dead export, or adding a justified reviewed
entry after classifying it — never by loosening the matching. Re-exports are the `importPaths` guard's
("every definition has exactly one import path"), and one package entry per definition is the
`packageEntries` guard's — neither is reviewed here.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 39. Upload-surface subcomponent ownership
**Rules:** RULE-STD-MEDIA-010. **Scope:** `src` components.
```bash
rg -n "AbortController|useUploadProcessing|useRef<AbortController" src -g '*.tsx' -g '!**/__tests__/**'
```
**Expected:** each hitting file is the focused upload subcomponent itself or a thin leaf wrapping
`MediaInput` directly. A parent holding abort refs, mutation hooks, processing reads, and dialog or form
scaffolding in one render tree is the violation — use the canonical deferred-form shell.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 40. Monitoring-provider abstraction
**Rules:** RULE-STD-QUALITY-101, RULE-STD-QUALITY-102, RULE-STD-QUALITY-106, RULE-STD-BACKEND-013,
RULE-STD-BACKEND-307. **Scope:** `src` + `functions/src`. Deep → `observability-playbook.md`. Generic
packages staying monitoring-agnostic is `package-boundaries-playbook.md` step 2.
```bash
rg -n "from '@ttt-productions/rate-limit-core'|from '@ttt-productions/audit-core/server'|from '@ttt-productions/moderation-core/server'" src functions/src -g '*.ts' -g '*.tsx' -g '!**/__tests__/**'
<GUARD_SUITE> -t "every Cloud Function entry point reports its failures to monitoring|monitoring is initialized once per runtime, only in its adapters|every backend telemetry tag key survives the content policy|every rate-limit charge names its own preset"
```
**Expected:** every hit is a thin app adapter over the generic package, and the adapter set this step
recognizes is the one the app's rulebook names (RULE-STD-QUALITY-102 — one list, not two); a hit outside
it bypasses the adapter. The guards are green: every function is wrapped through monitoring-core's
`withScope`, never the raw SDK; monitoring initializes once per runtime in its adapters; every backend
telemetry key survives the one content policy; every rate-limit charge names its own surface's preset.
**Scrubber coverage:** every monitoring init wires the scrubber for errors and transactions (and replay
where the browser records one), a new init or outbound event type gets the same scrubber and a test
pinning it, and nothing captures before the scrubber is registered.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 41. The app's vocabulary has not leaked into the generic packages
**Rules:** RULE-STD-ARCH-201, RULE-STD-ENG-004. Only the app knows its own vocabulary, so this step is
the app's; every other check of generic package code is `package-boundaries-playbook.md`. **Scope:**
`<PACKAGES_REPO>/packages/*/src`, excluding `<APP_DATA_PACKAGE>`, tests, and builds. Run from the
packages root.
```bash
# The word list is the app's (its additions). `-P` is required for any look-around in it.
rg -niP "<APP_VOCABULARY_PATTERN>" packages/*/src -g '*.ts' -g '*.tsx' -g '*.js' -g '*.jsx' -g '*.css' \
  -g '!**/__tests__/**' -g '!**/dist/**' | rg -v "@ttt-productions/"
```
**Expected:** zero hits in shipped identifiers, paths, policy, or user-facing copy. Doc comments and
fixtures are classified, not auto-failed — an app word in an explanatory comment is a wording fix, while
an app identifier, path, literal, or copy string in shipped code is the RULE-STD-ARCH-201 violation:
reword it generically or move it into app-supplied config. A protocol value on a cross-tree contract
(one definition shared by both sides, RULE-STD-ARCH-005) is a reviewed exception the app's additions
name.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 42. Lazy singletons pair with a test-only reset
**Rules:** RULE-STD-QUALITY-009, RULE-STD-QUALITY-007. **Scope:** `functions/src`.
**Method (semantic review over the app's lazily-built client and cache constructors, in its additions).**
**Expected:** each package constructor that builds a stateful client or cache is called inside a
function body (`getX()`), paired with a test-only `__resetX()` export — eager construction races
`vi.hoisted` mocks. A named exception (its consumers' tests mock the whole package, so no live instance
is built) is recorded at the call site. A constructor with neither shape is the finding.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 46. Rules tests reach the emulator through the ONE harness, never a real project
**Rules:** RULE-STD-BACKEND-120, RULE-STD-QUALITY-001. **Scope:** the app's rules tests.
```bash
rg -n "initializeTestEnvironment|initializeApp\(" -g '*.rules.test.ts' -g '**/rules/**'
```
**Expected:** every rules test builds its environment through the app's one harness, which runs the
rules-unit-testing library against an isolated test project and reads the rules files from disk. A
second environment initialization is duplicated harness code to consolidate; a real project id or a raw
Admin-SDK initialization in a rules test is a violation — a rules test must never be able to touch a
real namespace.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 49. Explicit actor mode; admin claim is metadata
**Rules:** RULE-STD-BACKEND-205, RULE-STD-BACKEND-004, RULE-STD-BACKEND-211. **Scope:** `functions/src`.
Actor-mode presence is compiler-enforced (a discriminated union) — a clean Functions typecheck answers
it.
```bash
<GUARD_SUITE> -t "the admin claim is read only by its resolver|person-actors are built only by the actor constructors"
rg -n "request\.auth.*isAdmin|token\?\.isAdmin|token\.isAdmin" functions/src -g '*.ts' -g '!*.test.ts'
```
**Expected:** the guards are green, and every claim hit is metadata only, read by the actor
constructors. **A raw claim read used as a branch is a violation with NO exception** — including on a
read-only projection that writes nothing; the required mechanism is the canonical admin resolver.
Every admin-mode actor originates at a wrapper that passed `assertAuth(request, { admin })`. **Takeover
provenance:** an event about someone other than the caller names the caller as actor and carries the
other party in the payload; a system or scheduled writer uses the system actor; a worker carrying out a
person's earlier decision uses the deferred-decision actor. A subject's uid in the actor field is the
violation.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 50. Notifications: the sanctioned lanes, one ledger
**Rules:** RULE-STD-BACKEND-306, RULE-STD-QUALITY-104, RULE-STD-BACKEND-304. **Scope:** `functions/src` +
`src`. Deep async → `async-workflow-playbook.md`. **Method (the app's lane locators, in its additions,
+ semantic review).**
**Expected:** the app's sanctioned creation lanes (its rulebook names them) are the only creators of
notification work, each called only by the originating callable or trigger, with the durable row
written atomically with the originating write (an inline post-commit delivery attempt never substitutes
for it). Every lane lands in the one delivery ledger, and one materializer is the sole queued, orphan,
and retry processor; the per-type policy is one config, and a new type without a config entry fails the
typecheck. Clients only read the notification collections, and the rules deny every client write. A
retired sender, a third lane, or a composer writing the ledger directly is the violation; a broadcast
that can be replayed is payload-bound and replay-vs-conflict safe.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 51. Firestore schema registry + local drift
**Rules:** RULE-STD-ARCH-101, RULE-STD-ARCH-102, RULE-STD-BACKEND-115. **Scope:** the app and
`<PACKAGES_REPO>`; the local emulator by default. Hosted comparison → `data-integrity-playbook.md`
under authorization.
```bash
(cd <PACKAGES_REPO> && npm run schema:check)
npm run seed:emulator && npm run drift:check:local   # needs the user-started emulators
```
**Expected:** `schema:check` prints `schema docs are up to date.` (a `STALE:` line means the generated
docs need `npm run schema:docs` in ttt-packages). Every stored document shape is a schema in
`<APP_DATA_PACKAGE>` with its type by `z.infer`, and the registry binds every collection (its
completeness test enforces it). Generated files are never hand-edited. Every invalid document or unknown
field the local drift check reports is resolved. A drift check against a hosted project is outside the
default boundary.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 52. ID-generation standardization
**Rules:** RULE-STD-ENG-005, RULE-STD-BACKEND-102. **Scope:** `src` + `functions/src`.
```bash
<GUARD_SUITE> -t "randomUUID appears only at reviewed sites that mint no document id"
rg -n "from ['\"]uuid['\"]" src functions/src
```
**Expected:** the guard is green and the `uuid` package is absent. Firestore document ids are minted
from the collection reference, never `randomUUID`; every reviewed `randomUUID` site is a non-persisted
operation or request id or a temp path. A client-minted id for a server-written document exists only as
a reviewed create-no-overwrite case; anything else routes through the callable.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 53. Media references and server-side caps
**Rules:** RULE-STD-MEDIA-101, RULE-STD-ENG-006. **Scope:** `src` + `functions/src`. Deep →
`media-pipeline-playbook.md`. **Method (semantic review + targeted search).**
**Expected:** (a) no durable media URL is stored — document schemas hold asset ids, and a stored
storage or CDN URL field is a violation (a genuinely external link is exempt); (b) serving URLs are built
at render time by the canonical builder, with no media host hardcoded outside the builder and its
config; (d) every count cap has a server-side check — a client-only cap is a violation. The app's
additions carry its revocation and mode checks.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 55. No dotted string keys in merge-sets
**Rules:** RULE-STD-BACKEND-104. **Scope:** `functions/src` + `src`.
```bash
rg -n "['\"][A-Za-z0-9_]+\.[A-Za-z0-9_]+[A-Za-z0-9_.]*['\"]\s*:" functions/src src -g '*.ts' -g '*.tsx' -g '!*.test.ts' -g '!*.test.tsx'
```
**Expected:** a dotted key inside a Firestore write payload is in an `update()`; inside a merge-set it
creates a literal top-level field and the nested map never changes — convert to `update()` or a real
nested object. Non-write hits (event types, query keys, config maps) are fine. Mock fidelity: test mocks
expand dotted keys as field paths in a mocked `update()` only, never in a mocked merge-set.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 56. Singleton bucket placement matches audience
**Rules:** RULE-STD-BACKEND-108, RULE-STD-ARCH-104, RULE-STD-ARCH-101. **Scope:** the
`<APP_DATA_PACKAGE>` singletons + `src` + `firestore.rules`. Rules depth →
`firestore-storage-rules-playbook.md`.
```bash
<GUARD_SUITE> -t "every singleton in a client-readable collection names the reader that needs it"
```
**Expected:** the guard is green — every `<APP_DATA_PACKAGE>` singleton in a client-readable bucket
names the client reader that needs that audience. The review owns what the guard cannot see, anchored
on the rules' bucket blocks (never on the package alone): (a) each document sits in the bucket its least
privileged necessary reader calls for; (b) each bucket block has exactly one read condition with no
per-document carve-out, and every write is `if false`; (c) the bucket list and the package reconcile
both ways — a bucket document with no package declaration belongs in the package, and a package
document missing from the bucket's list is the exposure risk.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 57. Async controls show their pending for the full duration; read states never stand in for one another
**Rules:** RULE-STD-FRONTEND-201, RULE-STD-FRONTEND-206, RULE-STD-FRONTEND-202. **Scope:** `src`. Deep
UX → `ux-audit-playbook.md`.
```bash
# a. The build-failing halves — run them, never re-grep them.
<GUARD_SUITE> -t "app code hand-spins nothing|app code imports no hand-placed spinner icon|no app stylesheet hand-spins an element|a status foreground is painted only on its own solid status fill"
<GUARD_SUITE> -t "a render surface that defaults a read binds its failure|a hook never returns a default its consumers cannot tell from data|read failures render only through the read-state module"
# b. Locators for the semantic review below.
rg -n "variables\??\.\w+ ===|\.isPending &&" src -g '*.tsx' -g '!**/__tests__/**' -g '!*.test.tsx'
rg -n "\?\?\s*(false|0)\b" src -g '*.tsx' -g '!**/__tests__/**' -g '!*.test.tsx'
rg -l "fetchNextPage" src -g '*.tsx' -g '!**/__tests__/**' -g '!*.test.tsx'
```
**Expected:** (a) green, plus the app's own guards for retry state and later-page failures (its
additions). (b) classify every hit against what no guard can judge:
- **Props-supplied handlers:** an async action reaching a control through a prop is a promise-returning
  function the control awaits inside its own pending; a `() => void` prop that runs async work has no
  pending and no failure owner.
- **Per-row pending:** each row reads its pending from the shared pending layer keyed by the row,
  never one mutation's `isPending` across rows or `isPending && variables.x === row` (the first locator
  prints zero). A `disabled` on another control's pending is correct only beside a control carrying its
  own pending.
- **Full duration:** a mutation whose result needs a refetch returns or awaits it; a chain of calls and
  any post-action navigation run inside ONE pending action; pending ends on the command's own settled
  outcome, never a timeout.
- **Pending, failed, answered:** a defaulted read branches to loading and to the failure seat BEFORE
  its empty state, a count, or a control that depends on it; an error never renders as an absence, and
  an answered absence never renders as a failure. A `?? false` / `?? 0` coercing an unknown read into an
  answer that offers or hides a control is the finding. A read that answered and then fails keeps its
  answer, and any open editor, on screen with the failure inline. Every read failure offers Try again,
  held on screen with its control pending while it runs.
- **Infinite lists:** with rows on screen, a failed later page keeps them with an inline failure line.
No surface claims success before the backend committed. A label swap may accompany the spinner but is
never the only indicator.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 58. Upload UI ends at handoff; the tray owns processing
**Rules:** RULE-STD-MEDIA-008. **Scope:** `src`. **Method (semantic review of every upload flow).**
**Expected:** (a) every processing-state callback only clears local state, refreshes caches, or updates
an inline status — a callback that closes the flow's UI held the user hostage until terminal and fails;
(b) pending copy and spinners gate on the upload MUTATION's pending, never the backend processing
lifetime; (c) each flow's success path closes its UI and points at the tray or an inline status. An
in-thread placeholder that is a surface's own status (a chat attachment) is the documented exception.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 59. Video elements never fetch bytes before play (local)
**Rules:** RULE-STD-MEDIA-101, RULE-STD-MEDIA-102. **Scope:** `src`, local structure and tests. The
network-level proof is hosted and runs only under authorization.
```bash
rg -n "priority|preload|autoPlay" src -g '*.tsx' | rg -i "MediaPreview|VideoViewer"
rg -n "<video" src -g '*.tsx' -g '!**/__tests__/**'
```
**Expected:** the video viewer defaults to metadata preload and mounts its element only on viewport
entry, with one observer per viewer; priority (full preload) is reserved for primary-content pages.
Feed, list, and browse surfaces pass no full preload, priority, or autoplay. A raw `<video>` outside the
media-viewer package or the app's renderer is a RULE-STD-MEDIA-101 violation and a byte-budget
violation.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 60. Client callables ride the one invocation path; data-layer failure copy has one owner
**Rules:** RULE-STD-FRONTEND-105, RULE-STD-FRONTEND-109, RULE-STD-FRONTEND-001, RULE-STD-QUALITY-103,
RULE-STD-ENG-009. **Scope:** `src`.
```bash
<GUARD_SUITE> -t "a callable is reached only through its transport owner|one callable rejection surfaces exactly once|a callable-backed read lives in a hook and goes through a reader|a failure surface describes a callable failure through its one copy owner"
# Swallowed rejections — a user-initiated action's failure always reaches one surface.
rg -n "\.catch\(\s*\(\s*\w*\s*\)\s*=>\s*(undefined|null|\{\s*\}|void 0)\s*\)" src -g '*.ts' -g '*.tsx' -g '!**/__tests__/**' -g '!src/test/**'
```
**Expected:** the guards are green: every callable is declared once through the factory kind from
query-core `./react`'s `createCallables` that fixes its retry, surface, and capture, from the app's
one callable policy, and is called through its declaration — a raw callable site opts out of the
policy's filter and interceptions.
One rejection gets exactly one surface: no second capture or second destructive toast. A CALLABLE
failure's copy comes only from the policy's one describer, so a raw SDK string never reaches the user;
a READ failure renders the canonical load-error state, which owns the one "could not load" sentence
(the app's read-failure-copy guard is in its additions). Capture for read failures is single-owner at
the query layer. A caller-owned surface renders nothing for an answer that has its own surface. Each
swallowed-rejection hit is classified: a background best-effort may swallow; a user-initiated action's
rejection discarded with no toast, inline state, or capture is the finding.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 61. Business numbers are single canonical constants
**Rules:** RULE-STD-ARCH-102, RULE-STD-ENG-005. **Scope:** `src` + `functions/src` (the package schema
half is guard-enforced).
```bash
<GUARD_SUITE> -t "every schema bound in the app, its Functions, and its Workers derives from a named limit|a stored enum value renders through its label map, never as raw text|no app module re-declares a constant the core package exports|no app module restates a core literal union"
<GUARD_SUITE> -t "every core schema bound derives from a named constant outside the reviewed structural bounds|every free-text property of a core wire input is a declared text field"
<GUARD_SUITE> -t "app routes are built by the one route owner"
rg -n "maxLength=\{[0-9]|minLength=\{[0-9]" src -g '*.tsx' -g '*.ts' -g '!**/__tests__/**'
rg -n "\.length\s*[<>]=?\s*[0-9]{2,}|\.slice\(0,\s*[0-9]" src functions/src -g '*.ts' -g '*.tsx' -g '!**/__tests__/**' -g '!*.test.ts' -g '!*.test.tsx'
```
**Expected:** the guards are green: every schema bound is a named limit, a text-field declaration, or an
enum schema; a stored enum value renders through its label map (never raw, never CSS-transformed); no app
module restates a package constant or union; every page path is built through the app's one route
owner in `<APP_DATA_PACKAGE>`, never written as a route literal. The greps: no free-text input carries a literal
`maxLength` — its cap is its `<APP_DATA_PACKAGE>` text-field declaration passed as the input's format;
every remaining length attribute reads a named constant; each length or excerpt guard on user text
imports its constant or is a reviewed structural literal; and a mode-varied value is never a literal
anywhere, fixtures included. The app's reviewed canonical literals are its business guard (its
additions).
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 63. Guard-suite coverage
**Rules:** RULE-STD-QUALITY-007. **Scope:** the repo's guard suite over every root it declares.
```bash
<GUARD_SUITE>
```
**Expected:** green. This is the build-failing enforcement every guard-backed step above cites. Each
allowlist entry carries a one-line justification and a stale entry fails; a guard enforces a boundary or
an owner, never an inventory. Keep it green, extend the app's facts when a new canonical definition
lands, and never loosen a real guard to pass.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 64. Functions codebase manifest + light-closure tripwire
**Rules:** RULE-STD-BACKEND-303, RULE-STD-BACKEND-311; the app's Functions architecture design doc. **Scope:** `functions`,
local source and generated artifacts only.
```bash
<GUARD_SUITE> -t "the codebase manifest deploys every function exactly once|no Functions codebase holds more than 55 functions|light functions never statically reach a heavy module|no code can overlap two dynamic imports of one module"
```
**Expected:** green. Every exported function is assigned to exactly one deploy codebase and the deploy
config mirrors the manifest; no codebase holds more than 55 functions; light interactive functions never statically reach a heavyweight
dependency — a new one in a light function's closure is loaded at its true usage site through a
module-level lazy loader (step 88), never by loosening the tripwire.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 65. ConsequenceDialog is the sole confirmation primitive
**Rules:** RULE-STD-FRONTEND-202, RULE-STD-FRONTEND-201, RULE-STD-FRONTEND-006, RULE-STD-BACKEND-212.
**Scope:** `src`.
```bash
# The comment filter is required — a prose mention is not a usage.
rg -n "AlertDialog" src -g '*.tsx' -g '*.ts' -g '!**/__tests__/**' | rg -v ":[0-9]+:\s*(//|\*)"
rg -n "window\.confirm\(" src -g '*.ts' -g '*.tsx' -g '!**/__tests__/**'
# Mutations fired straight from a click — each classified as consequential or not.
rg -n "onClick=\{\(\)\s*=>\s*(void\s+)?\w+\.(mutate|mutateAsync)\(" src -g '*.tsx' -g '!**/__tests__/**' -g '!*.test.tsx'
```
**Expected:** the first two are zero — every consequential confirm renders ui-core's
`ConsequenceDialog`, which owns the pending spinner and stays open on a rejected promise; the raw
alert-dialog primitives live only inside it, and the app's lint config bans them and a `.mutate(` inside
an `onConfirm`. **Which actions confirm:** each click-fired mutation the third command prints is a
reversible, self-only toggle — no confirmation — or it takes something away from someone or cannot be
undone from that surface, and then it runs only from a dialog confirm that returns its promise. A reason
a repair requires (RULE-STD-BACKEND-212) is gathered by the dialog, never re-implemented beside it. A
sent confirmation phrase is typed by the operator.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 66. One stylesheet entry point — no unlayered CSS imports
**Rules:** RULE-STD-FRONTEND-002. **Scope:** `src`.
```bash
<GUARD_SUITE> -t "only the root layout imports a stylesheet, and it imports exactly the entry stylesheet|the entry stylesheet keeps its pinned statements in their pinned order|Tailwind scans every installed package whose build renders classes|a semantic text class keeps its color against the same-named Tailwind utility"
```
**Expected:** green. The root layout imports exactly one stylesheet; every other sheet joins it in the
pinned layer order — an unlayered import anywhere beats every layered rule and silently disables
overrides app-wide. Every overrides-sheet rule names the utility it beats, and the entry sheet carries
one `@source` line per package whose components render utility classes (Tailwind never scans
`node_modules`).
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 67. Every heavy function sets explicit concurrency
**Rules:** RULE-STD-BACKEND-303. **Scope:** `functions/src`.
```bash
rg -n "memory:" functions/src -g '*.ts' -g '!*.test.ts' | rg -v ":[0-9]+:\s*(//|\*)"
rg -l "onSchedule|onObjectFinalized|onDocumentCreated|onDocumentWritten" functions/src -g '*.ts' -g '!*.test.ts'
rg -n "concurrency:" functions/src -g '*.ts' -g '!*.test.ts'
```
**Expected:** cross-reference the declared concurrencies against the heavy-by-shape candidates first
and the memory declarations second. Without a `concurrency:` line a function runs at the platform
default, not one at a time. **The heavy criterion:** memory above the app's global default, media
processing, or a batch, cascade, or drain loop — only those must carry `concurrency: 1`; the review
population is the document triggers with no line, decided by what each body does. A raised
`maxInstances` without a measured reason is a violation. Hot stateless callables at a measured higher
concurrency and rarely-hit callables with no line are the documented exceptions. This step NEVER reads
as "add `concurrency: 1` everywhere".
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 68. UI pattern consistency
**Rules:** RULE-STD-FRONTEND-001, RULE-STD-FRONTEND-006, RULE-STD-FRONTEND-007, RULE-STD-FRONTEND-008,
RULE-STD-FRONTEND-201, RULE-STD-FRONTEND-202, RULE-STD-FRONTEND-203, RULE-STD-FRONTEND-204,
RULE-STD-ARCH-004. **Scope:** `src` (touched UI areas). Deep UX →
`ux-audit-playbook.md`.
```bash
<GUARD_SUITE> -t "an unavailable control never wears the clickable affordance|a stack-N class is never on a horizontal flex row|titles and names truncate through the one shared class"
rg -n "<button|<select|<a " src -g '*.tsx' -g '!**/__tests__/**'
```
**Expected:** for every touched area, each repeated pattern family — buttons and action variants,
selects, links, show-more controls (the one ui-core toggle), cards and page headers, confirmations, and
pending, empty, and error states — uses its one canonical component, variant, semantic class, or recipe;
raw primitives, local wrapper copies, copied style blocks, and one-off variants are the findings. **Two
RULE-STD-FRONTEND-006 constraints, checked on every touched surface:** a state change swaps the ICON,
never the color or variant; and destructive red appears only on the confirm action inside a dialog (and
urgency text) — inline destructive triggers render neutral. Every page wraps its content in the one page
column, every page card uses the one card recipe, and every title and name truncates through theme-core's
`.single-line-truncate` (a few-line text block through `.three-line-clamp`), with no app copy of either
(RULE-STD-FRONTEND-007). A duplicate is reported with
the recommended canonical owner; the audit never recommends adding a variant to match one inconsistent
screen. The app's additions carry its brand-specific pattern checks.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 69. Rule and reference integrity
**Rules:** RULE-STD-QUALITY-205, RULE-STD-QUALITY-203, RULE-STD-ENG-001, RULE-STD-ENG-010. **Scope:** the
repo's entry files, its own rulebook (`<APP_RULES>`), its playbooks, its design docs, and the shared
rulebook and playbooks (`<DEV_STANDARDS>`).
```bash
# Every cited rule ID resolves to exactly one defined heading in the shared or the app rulebook.
comm -23 \
  <(rg -oNI "\bRULE-[A-Z]+-[A-Z]+-[0-9]{3}\b" . -g '*.md' -g '*.ts' -g '*.tsx' -g '*.rules' -g '!**/node_modules/**' -g '!**/dist/**' | sort -u) \
  <( (rg -oNI "^### (RULE-[A-Z]+-[A-Z]+-[0-9]{3})" -r '$1' <DEV_STANDARDS>/rules; rg -oNI "^### (RULE-[A-Z]+-[A-Z]+-[0-9]{3})" -r '$1' <APP_RULES>) | sort -u)
```
**Expected:** the comparison prints nothing — every `RULE-…` citation in the repo names a rule that
exists. A printed ID is a citation of a rule that does not exist: fix the citation, or add or restore
the rule. Every shared rule is listed in `<DEV_STANDARDS>/playbooks/crosswalk.md` with its audit, its
guard, or "no audit step yet", and every app rule has a guard, an audit step, or an explicit
manual-review designation (RULE-STD-QUALITY-203). The entry files require the shared and app rulebooks'
README and core rules (thinness is step 30). Markdown links in docs resolve; source comments, tests,
rules files, and config carry no document links at all (RULE-STD-COMMENT-010, step 89).
**RULE-STD-ENG-010 is designated manual review:** it governs the reading list a spawning prompt names,
which never lands in the repo, so it is verified when the prompt is written, never by a search of the
codebase.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 70. Admin capability is self-sufficient — never coupled to a participant status
**Rules:** RULE-STD-BACKEND-011, RULE-STD-BACKEND-004. **Scope:** `src` + `functions/src` (and any tree
that serves bytes by tier). Reachability is semantic: classify each hit, never auto-fix.
```bash
# a. Client: every admin display gate — walk each hit's mount chain for a participant gate.
rg -n "isAdmin" src -g '*.tsx' -g '*.ts' -g '!**/__tests__/**' -g '!*.test.*'
# b. Server: callables carrying both an admin branch and a participant assertion (NUL-delimited).
rg -l0 "isAdmin|adminReview|adminOverride" functions/src -g '*.ts' -g '!**/__tests__/**' -g '!*.test.ts' \
  | xargs -0 -r rg -ln "assert\w*(Capability|Creator|Member|Allowed)"
```
**Expected:** every admin-gated control is reachable with the admin standing alone — directly or through
an admin surface — and every review or support server path serves a non-participant admin, including
the bytes a surface shows. Participant gates that apply to admins deliberately (taking part itself) are
classified deliberate, not findings. **The shape and the mechanism are separate checks, and a path
satisfies both:** the admin bypass sits ahead of the participant assertion, AND it resolves admin
through the canonical resolver — a raw claim read is a RULE-STD-BACKEND-004 violation even on a correct
shape (step 49).
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 73. Lint suppression and one enforced format
**Rules:** RULE-STD-QUALITY-006, RULE-STD-ENG-008. **Scope:** every linted tree and lint config of the
repo, and every code file Prettier formats.
```bash
rg -n "noInlineConfig" -g 'eslint.config.*' -g '!**/node_modules/**'
rg -n "eslint-disable" -g '*.{ts,tsx,js,jsx,mjs,cjs}' -g '!**/node_modules/**' -g '!**/dist/**'
npm run format:check
rg -n "prettier-ignore" -g '*.{ts,tsx,js,jsx,mjs,cjs,css}' -g '!**/node_modules/**' -g '!**/dist/**'
```
**Expected (apps):** zero suppression — every app lint config sets `noInlineConfig: true` inside its
linter options (so an inline disable does nothing and the rule still fails the lint gate), and no
`eslint-disable` directive survives in a linted tree (a policy comment that names the string is not a
directive). A genuine false positive is solved structurally — rename, refactor, or scope the rule —
never suppressed, and turning a rule off or widening `ignores` to pass failing code is prohibited; a
`warn`-level finding is a finding to fix. **Expected (packages):** a reasoned `eslint-disable-next-line`
is permitted only for a narrow intentional case, with its reason on the line. **Both:** the format check
passes (a listed file means a change set skipped the gate); the Prettier-compatibility config is the
last entry of every lint config; every `prettier-ignore` carries its reason.
**Types and line endings:** `<GUARD_SUITE> -t "no cast switches type checking off"` and
`-t "every text file is LF"`, and `-t "every module mock is typed against the module it replaces"` pass. Every reviewed cast entry is the only way or clearly the best way,
with that reason in its why; a cast a typed fake, the owner's type, or a typed mapping could replace is
the finding. Every module mock names its module through `import('…')`, so a misspelled or mistyped override fails
to compile.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 75. No vacuous commands — every playbook path resolves and every command is honestly scoped
**Rules:** RULE-STD-QUALITY-203, RULE-STD-ENG-009. **Scope:** the repo's playbook folders — the shared
one and the app's own.
**Expected:** the repo's playbook-reference check (repo-guards' playbook-refs tooling behind the
app's thin script, also run inside `test:quiet`) exits 0. A miss means a check somewhere is vacuous —
`rg` aborts on a path that does not exist and searches nothing, so its step reads as a clean PASS while
auditing nothing. Fix the path, delete the reference, or mark the line `<!-- no-check -->` when it is
deliberately hypothetical; never silence it by deleting the command. **The review half the check cannot
reach:** commands run from the repo root, with any other directory in a subshell; the scope a command
searches matches its Scope line; exclusions use `-g '!glob'` and the NUL-delimited `xargs` pair; and an
Expected describes what its command actually prints, with any exact list derived from a named guard,
script, or constant.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 77. Privileged request handlers carry the callable trust obligations
**Rules:** RULE-STD-BACKEND-012, RULE-STD-BACKEND-002, RULE-STD-BACKEND-005, RULE-STD-BACKEND-013,
RULE-STD-ARCH-106, RULE-STD-ENG-006. **Scope:** the app's privileged request handlers and server
modules (its additions name the trees). These sit outside the callable boundary, so no
`functions/src`-scoped step ranges over them; the per-handler attestation decision is
`callable-functions-playbook.md` step 12. **Method (the app's locators, in its additions, + semantic
review).**
**Expected:** the handler set is enumerated, and a new file in it is a new backend entry point that
inherits every clause: every request body is parsed by a strict schema before any value is used (a cast
is not a parse); attestation and request-origin checks run only through the one shared guard module and
answer before the body is read (a body the authentication covers is read within a byte budget); every
environment-gated relaxation runs through the one sanctioned predicate; identity is proven and targets
are resolved server-side, never taken from the body — confirm the enumeration is non-empty before
recording a zero; and every handler reachable with no identity carries a rate-limit decision through the
one route-side limiter, or an in-file decision naming its primary defense.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 80. Firestore write guard — a write stores only registry-declared fields
**Rules:** RULE-STD-BACKEND-115, RULE-STD-ARCH-101, RULE-STD-ARCH-104, RULE-STD-ARCH-205,
RULE-STD-BACKEND-209, RULE-STD-QUALITY-007. **Scope:** every local Firestore writer tree (`functions/src`,
`src`, scripts) — the guard reads source and the installed `<APP_DATA_PACKAGE>` registry, never a
database.
```bash
<GUARD_SUITE> -t "every stored Firestore field is declared by its document schema"
```
**Expected:** green. The guard prints its own coverage table on every run (writes seen, targets
resolved, payloads parsed, payloads verified, exceptions applied, violations), and that output IS the
expected result; read "verified" — read AND diffed against a readable schema — as the only coverage
claim. It **fails closed**: an unresolvable write is an unchecked write, so it is a violation until the
writer is fixed or a specific reviewed exception lands with its justification — never a pattern-wide
exemption or an in-code tag; a stale exception fails. A write that executes inside a package (a package
finalizer) is outside its scan and is held by a compile-time patch type in the app. A coverage table
whose numbers collapse is a broken guard, not a clean tree; a mismatch is fixed by adding the field to
`<APP_DATA_PACKAGE>` first, never by widening a list here.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 82. Every in-app navigation runs through the navigation helper
**Rules:** RULE-STD-FRONTEND-205, RULE-STD-MEDIA-009. **Scope:** `src`.
```bash
<GUARD_SUITE> -t "the navigation helper exports what the app navigates with|the root layout mounts its guards and providers in their declared order"
# The app's additions add the locator for its navigation helper's full-page loads.
rg -n "<a [^>]*href=[\"{]" src -g '*.tsx' -g '!**/__tests__/**' -g '!*.test.tsx'
rg -n "URLSearchParams\(|\b\w*[Pp]arams\.(set|append)\(" src -g '*.ts' -g '*.tsx' -g '!**/__tests__/**' -g '!src/test/**'
```
**Expected:** the guards are green, plus the app's ownership guards for the framework link, the router,
`window.location`, and the package's guarded navigation (its additions) — the helper is their one
owner, and its own suite pins its contract (guard first; a cancelled guard shows nothing; a query-only
navigation never shows the overlay; navigation resolves once the destination rendered; one prompt on a
full-page leave). Classify each hit: a full-page load serves only a genuinely full-page navigation (an
external URL, a reload after an admin action); a plain `<a href>` is an external, mail, phone, or
in-page link; and every value a built URL carries is an identifier or view state — sensitive free text
in a query string is the RULE-STD-FRONTEND-205 finding. A forced navigation the user declines at the
upload guard defers until no upload is in flight — never a re-prompt loop, never silently abandoned.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 83. Storage generation and size are read only through the package helpers
**Rules:** RULE-STD-ENG-002, RULE-STD-ENG-004, RULE-STD-ENG-005, RULE-STD-ENG-009, RULE-STD-QUALITY-007.
**Scope:** `functions/src` + `src`. Contract owners: media-processing-core's server helpers and
media-schemas' size parser.
```bash
rg -n "requireStorageObjectGeneration\(|stagedObjectGenerationFromMetadata\(|parseStorageObjectSize\(" functions/src src -g '*.ts' -g '*.tsx' -g '!*.test.ts' -g '!*.test.tsx'
```
**Expected:** the app's guard that no generation or size is parsed inline (its additions) is green.
Classify each call's handling of a missing value — explicit at every site, never a placeholder: a site
that cannot proceed calls the package's require helper, which throws the package's error; a destructive
sweep that cannot compute a hold key leaves the object and counts it; a best-effort telemetry field may
pass `undefined` through. The helpers treat absent, `null`, and empty alike, so `undefined` is the one
missing answer a caller handles.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 87. Every callable runs all of its work inside its error-exit try
**Rules:** RULE-STD-QUALITY-105, RULE-STD-QUALITY-101, RULE-STD-QUALITY-007, RULE-STD-ENG-009. **Scope:**
`functions/src` — every `onCall` handler and every call of the app's one callable error exit.
**Method (the app's exit guard test, in its additions, + semantic review).**
**Expected:** the guard is green with no allowlist: every handler is `return withScope(async (scope) =>
{ … })` whose only statements outside ONE try are scope tags and bare `let` declarations; the catch ends
in the error exit naming the exported callable; no `finally`; no exit outside a callable's catch. Each
bare `let` before the try is a value its catch reads, assigned inside the try — never a place to start
work. A shared core never runs an exit (two exits capture one fault twice), and a core reached from a
callable never logs-and-captures and then rethrows; a trigger or worker whose rethrow drives the
platform retry keeps its capture. A designed-answer declaration covers only that callable's own designed
refusal.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 88. No test can run against a real module it mocked
**Rules:** RULE-STD-QUALITY-007, RULE-STD-ENG-009. **Scope:** `functions/src` and `src` — production
dynamic imports and every test file.
```bash
<GUARD_SUITE> -t "no code can overlap two dynamic imports of one module"
rg -n "lazyModule\(" functions/src src -g '*.ts' -g '*.tsx' -g '!*.test.ts' -g '!*.test.tsx'
```
**Expected:** the guard is green — every production dynamic import is a module-level loader built with
module-core's `lazyModule` (or the framework's own dynamic import), no test runs concurrently or puts an
`import()` inside a promise combinator, and no test config enables concurrency. Each loader is lazy for
a reason its comment states (a native addon, a large graph a rare path needs, a light function's cold
start); a module that gains nothing from laziness is imported statically. A hand-rolled memoized
`import()` or a bare `await import()` at a usage site is the finding.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 89. Comments follow the comment rules
**Rules:** RULE-STD-COMMENT-001, RULE-STD-COMMENT-002, RULE-STD-COMMENT-003,
RULE-STD-COMMENT-004, RULE-STD-COMMENT-005, RULE-STD-COMMENT-006, RULE-STD-COMMENT-007,
RULE-STD-COMMENT-008, RULE-STD-COMMENT-009, RULE-STD-COMMENT-010, RULE-STD-COMMENT-011,
RULE-STD-COMMENT-012. **Scope:** every comment and every test
name in the repo's code files — each source, test, script, and worker tree, the rules files (named
explicitly so a type filter does not drop them), and, from an app, `<PACKAGES_REPO>/packages` and
`<PACKAGES_REPO>/scripts`. Markdown and data files are out of scope. **This step audits; a run reports
findings.**
```bash
# The trees every locator searches (the app's additions set T), the code-file filter, and the
# comment-line prefix each comment locator requires.
T="<COMMENT_TREES>"
F='*.{ts,tsx,js,jsx,mjs,cjs,sh}'
C='(//|/\*|^\s*\*|^\s*#)'
# RULE-STD-COMMENT-002 — dates
rg -nP "$C.*(\b20\d{2}-[01]\d-[0-3]\d\b|\b(January|February|March|April|May|June|July|August|September|October|November|December) 20\d{2}\b|\bas of (Q[1-4]|20\d{2})\b)" $T -g "$F"
# RULE-STD-COMMENT-003 — line numbers
rg -nP "$C.*(\.(ts|tsx|js|mjs|md|rules|json|yaml|sh):\d+|\blines? \d+|~line)" $T -g "$F"
# RULE-STD-COMMENT-004 — ticket names, work labels, plan step names used as labels
rg -nP "$C.*(CODE_CHANGE_|\b(Phase|Wave|Batch|FINDING) \d|\bitem \d|\[F\d+\]|§[A-Z]\d)" $T -g "$F"
# RULE-STD-COMMENT-005 — history (a locator: classify every hit)
rg -niP "$C.*\b(previously|used to|formerly|was changed|now uses|no longer|fixed|replaced the old|legacy)\b" $T -g "$F"
# RULE-STD-COMMENT-006 — people and review sources
rg -nP "$C.*(\bDJ\b|\bCodex\b|ChatGPT|\bGPT\b|review verdict|audit finding|the orchestrator)" $T -g "$F"
# RULE-STD-COMMENT-007 — change notes (a locator; narration is found by the read-through)
rg -niP "^\s*(//|\*)\s*(added|changed|updated|removed|new:)\s" $T -g "$F"
# RULE-STD-COMMENT-008 — markers, then commented-out code
rg -nP "$C.*(\b(TODO|FIXME|HACK|XXX)\b|\btemporary\b|\bfor now\b)" $T -g "$F"
rg -nP "^\s*//\s*(const|let|var|await|return|import|export)\s" $T -g "$F"
# RULE-STD-COMMENT-009 — test names carrying a tag or label
rg -nP "(\b(describe|it|test)\b[\w.]*|\))\(\s*['\"\`][^'\"\`]*(\[[^\]]+\]|CODE_CHANGE_|FINDING \d|\bPhase \d)" $T -g "$F"
# RULE-STD-COMMENT-010 — pointers to documents
rg -nP "$C.*(\bdocs/|\b[\w.-]+\.md\b|§)" $T -g "$F"
# RULE-STD-COMMENT-011 — links to outside sources
rg -nP "$C.*https?://" $T -g "$F"
```
**Expected:** each locator prints only the allowed shapes below; every other hit is a finding against
the rule on that command. A hit on a code line rather than a comment is skipped. The app's additions
carry its own finding-tag locator.
- RULE-STD-COMMENT-002: only a date that is a value the code depends on (an external API version, a
  legal effective date).
- RULE-STD-COMMENT-003, -006, -009, -010, -011: none. A comment references only rule IDs and names in
  the code.
- RULE-STD-COMMENT-004: only a phase, step, or item that is part of the runtime design itself.
- RULE-STD-COMMENT-005: only words about runtime state or plain adjectives, never the code's history.
- RULE-STD-COMMENT-007: only a verb describing what the code does at runtime, never an edit record.
- Commented-out code: none (a usage example inside a doc comment is not commented-out code).
- RULE-STD-COMMENT-008 markers: only "temporary" naming a runtime thing, never a deferral.
- The comments RULE-STD-COMMENT-001 requires (the post-commit marker, a sanctioned-exception block, a
  reasoned disable, a guard allowlist justification, and the rest it lists) are never findings.

**Read-through (RULE-STD-COMMENT-001, -007, -010).** File by file, each comment explains a non-obvious
why, names a rule exception with its rule ID and reason, or warns about something important; one that
does none of these, or narrates the next line, is a finding. **A comment the rules do not settle** goes
to DJ as a proposed new rule or rule edit, with the comment as the example, and stays as it is until DJ
decides; this audit never writes or stretches a rule itself.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 90. Functions tests locate source from their own file, never the working folder
**Rules:** RULE-STD-QUALITY-007, RULE-STD-ENG-009. **Scope:** `functions/src` tests.
```bash
<GUARD_SUITE> -t "Functions tests resolve source from their own location, never process.cwd\(\)"
npx vitest run --root functions functions/src/<FUNCTIONS_TEST_SAMPLE>
(cd functions && npx vitest run src/<FUNCTIONS_TEST_SAMPLE>)
```
**Expected:** the guard is green, and both runs report the same file and test counts — `--root` never
moves `process.cwd()`, so a test rooted in the working folder silently scans the wrong tree from the
repo root. Differing counts are a finding.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 91. The app config document has one client reader
**Rules:** RULE-STD-ENG-002, RULE-STD-FRONTEND-104, RULE-STD-QUALITY-007. **Scope:** `src` (not the
server modules).
```bash
<GUARD_SUITE> -t "one client module reads the app config document"
```
**Expected:** green. Every consumer reads the one provider's hook, and a missing document, a dead
listener, and an invalid value are distinct states, never one; a second client read is the finding.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 95. No child process gets an args array together with a shell
**Rules:** RULE-STD-QUALITY-007. Node space-joins an args array for a shell, unescaped, so a child that
needs a shell gets ONE command string built from shell-safe tokens. **Scope:** every code file of the
repo outside installed dependencies and generated output.
```bash
<GUARD_SUITE> -t "no child process gets an args array together with a shell"
```
**Expected:** green. **The review half:** the guard reads source text, so options passed through a
variable or a spread are read by hand against the same rule. A child that needs a shell (a Windows
`.cmd` shim) gets one command string plus its options, through repo-guards' shell-safe runner; one that
needs none keeps its args array with no shell.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 96. A published package ships a clean build, in a dependency-safe order
**Rules:** RULE-STD-ARCH-205, RULE-STD-ARCH-208, RULE-STD-QUALITY-007. **Scope:** the package manifests
and sources, the package-order script, and the release scripts in `<PACKAGES_REPO>`.
```bash
(cd <PACKAGES_REPO> && npx vitest run test/boundary/tests-outside-src.test.ts test/boundary/publish-manifest.test.ts test/boundary/package-order.test.ts)
```
**Expected:** the boundary suites are green: no test file or test folder sits under any package `src`
(every build compiles all of `src` into the published `dist`); every `prepublishOnly` cleans before it
builds and every package publishes `dist` with no TypeScript source; and the package order lists every
package once, each after every internal package it declares, with the release scripts walking that
order. A red guard is fixed in the package, never by loosening the guard.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 97. Write preconditions are read inside the write's transaction
**Rules:** RULE-STD-BACKEND-116, RULE-STD-BACKEND-003, RULE-STD-BACKEND-101. **Scope:** `functions/src`
(the transactional half) + `src` (the partial-edit half). A FULL audit reviews every file (b) prints; a
PARTIAL audit reviews the files the change set touched and names them.
```bash
# a. The build-failing half.
<GUARD_SUITE> -t "a transaction callback reads only through its transaction"
# b. Files that open a transaction AND read outside one — each non-transactional read is a candidate.
rg -l0 "runTransaction\(" functions/src -g '*.ts' -g '!*.test.ts' -g '!**/__tests__/**' \
  | xargs -0 -r rg -lP "(?<![\w.](transaction|tx|txn|t))\.get\(\)"
# c. Caps and uniqueness decided by counting.
rg -n "\.count\(\)\.get\(|\.size\s*(>=|>|<=|<)\s*[A-Z_0-9]" functions/src -g '*.ts' -g '!*.test.ts' -g '!**/__tests__/**'
```
**Expected:** (a) green. (b) each non-transactional read is data returned to the caller, or a sanctioned
fail-fast whose write path re-reads the same precondition in its transaction; a read that DECIDES a
later write — a lock, status, cap, existence or duplicate check, hidden flag, or membership — is the
RULE-STD-BACKEND-116 violation (RULE-STD-BACKEND-003 when it is authorization). A read that turns an
error into "not locked" or "not hidden" is a violation wherever it sits. (c) every cap or uniqueness
decided by counting also writes one document every competing writer writes (a counter, or a touch on
the parent). Every editor and partial-update mutation sends only the fields its user changed, through
the app's one changed-fields helper.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 98. Bounded reads make progress and tell the truth (tripwire)
**Rules:** RULE-STD-BACKEND-112. **Scope:** `functions/src` + `src`. Deep inventory →
`performance-audit-playbook.md` steps 1–3.
```bash
rg -l "onSchedule\(" functions/src -g '*.ts' -g '!*.test.ts'
rg -n "(count|total|Count|Total)\w*\s*[:=]\s*[\w.]+\.(size|docs\.length)\b" functions/src src -g '*.ts' -g '*.tsx' -g '!*.test.ts' -g '!**/__tests__/**'
rg -n -A12 "queryFn" src -g '*.ts' -g '*.tsx' -g '!**/__tests__/**' | rg "\.filter\("
```
**Expected:** (a) every pass of every recurring job that reads a bounded window advances a persisted
cursor or writes each processed row out of its own query, and keeps an exhausted source's cursor as done
— a pass that rereads the same first page, so a stuck head row starves everything behind it, is the
finding; a full user-directory scan runs through one budgeted lap, never a loop that restarts every run.
(b) each count or total built from a query result is exact because the query is intrinsically bounded,
or it is labelled as a floor where shown — a page presented as a total, or an "oldest" picked from an
unordered page, is the finding. (c) each client filter inside a paged `queryFn` narrows rows the query
already guarantees to be few, or the hook keeps paging until the page fills or the source ends. No batch
or transaction iterates an unbounded result.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 99. One field, one constraint set — the form, the wire, and the writer agree
**Rules:** RULE-STD-ARCH-102, RULE-STD-ARCH-106, RULE-STD-ENG-006. **Scope:** `src` + `functions/src` +
the `<APP_DATA_PACKAGE>` schema atoms. Complements step 61 (the constants) and step 18 (wire alignment).
```bash
<GUARD_SUITE> -t "a render surface reads a typed number from the whole input|textEntry appears only on the reviewed non-free-text boxes, exactly as many as reviewed|every core id atom admits exactly one document-id segment|every id field a client sends is one document-id segment|no id field a client sends admits a space-only or space-padded value"
rg -l "z\.object\(" src -g '*.tsx' -g '*.ts' -g '!**/__tests__/**' -g '!*.test.*'
rg -n "\.trim\(\)" functions/src -g '*.ts' -g '!*.test.ts'
rg -n "cannot be empty|characters or less" src -g '*.tsx' -g '!**/__tests__/**'
```
**Expected:** the guards are green. For each client-side cap, pattern, or required-text check, the
callable's wire schema and the writing core enforce the SAME rule; a rule only the form holds, or a wire
schema admitting a value the writer later discards, is the RULE-STD-ARCH-102 finding. Each local form
schema derives every limit from the wire schema or constant it feeds. Every atom used to build a path
admits exactly one segment (RULE-STD-ARCH-106). Every text field a person types has ONE
`<APP_DATA_PACKAGE>` declaration read at all three points — the input's format, the wire schema, and
the writer storing the parsed value; a Functions-side trim of a field the wire already judged is the
finding (the remaining hits are values nobody types, or readers building a label from stored text). A
form gates Save on the declaration's own check and shows the shared refusal line, never a hand-written
"cannot be empty" sentence; text that becomes a path segment or a blocked-list entry is keyed through its
one helper.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 101. The UI offers exactly the actions the backend accepts
**Rules:** RULE-STD-FRONTEND-110, RULE-STD-ENG-006, RULE-STD-FRONTEND-106, RULE-STD-FRONTEND-206.
**Scope:** `src`, read against the callables it reaches. A FULL audit classifies every hit; a PARTIAL
audit, the touched areas.
```bash
rg -n "\.status\s*(===|!==)\s*['\"]\w+['\"]" src -g '*.tsx' -g '!**/__tests__/**' -g '!*.test.tsx'
rg -n "isOwn\w*\s*=|\buid\s*===\s*user\??\.uid|user\??\.uid\s*===\s*\w+\.(uid|userId|ownerUid|createdBy)" src -g '*.tsx' -g '!**/__tests__/**' -g '!*.test.tsx'
```
**Expected:** for each gate a hit reveals, find the callable that performs the action and the predicate
its core enforces: the component imports that same canonical predicate (an `<APP_DATA_PACKAGE>` rule or
constant) or states a pure display choice. The findings are both directions of drift — a control offered
in a state the backend refuses, and a control hidden in a state the backend allows — plus a gate restated
locally that happens to match today. A gate whose inputs are still loading or failed shows the control
waiting, never decided.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 102. Replays act on live state, in order, once (tripwire)
**Rules:** RULE-STD-BACKEND-304. **Scope:** `functions/src` (and any other tree that drains a queue).
Deep → `async-workflow-playbook.md` steps 3–4.
```bash
rg -n "event\.data\??\.(after|before)\??\.data\(\)|\b(afterData|beforeData)\b" functions/src -g '*.ts' -g '!*.test.ts' -g '!**/__tests__/**'
rg -n "deterministic\w*Id\(" functions/src -g '*.ts' -g '!*.test.ts' -g '!**/__tests__/**'
```
**Expected:** (a) each hit only compares before and after to decide WHETHER to act, or re-reads the
source in its transaction and acts on that; a snapshot flowing into a write as the new state is the
finding. (b) each deterministic id's inputs identify one occurrence; a key that can legitimately recur
carries the occurrence's own identity. Every queue drain treats a receiver's `conflict` as not
delivered — dead-letter or re-drive, never ack. For every handler (a) prints, the idempotency check
precedes any cap, gate, or counter.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 103. Interaction semantics, announced state, focus, and scripted motion
**Rules:** RULE-STD-FRONTEND-203, RULE-STD-FRONTEND-204. **Scope:** `src`. Deep accessibility →
`ux-audit-playbook.md`.
```bash
<GUARD_SUITE> -t "an icon-only button carries an accessible name|a button inside a form states its type|a display-only component is never a trigger or a control|every dropdown carries an accessible name"
<GUARD_SUITE> -t "app code uses no transition-all and no Tailwind duration-\* utility|a smooth scroll is requested only by the effective-motion helper|every app stylesheet transition names its property and rides the motion tokens|one store reads the reduced-motion request"
rg -n "onClick=\{\(\)\s*=>\s*(void\s+)?(navigate|appNavigate)\(" src -g '*.tsx' -g '!**/__tests__/**'
rg -n "aria-label=\"(More actions|Show [Dd]etails|View [Dd]etails|Remove|Delete|Edit|Open)\"" src -g '*.tsx' -g '!**/__tests__/**'
rg -n "\-\-motion-(fast|base|slow|ease)\s*:" src -g '*.css'
```
**Expected:** the guards are green. Each click-handler navigation is a link-like action that should be a
link, unless it is a post-action navigation awaited inside a pending action. Each fixed label is on a
control rendered once per page — a per-item control names its item. Each app motion-token declaration is
a deliberate override whose value differs from theme-core's (restating theme-core's own value is a second
copy). **Review clauses no command reaches:** a selecting card exposes its pressed, checked, or selected
state; a focused control that unmounts, hides, or disables mid-interaction first moves focus somewhere
defined; a timed animation or idle timer stops under the one reduced-motion preference; transitions
animate opacity and transform only, on the motion tokens. Guard-enforced RULE-STD-FRONTEND-203 half: the
`@ttt-productions/dev-standards/node/a11y` axe run (default, high-contrast, reduced-motion) in the app's
e2e stage, and the shared ESLint base's `jsx-a11y` recommended rules.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 104. Unsaved input is never discarded silently
**Rules:** RULE-STD-FRONTEND-207, RULE-STD-FRONTEND-202, RULE-STD-FRONTEND-205, RULE-STD-MEDIA-009.
**Scope:** `src`.
```bash
<GUARD_SUITE> -t "an editor holding typed input is never mounted under a permission gate"
rg -l0 "<Dialog\b" src -g '*.tsx' -g '!**/__tests__/**' -g '!*.test.tsx' | xargs -0 -r rg -l "useForm\(|<Textarea|<Input"
rg -n -A5 "useEffect\(" src -g '*.tsx' -g '!**/__tests__/**' -g '!*.test.tsx' | rg "\b(reset|setDraft\w*|setForm\w*)\("
rg -n "beforeunload" src -g '*.ts' -g '*.tsx' -g '!**/__tests__/**'
```
**Expected:** the guard is green — a permission never unmounts an open editor. For each editor dialog,
every path that closes it with changed input — Cancel, Escape, an overlay click, a navigation — asks
first through `ConsequenceDialog` or keeps the draft to restore, through the app's one unsaved-edits
guard; a dialog with nothing changed closes without asking. Each reset effect runs only while the form is
clean, or leaves every changed field untouched. `beforeunload` is zero in app code — a full-page leave
goes through the one shared leave guard.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 105. A scheduled job isolates its passes and its rows
**Rules:** RULE-STD-BACKEND-309, RULE-STD-BACKEND-112, RULE-STD-BACKEND-302. **Scope:** `functions/src`.
Deep → `async-workflow-playbook.md` step 9.
```bash
<GUARD_SUITE> -t "a scheduled handler isolates its passes"
rg -l "onSchedule\(" functions/src -g '*.ts' -g '!*.test.ts'
```
**Expected:** the guard is green — no try block inside a scheduled handler holds two or more awaited
units; a job with several passes isolates each in one extracted function, and the allowlist holds only
dependent units, each justified. For each job, a per-row loop isolates each row (its own try/catch, or its
own transaction recording the failure on the row), and a row that keeps failing leaves the window
(backoff, a failure marker, a dead letter) instead of pinning an oldest-first query. Each job's summary
names each pass's own outcome and never reports a pass that threw as done.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 107. Existence-probe gets prove ownership from the path
**Rules:** RULE-STD-BACKEND-117, RULE-STD-ENG-006. **Scope:** `firestore.rules`, the client probes in
`src`, and the rules tests.
```bash
rg -n "getDoc\(|\.doc\([^)]*\)\.get\(" src -g '*.ts' -g '*.tsx' -g '!**/__tests__/**'
rg -n "allow (get|read)[^;]*(resource\.data\.\w+\s*==\s*request\.auth\.uid|request\.auth\.uid\s*==\s*resource\.data|request\.auth\.uid in resource\.data)" firestore.rules
```
**Expected:** (a) for each client read of one document by an id the client derived (a deterministic id
or an owner-keyed path), the collection's `get` rule proves ownership from the PATH — the path variable
or the owner part of the deterministic id — so the caller's absent record answers `exists: false`.
(b) each grant is classified: a collection read only by ids the client was handed is not a probe; a
probed collection whose `get` rests on stored data alone is the finding, and so is a `resource == null`
grant that does not also prove ownership from the path. Each probed collection has a rules test for the
caller's own absent document beside its existing one, another member's, and the list.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 108. No status action restricts an account holding admin standing
**Rules:** RULE-STD-BACKEND-210, RULE-STD-BACKEND-116, RULE-STD-BACKEND-204, RULE-STD-FRONTEND-110.
**Scope:** `functions/src` + the admin UI. **Method (the app's status-writer locators, in its additions,
+ semantic review).**
**Expected:** every restrictive status write — a ban or any status restriction — goes through the one
status writer, which reads the admin roster inside its status transaction and refuses a target holding
admin standing, with a failure audit; any other writer of a restrictive status is the finding, unless it
reads the roster in its own transaction and skips the restriction for that target. Every caller lets the
refusal surface or handles it explicitly; one that retries it forever or swallows it is the finding. The
UI does not offer a restrictive action for an account holding admin standing, deciding from the same
predicate the backend enforces.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 111. Counter decrements are read and lowered, never blind
**Rules:** RULE-STD-BACKEND-119, RULE-STD-BACKEND-116. **Scope:** `functions/src` + scripts.
```bash
<GUARD_SUITE> -t "no stored count is lowered by a blind decrement"
rg -n "FieldValue\.increment\([a-zA-Z]" functions/src scripts -g '*.ts' -g '*.mjs' -g '!*.test.ts' -g '!**/__tests__/**'
```
**Expected:** the guard is green — no increment by a syntactic negative. **Its limit:** a negative held
in a variable is not seen, so the grep lists every increment by a variable: an adding increment passes,
and so does a decrement carrying the app's reviewed exception comment (its additions name any); any
other variable that can carry a negative is the finding. Every decrement lowers the value its own
transaction read, through that count's one decrement path, writing `Math.max(0, value − n)` — or refuses
rather than clamping where the rule's exception says so. A decrement decided from a read outside the
transaction, or one that creates a counter document, is the finding.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 112. A user-visible lane's first event has a signal
**Rules:** RULE-STD-BACKEND-310, RULE-STD-BACKEND-306, RULE-STD-BACKEND-304. **Scope:** `functions/src`.
**Method (semantic review over the app's lane locators, in its additions).**
**Expected:** for each lane that delivers something to a member, every write that CREATES the
member-visible item co-writes one notification occurrence per recipient the lane addresses (read in the
same transaction) on the reliable lane, on a deterministic id a retried creation finds already present,
with a type whose wording is true for a first event. A lane whose later events notify and whose first
does not, a first-event occurrence written after the commit, or a retry that writes it again, is the
finding. No guard can tell a first event from its code shape, so this step is a semantic review.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 114. A session's reads retire with it
**Rules:** RULE-STD-FRONTEND-108, RULE-STD-FRONTEND-103, RULE-STD-QUALITY-103. **Scope:** `src`.
```bash
# The app's additions add the locator for its session predicate.
rg -n "signOut\(" src -g '*.ts' -g '*.tsx' -g '!**/__tests__/**'
rg -n "cancelQueries\(\)|queryClient\.clear\(\)" src -g '*.ts' -g '*.tsx' -g '!**/__tests__/**'
```
**Expected:** one session-retirement owner (its test and the app's guard are in its additions) is the
only place a keyless cancel or a whole-cache clear runs. Every sign-out is retired by that owner before
the session changes, and a member's chosen sign-out resumes the session when sign-out fails. A query
function bound to the signed-in user checks the live session before its request and throws a
session-ended error rather than returning a made-up empty answer; one that writes another key after an
await re-checks the session first; a render-time uid comparison is the finding. A continuation after an
awaited hop captures the uid when its attempt starts and re-checks it before every later step, toast, or
navigation. A raw live listener tied to a session checks the session in its error path before it reports.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 117. Test code builds Firestore paths through the canonical builders
**Rules:** RULE-STD-ARCH-104, RULE-STD-ENG-002, RULE-STD-QUALITY-001, RULE-STD-QUALITY-007,
RULE-STD-COMMENT-009. **Scope:** every test tree the repo has.
```bash
<GUARD_SUITE> -t "test code never hand-types a Firestore path"
rg -n -A3 "vi\.(mock|doMock)\(\s*['\"]@ttt-productions/" src functions/src -g '*.test.ts' -g '*.test.tsx'
```
**Expected:** the guard is green — no test literal begins with a declared collection name and a slash,
and no declared name is passed to a Firestore accessor; a document path is built through the canonical
path builders, a deliberately non-existent document from a constant, and a test name leads with the
entity, never its path. By eye: every mock of `<APP_DATA_PACKAGE>` (or another package) spreads the real
module and overrides only genuine stubs — a mock handing back its own path builders or constants is a
second copy that drifts from the real paths, unless the override is a spy the test asserts on.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 118. A test loads the code it tests when its file loads
**Rules:** RULE-STD-QUALITY-009, RULE-STD-QUALITY-001, RULE-STD-QUALITY-007. **Scope:** every test tree.
```bash
<GUARD_SUITE> -t "a test loads the code it tests when its file loads, never inside a test case"
rg -n "export function __reset" src functions/src -g '*.ts' -g '!*.test.ts'
```
**Expected:** the guard is green, and each reviewed entry is a test whose fresh module is itself what it
proves; a file that only needs other state takes it through `vi.hoisted`, a module's test-only reset
seam, or a flag read when called — never a module reload. Every seam the grep prints is test-only, says
so, and clears all of its module's per-instance state; production code never calls one.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 119. A test needing more time names a budget
**Rules:** RULE-STD-QUALITY-010, RULE-STD-QUALITY-001, RULE-STD-QUALITY-007, RULE-STD-ENG-005. **Scope:**
every test tree.
```bash
<GUARD_SUITE> -t "a test sets a time limit only by naming a budget from a timeout file"
```
**Expected:** the guard is green — every test, suite, hook, config, or Testing Library limit names a
budget imported from its tree's timeout file, never a number. The repo-guards slow-test report (the
app's thin script, report only) lists every case at or over its threshold in a file that names no
budget; each is triaged — one waiting on a real timer moves to the fake clock, one doing real heavy work
names a budget. A budget on a case that only waits on a timer is a finding.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 120. The brand fonts are self-hosted
**Rules:** RULE-STD-QUALITY-007. **Scope:** the root layout, the app's font folder, and all app code.
```bash
<GUARD_SUITE> -t "the app loads its fonts from the repository, never from Google at build time"
rg -n "localFont\(|@font-face|fonts.googleapis|fonts.gstatic" src
```
**Expected:** the guard is green, and every face loads through `localFont` in the root layout from a
file in the repository with its license beside it; no stylesheet declares its own `@font-face` and
nothing names a hosted font service.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 121. Admin actions outside the admin area go through the admin-actions affordance
**Rules:** RULE-STD-FRONTEND-111, RULE-STD-BACKEND-011. **Scope:** `src`, read against the admin-only
callables the guard derives. A FULL audit classifies every reviewed entry; a PARTIAL audit, the
touched areas.
```bash
<GUARD_SUITE> -t "admin actions outside the admin area go through the admin-actions affordance"
```
**Expected:** the guard is green. Outside the admin area, every admin-only callable is reached only
through the one shield-marked admin-actions affordance. Every other read of admin standing outside the
admin area is a reviewed entry whose stated purpose is navigation to the admin area, an admin's viewing
reach, or the admin's inbox. Read each reviewed entry against its code: an entry whose read now offers
an action is the finding, and so is an entry whose code is gone. An action that the affordance offers
stays reachable on the admin standing alone (step 70). No installed React package renders a control
gated on admin standing.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

### 122. No promise rejection is discarded without a reason
**Rules:** RULE-STD-ENG-009, RULE-STD-COMMENT-001, RULE-STD-QUALITY-007. **Scope:** every code tree,
source and tests.
```bash
<GUARD_SUITE> -t "no promise rejection is discarded without a reason"
```
**Expected:** the guard is green: every `.catch()` whose handler does nothing — an empty body, or one
that returns `undefined`, `void 0`, or `null` — carries a one-line comment saying why discarding the
rejection is right (a constraint, or an exception naming its rule). Read each comment against its code:
a discard of a failure a person or monitoring needs to see is the finding, whatever the comment says —
it gets real handling. Each reviewed entry is a file whose discards genuinely cannot carry a comment;
one whose file no longer discards is stale.
**Status:** PASS · FAIL · NOT RUN · BLOCKED

## Pass / Fail

Per [README.md](README.md) § Verdict.
