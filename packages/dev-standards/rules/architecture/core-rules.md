# Architecture — fundamentals (RULE-STD-ARCH-001–099)

Format, scopes, and rule IDs: [../README.md](../README.md).

Where code lives, who owns it, and how domains compose. Read this file in full whenever a task routes to architecture. The two topic files are read only when the work touches their topic:

- [data-and-contracts.md](data-and-contracts.md) (100s) — a schema, constant, canonical type or union, option map, Firestore path builder, compound document id, or query key; any shape crossing a boundary.
- [packages-and-boundaries.md](packages-and-boundaries.md) (200s) — a `@ttt-productions/*` package: its API, entries, dependencies, ownership split, a release or an adoption cycle, or anything written into ttt-packages.

### RULE-STD-ARCH-001 — One authoritative owner per responsibility or state transition
**Scope.** both

**Rule.** Each responsibility or state transition has exactly one authoritative owner; there are never two owners for the same transition. State transitions that must be atomic stay in one transaction or batch under one owner.

**Packages:** each responsibility or state transition a package implements has one owning core, hook, or module.

**Apps:** each business responsibility or state transition has one core that owns every write to that state — Firestore, Storage, claims, audit events. A domain may have several cores for distinct transitions, and "one core" NEVER means one mega-function for an entire product domain:

```ts
async function runX(input: XInput, callerUid?: string, transaction?: Transaction): Promise<XResult>
```

Create `runX(...)` before a domain's second entry point lands — not after the drift starts. Reads follow the same single-owner principle: components never import `firebase/firestore` directly — every read goes through a React Query hook in `src/hooks/` (exceptions: inside a `queryFn`, root-provider hydration). Storage included: final paths are backend-owned; clients upload only to `uploads/{origin}/{uid}/{fileId}`.

**Why.** Permission checks, caps, validation, audit, and writes live in one place — no drift between entry points' or callers' versions of the same logic.

**Prohibits.**
- Direct writes bypassing the core; two files or modules writing one domain's state.
- Importing another core's private internals.
- Splitting one domain's shared state across separate callables.

**References.** RULE-STD-ENG-002, RULE-STD-ENG-003; RULE-STD-ARCH-002, RULE-STD-ARCH-003, RULE-STD-ARCH-004.

### RULE-STD-ARCH-002 — Entry points are thin adapters
**Scope.** apps

**Rule.** Every entry point to a domain — callable, Firestore/Storage trigger, schedule, composer, admin tool, UI surface — is a thin adapter over the `runX` core that owns that responsibility (RULE-STD-ARCH-001). It wires input, auth, and transaction context; it holds no business logic. Multiple entry points may target the same core: the twin-callable pattern uses a normal `updateX` (actor mode `<MEMBER_ACTOR_MODE>`) and an `adminUpdateX` (actor mode `adminOverride`) sharing one `runX(input, actor, ...)`.

**Why.** Business logic duplicated into an entry-point body is logic that drifts from every other entry point to the same domain.

**Prohibits.**
- Business logic in a trigger, schedule, or composer body.
- A second implementation of a domain's writes hiding inside an entry point.
- Treating a normal callable as an admin override just because the caller holds an admin claim (admin authority is the explicit `adminOverride` mode).

**References.** RULE-STD-ARCH-001, RULE-STD-ARCH-003; RULE-STD-BACKEND-004 (admin authority), RULE-STD-BACKEND-205 (actor mode).

### RULE-STD-ARCH-003 — Cross-domain composition passes the transaction handle
**Scope.** apps

**Rule.** When one core must invoke another core's work as part of the same operation, it imports the owning core and passes the transaction handle through. Server code never calls another callable over HTTPS to compose behavior, and never re-derives another core's writes inline.

**Why.** An HTTPS hop between two server operations breaks atomicity and re-runs auth and serialization for no reason; passing the transaction handle keeps the whole composition in one commit under one owner.

**Prohibits.**
- Server-side `httpsCallable` to reach another domain's logic.
- Re-implementing another core's writes instead of importing and composing it.
- Composing cross-domain writes outside a shared transaction when they must be atomic.

**References.** RULE-STD-ARCH-001, RULE-STD-ARCH-002; RULE-STD-BACKEND-101 (reads before writes).

### RULE-STD-ARCH-004 — Consolidate duplicates found in touched code; never add another variant
**Scope.** both

**Rule.** When work touches code that already holds duplicate implementations of one responsibility — two writers, two cores, two components, two constants for the same truth — identify the canonical owner and consolidate onto it. Never add another variant to match one inconsistent copy; when consolidation is out of the current scope, surface it (RULE-STD-ENG-008).

**Why.** Every added variant multiplies the drift the one-owner rules exist to prevent; "make mine match the broken one" ships two bugs instead of fixing one.

**Prohibits.**
- Adding a new variant or copy alongside existing duplicates rather than consolidating.
- "It was faster to build my own" as justification for a parallel implementation.
- Silently leaving discovered duplication in place.

**References.** RULE-STD-ENG-002, RULE-STD-ENG-003, RULE-STD-ENG-008; RULE-STD-ARCH-001; RULE-STD-FRONTEND-001.

### RULE-STD-ARCH-005 — Cross-tree trust contracts: one definition, one proof
**Scope.** both

**Rule.** A trust contract shared between separately deployed trees — provenance header names, signed-token and internal-auth shapes, signing and verification primitives, a signed request body and its byte budget — is ONE definition in the shared package every participating tree installs and imports, never re-declared per tree: `@ttt-productions/edge-protocol-core` for a generic contract, `<APP_DATA_PACKAGE>` for an app-specific shape, and `@ttt-productions/chat-schemas` for a chat contract. The minting side and the trusting side change in the same change set, and a shared test or guard proves the PAIR — that what one side mints is exactly what the other requires; two per-tree tests of the two halves separately do not satisfy this. Code in any tree that carries trust logic (verification, signing, provenance) is backend security code with the same review, testing, and monitoring obligations as the Functions tree, wherever it is deployed. Input read before the trust check is bounded: cheap pre-body rejects run first, a declared `Content-Length` over budget is refused, the read keeps a running byte count it cancels past the budget, and the signature is verified before anything is parsed.

**Why.** Header names and token shapes hand-copied across trees that cannot import each other drift silently: the trusting side keeps requiring a name the minting side renamed, or stops requiring one, and nothing fails until the boundary has quietly stopped proving provenance. An unbounded read ahead of verification leaves the same boundary open another way: one unsigned request can exhaust the process that serves every other request.

**Prohibits.**
- Re-declaring a cross-tree header name, token shape, body shape, budget, or secret-binding name anywhere but its shared package, or declaring it in one tree's own source where the other side cannot import it.
- Changing one side of a mint/trust pair without the other, or evidencing the contract only from one side's tests.
- Holding trust code in any tree to a lower testing or review bar than the equivalent Functions code.
- An unbounded body read, or any parse of a signed body before its signature is verified.

**References.** ttt-packages `docs/packages/edge-protocol-core.md`, `docs/packages/chat-schemas.md`; RULE-STD-ENG-002, RULE-STD-ENG-006, RULE-STD-ENG-007; RULE-STD-ARCH-101, RULE-STD-ARCH-201, RULE-STD-ARCH-209; RULE-STD-BACKEND-012.

### RULE-STD-ARCH-006 — Code from another product is adapted, never carried with its identity
**Scope.** apps

**Rule.** When an app takes a mechanism from another product, it reads that product only where the workspace's scope rules allow it, and what crosses is the mechanism, renamed and adapted to the app's own domain, paths, and rules. What never crosses is the source product's identity: none of its identifiers (a prefix or name on a symbol, file, CSS class, env var, collection, or string), none of its domain concepts, and none of its policy values carried because they were in the source. The `@ttt-productions/*` package specifier is the one sanctioned occurrence. A generic mechanism both apps need goes into a shared package (RULE-STD-ARCH-201, RULE-STD-ARCH-205) rather than being copied twice.

**Why.** A copied identifier is a second name for another product's concept living in a product that has no such concept, and it is the tell that the code was pasted rather than understood — the next reader keeps the name, the drift compounds, and the mechanism that should have been a package is now two copies.

**Prohibits.**
- Another product's prefix or name on a symbol, class, file, env var, or string in the app's source, Functions, end-to-end tests, or rules files, other than an `@ttt-productions/*` import.
- Another product's domain concept in the app's code.
- Copying a mechanism into both apps when it belongs in a shared package.

**References.** RULE-STD-ENG-002, RULE-STD-ENG-004; RULE-STD-ARCH-201, RULE-STD-ARCH-205.
