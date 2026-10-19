# Architecture (ARCH)

Where package code lives, who owns it, and how packages stay generic, safe to import, and released
correctly. Package model: `docs/packages/package-architecture.md`. Format and IDs: [README.md](README.md).

### ARCH-001 — One authoritative owner per responsibility or state transition

**Rule.** Each responsibility or state transition a package implements has exactly one owning core,
hook, or module; a package never has two owners for the same transition. Transitions that must be
atomic stay in one transaction or batch under that one owner.

**Why.** Validation, caps, and writes in one place cannot drift between callers.

**Prohibits.**
- Two modules writing one piece of state; importing another core's private internals.

**References.** ENG-002, ENG-003; ARCH-004.

### ARCH-004 — Consolidate duplicates found in touched code; never add another variant

**Rule.** When work touches code that already holds duplicate implementations of one responsibility,
identify the canonical owner and consolidate onto it. Never add another variant to match one
inconsistent copy; when consolidation is out of scope, surface it (ENG-008).

**Why.** Every added variant multiplies the drift.

**Prohibits.**
- A new variant alongside existing duplicates; silently leaving discovered duplication in place.

**References.** ENG-002, ENG-003, ENG-008.

### ARCH-005 — Cross-tree trust contracts: one definition, one proof

**Rule.** A trust contract shared between separately deployed trees — provenance header names,
signed-token and internal-auth shapes, signing and verification primitives, a signed request body
and its byte budget — is ONE definition in the shared package every participating tree imports
(`edge-protocol-core` for a generic contract, `chat-schemas` for a chat contract), never re-declared
per tree. The minting side and the trusting side change together, and a shared test proves the PAIR:
what one side mints is exactly what the other requires. Code carrying trust logic (verification,
signing, provenance) is security code with full review and test obligations. Input read before the
trust check is bounded: cheap pre-body rejects first, a declared `Content-Length` over budget refused,
a running byte count cancelled past the budget, and the signature verified before anything is parsed.

**Why.** Hand-copied header names and token shapes drift silently, and the trusting side stops
proving provenance with nothing failing. An unbounded read before verification lets one unsigned
request exhaust the process.

**Prohibits.**
- Re-declaring a cross-tree header name, token, body shape, or budget anywhere but its shared package.
- Changing one side of a mint/trust pair without the other, or proving it from one side's tests only.
- An unbounded body read, or any parse of a signed body before its signature is verified.

**References.** `docs/packages/edge-protocol-core.md`, `docs/packages/chat-schemas.md`; ENG-002, ENG-006.

### ARCH-102 — One named declaration; enforcement points derive

**Rule.** Every definition a package owns — limits, unions and enums, option and allowlist arrays,
label maps, typed shapes — is ONE named declaration in the package that owns the concept. Enforcement
points derive from it (`.max(MAX_X)`, type positions referencing the canonical union), never restate
it, and every enforcement point of one field enforces the same constraint set. Required text is
non-blank after trimming; a typed number is read from the whole input, never a `parseInt` /
`parseFloat` prefix.

**Why.** A restated value is drift; a constraint present at one point and missing at another is the
same drift one level up.

**Prohibits.**
- Local copies of a canonical union, constant, or map; "keep in sync" pairs.
- Loose `string` typing where a canonical allowlist exists.
- A constraint enforced at one point and missing at another; prefix-parsing user-typed numbers.

**References.** ENG-002, ENG-005.

### ARCH-201 — Generic packages stay application-agnostic; supply policy via factory/adapter

**Rule.** A generic package never contains any app's identifiers, Firestore collection names or
paths, business policy, application copy, moderation policy, domain-event catalog, or app config, and
never imports an application-data package (ARCH-207). Where a generic mechanism needs app-specific
values, it exposes a factory, adapter, callback, schema factory, or configuration object, and the app
wires its values in at its boundary (the `auth-core` `createAssertAuth<TUser, TAdmin>(config)`
pattern). Generic packages also stay monitoring-agnostic (QUALITY-102).

**Why.** An app identifier or policy baked into a generic package makes it un-reusable by the other
app and turns it into a second home for a definition the app owns.

**Prohibits.**
- Any app's identifiers, paths, copy, or policy in a generic package.
- A generic package importing an application-data package.
- Hardcoding app policy where a factory, adapter, or callback should accept it.

**References.** `docs/packages/package-architecture.md`; ENG-004; ARCH-207; QUALITY-102.

### ARCH-202 — Package entry points preserve the safety boundary

**Rule.** Package roots stay server-safe: React exports live behind `./react`, Admin SDK behind
`./server`, browser-only runtime behind `./browser`, CSS behind the style subpath. The intentional
non-pure roots are declared in the boundary suite and nowhere else. Every non-root entry follows the
same purity (ARCH-203). A server-side module graph never
pulls React, browser upload code, or app-shell code, and every client-only peer is declared `optional`
so a server-only install never force-installs React.

**Why.** A server module that pulls React into its graph crashes on cold start; a required
client-only peer forces React into a server-only install.

**Prohibits.**
- A React, browser, or Admin SDK export on a server-safe root.
- A non-pure root outside the declared exceptions; a client-only peer not declared `optional`.
- `import * as X` wildcards across package boundaries; ambient `.d.ts` shims for broken exports.

**References.** `docs/design/react-safety.md`; `docs/packages/package-architecture.md`; ARCH-203.

### ARCH-203 — No compatibility barrels or laundering re-exports

**Rule.** Never hide an unsafe import behind a re-export, and never create a compatibility barrel to
smooth a package move. Canonical imports come from the package that owns the concept; an unused
transitional subpath is deleted once no consumer remains. Every definition a package exports is
exported by exactly one package entry — the entry of the folder that holds it; a file-level entry
exists only for a file no folder entry covers, and a root-level file with no entry of its own belongs
to the root — so the root and a deep entry never forward what a folder entry exports. A consumer
imports each definition from its owning entry.

Inside a package, code imports the file that defines each name — never a folder `index`, a nested
entry, or the package's own name; tests too, except that an entry-surface test may import an entry
`index` to prove it forwards a name. Only an entry `index` re-exports, and only files in its own
subtree, each named directly; an index declares nothing of its own, and no `index.ts` exists that
is not a package entry. An entry not
declared runtime-specific carries no Node, React, or browser runtime import or type, `node:*`
included; the runtime-specific entries are the subpaths `package-architecture.md` § Subpath
conventions names plus the exceptions the boundary suite declares. No package has a runtime import
cycle. Generic packages hold mechanisms, each application-data package holds its app's business,
and a foundation never depends on its adapters. The repo-guards checks in the boundary suite enforce
each of these.

**Why.** A laundering re-export defeats the entry-point boundary silently; a compatibility barrel is
a second name for one concept. Cross-folder imports through indexes manufacture import cycles and
make a consumer evaluate a whole folder to use one name.

**Prohibits.**
- A re-export laundering a `/react`, browser, or Admin SDK import behind a server-safe path.
- A new compatibility barrel; a dead transitional subpath kept after its consumers are gone.
- Two entries of one package exporting the same definition.
- Importing a folder `index`, a nested entry, or the package's own name from inside the package,
  except an entry-surface test proving an entry forwards a name.
- A re-export from any file but an entry `index`; an entry `index` forwarding a file outside its
  subtree or through another index; an `index.ts` that is not an entry; a definition declared in an
  index.
- A Node, React, or browser runtime import or type (`node:*` included) in an entry not declared
  runtime-specific.
- A runtime import cycle inside a package.
- A foundation depending on its adapter; a generic package importing `ttt-core` or `q-core`.

**References.** ARCH-202; ENG-002.

### ARCH-206 — Package Firestore access goes through query-core

**Rule.** React packages read and write Firestore through `query-core`'s `useFirestore*` hooks (one
shared `<FirestoreProvider>` supplies `db`), never direct `firebase/firestore` operations.
`firebase-helpers` and `query-core` are the only direct-Firestore layers. Building constraints and
importing Firestore types is fine. A package needing those hooks declares `query-core` as an
**optional peer** so the app supplies the single instance.

**Sanctioned exception.** A genuine need a query-core hook cannot express carries an in-file
`SANCTIONED EXCEPTION` block and is listed in `docs/packages/package-architecture.md`. The only
current one is `upload-ui`'s in-flight-uploads provider, which needs `onSnapshot` transition events
behind an injectable `FirestoreSubscribeFn`.

**Why.** Scattered direct Firestore calls fork the data layer and break the shared provider identity.

**Prohibits.**
- Direct `getDoc(s)` / `onSnapshot` / `setDoc` / `updateDoc` / `writeBatch` in a React package outside
  query-core and firebase-helpers.
- A package taking its own `db`; an undocumented direct-Firestore path.

**References.** `docs/packages/package-architecture.md`; `docs/packages/query-core.md`.

### ARCH-207 — Application-data packages are not generic packages

**Rule.** An application-data package belongs to one app and holds that app's cross-boundary
schemas, constants, paths, and copy. It may depend on generic packages; no generic package depends
on it. Its content and design are governed by its own app's rulebook, not by this one; this rulebook
governs only how it is built and released alongside the generic packages (ARCH-202, ARCH-208).

**Why.** App business truth needs one home that its app controls, and generic packages must stay
usable by every app.

**Prohibits.**
- A generic package importing an application-data package.
- Moving an app's business definition into a generic package to avoid an app-data release.

**References.** ARCH-201; `docs/packages/package-architecture.md`.

### ARCH-208 — Releases go through the batch release command, patch-only until v1

**Rule.** Every release is a batch through `./scripts/release-multiple.sh <folder> [<folder> ...]
<bump>`; `release-package.sh` is its internal engine, never invoked directly. Until the packages'
v1, every bump is `patch` — additive changes, fixes, and breaking changes alike — because published
internal ranges are 0.x carets, which lock the minor. A breaking change still confirms no consumer
relies on what it removes or alters before it ships. The package gate (`npm run test:quiet`) is green
before any release. A package's very first publish is not a release: it is the one-time setup in
`CLAUDE.md` § First-time publish of a new package, after which every release is the batch command.

**Why.** A `minor` bump escapes every dependent's caret range, so consumers fail to install until
every dependent package republishes in lockstep.

**Prohibits.**
- A `minor` or `major` bump before v1; a release outside the batch command.
- A release with a red package gate.

**References.** `docs/packages/package-architecture.md` (release order, caret pinning).
