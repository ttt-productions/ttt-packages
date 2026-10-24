# Crosswalk — every shared rule to its audit

Every `RULE-STD-*` rule, mapped to the shared playbook steps that audit it (`<playbook> <step
numbers>`, each playbook named without its `-playbook.md` suffix), the repo-guards generic guards
that enforce it (by id; a guard runs alone with `<GUARD_SUITE> -t "<its title>"`), or **no audit step
yet** — a gap for DJ to decide. No shared rule is left unlisted. The steps cite the rules; this table
is derived from their **Rules** lines, so a change to a step's Rules line, a guard, or a rule updates
this table in the same change (RULE-STD-QUALITY-203). An app's own steps and business guards add to a
rule's coverage in its additions; they are not listed here.


## ENG

| Rule | Title | Audited by (shared steps) | Guards |
|---|---|---|---|
| RULE-STD-ENG-001 | Read the governing context | codebase-hygiene 30, 69 | — |
| RULE-STD-ENG-002 | One change point | codebase-hygiene 28, 31, 38, 83, 91, 117; data-integrity 3; observability 2; package-boundaries 4, 5 | `appConfigReader` |
| RULE-STD-ENG-003 | Extend existing owners; no parallel systems | codebase-hygiene 31; media-pipeline 6; package-boundaries 5 | — |
| RULE-STD-ENG-004 | Behavior lives where its concept is owned | codebase-hygiene 31, 41, 83 | — |
| RULE-STD-ENG-005 | Derive from canonical definitions | codebase-hygiene 16, 52, 61, 83, 119 | `definitionRedeclaration` |
| RULE-STD-ENG-006 | The backend is the security boundary | codebase-hygiene 23, 53, 77, 99, 101, 107; auth-boundary 8, 9, 12, 13; callable-functions 11, 12, 13; client-write-security-audit 2, 11; firestore-storage-rules 4, 5, 11; migration 7; testing-coverage 3 | `localOnlyVariables`, `envPublicValues` |
| RULE-STD-ENG-007 | Behavior, tests, and documentation move together | testing-coverage 2, 7 | — |
| RULE-STD-ENG-008 | Surface discovered problems | codebase-hygiene 25, 27, 73 | — |
| RULE-STD-ENG-009 | Fail truthfully and visibly | codebase-hygiene 60, 75, 83, 87, 88, 90, 122; async-workflow 7; auth-boundary 14; callable-functions 9; data-integrity 13; migration 9; observability 3, 4, 6, 7, 8, 10; performance-audit 3; testing-coverage 11; ux-audit 11 | `swallowedRejections` |
| RULE-STD-ENG-010 | Spawned agents inherit the rules | codebase-hygiene 69 — Designated manual review (step 69): verified on the spawning prompt, never by a search of the repo. | — |
| RULE-STD-ENG-011 | Once data is live, persisted shapes change with a migration path | client-write-security-audit 8; data-integrity 7; migration 3, 5 | — |

## ARCH

| Rule | Title | Audited by (shared steps) | Guards |
|---|---|---|---|
| RULE-STD-ARCH-001 | One authoritative owner per responsibility or state transition | codebase-hygiene 31; auth-boundary 8; data-integrity 1, 2, 3, 5; migration 2, 4 | — |
| RULE-STD-ARCH-002 | Entry points are thin adapters | codebase-hygiene 31; migration 2 | — |
| RULE-STD-ARCH-003 | Cross-domain composition passes the transaction handle | codebase-hygiene 31; performance-audit 9 | — |
| RULE-STD-ARCH-004 | Consolidate duplicates found in touched code; never add another variant | codebase-hygiene 31, 38, 68 | — |
| RULE-STD-ARCH-005 | Cross-tree trust contracts: one definition, one proof | codebase-hygiene 31; auth-boundary 13; testing-coverage 2 | — |
| RULE-STD-ARCH-006 | Code from another product is adapted, never carried with its identity | **No audit step yet.** No shared step; an app's own step is the candidate. | — |
| RULE-STD-ARCH-101 | `<APP_DATA_PACKAGE>` owns cross-boundary contracts | codebase-hygiene 16, 18, 31, 51, 56, 80; client-write-security-audit 8; data-integrity 2, 7, 8; dependency-audit 1, 4, 5; field-lineage 5; migration 1 | `isolatedRoots`, `tsconfigAliasesInRoot` |
| RULE-STD-ARCH-102 | One named declaration; enforcement points derive | codebase-hygiene 31, 51, 61, 99; callable-functions 3; client-write-security-audit 8; data-integrity 7; dependency-audit 5; migration 8 | `definitionRedeclaration`, `schemaLengthLiterals`, `textFieldDeclarations`, `schemaBounds`, `enumLabels`, `appRouteOwner` |
| RULE-STD-ARCH-103 | Persist identity references, not snapshots | codebase-hygiene 35; data-integrity 2, 13; field-lineage 1, 2, 3, 5 | — |
| RULE-STD-ARCH-104 | Canonical Firestore paths and compound-camelCase naming | codebase-hygiene 10, 12, 56, 80, 117; data-integrity 8; field-lineage 3; firestore-storage-rules 1 | `firestorePathAssembly`, `firestoreLiteralSegments`, `firestoreRetiredSegments`, `firestoreTestPaths`, `rulesMirrorCore` |
| RULE-STD-ARCH-105 | Timestamps are epoch milliseconds via firebase-helpers | codebase-hygiene 9 | `firestoreTimestampNow` |
| RULE-STD-ARCH-106 | Client-supplied identity, paths, and targets are never authoritative | codebase-hygiene 77, 99; auth-boundary 12; client-write-security-audit 5, 11; firestore-storage-rules 6; media-pipeline 3 | `documentIdSegments` |
| RULE-STD-ARCH-109 | Compound document IDs have one builder and one parser | **No audit step yet.** Hygiene step 10 catches hand-assembled paths, not a compound id built or split inline; an app's own data-integrity step is the candidate to promote here. | — |
| RULE-STD-ARCH-201 | Generic packages stay application-agnostic; supply policy via factory/adapter | codebase-hygiene 41; package-boundaries 1, 4 | `applicationDataImports`, `installedPackagesAgnostic` |
| RULE-STD-ARCH-202 | Package entry points preserve the safety boundary; consumers import from the entry that matches the runtime | codebase-hygiene 17; dependency-audit 10, 13; package-boundaries 9; react-leak-audit 1, 2, 3, 4, 5, 6, 7, 9 | `packageEntryPoints`, `entryPurity`, `packageWildcardImports` |
| RULE-STD-ARCH-203 | One import path per definition; no compatibility barrels or laundering re-exports | codebase-hygiene 17, 25, 38; dependency-audit 10; package-boundaries 6; react-leak-audit 1, 2 | `importPaths`, `packageEntries`, `packageEntryImports`, `packageImports`, `packageImportCycles` |
| RULE-STD-ARCH-204 | Adoption wrappers keep the app's call-site shape | dependency-audit 5; migration 3, 4 | — |
| RULE-STD-ARCH-205 | Packages-first; no publish-avoidance shims | codebase-hygiene 16, 80, 96; dependency-audit 1, 3, 4, 5, 8; migration 3; react-leak-audit 7 | `coreContracts`, `noOutsideCheckout` |
| RULE-STD-ARCH-206 | Package Firestore access goes through query-core | package-boundaries 3 | — |
| RULE-STD-ARCH-207 | Application-data packages are not generic packages | package-boundaries 1 | `applicationDataImports` |
| RULE-STD-ARCH-208 | Releases go through the batch release command, patch-only until v1 | codebase-hygiene 96 | — |
| RULE-STD-ARCH-209 | Everything in ttt-packages is public | **No audit step yet.** The run's one-time public-content gate checks the first publish; no standing step audits what ttt-packages ships. | — |

## BACKEND

| Rule | Title | Audited by (shared steps) | Guards |
|---|---|---|---|
| RULE-STD-BACKEND-001 | Authentication boundary: `assertAuth` first, canonical hostname | codebase-hygiene 32, 36; auth-boundary 1, 2, 3; callable-functions 2; testing-coverage 3 | — |
| RULE-STD-BACKEND-002 | Schema-validate untrusted input before use | codebase-hygiene 18, 32, 77; auth-boundary 12; callable-functions 3; client-write-security-audit 11 | `coreContracts` |
| RULE-STD-BACKEND-003 | Resource authorization inside the transaction | codebase-hygiene 32, 97; callable-functions 4; testing-coverage 3 | — |
| RULE-STD-BACKEND-004 | Admin authority is explicit; the claim is metadata | codebase-hygiene 32, 49, 70; auth-boundary 4; callable-functions 4; firestore-storage-rules 4 | `adminClaimRead` |
| RULE-STD-BACKEND-005 | Identity fields must match the authenticated caller | codebase-hygiene 77; auth-boundary 2, 12; callable-functions 2; client-write-security-audit 5, 11; firestore-storage-rules 6; testing-coverage 3 | — |
| RULE-STD-BACKEND-010 | Callables enforce App Check attestation | codebase-hygiene 29; auth-boundary 3, 12, 13; callable-functions 6, 12 | `appCheck` |
| RULE-STD-BACKEND-011 | Admin capability is self-sufficient; never coupled to a participant status | codebase-hygiene 70, 121 | — |
| RULE-STD-BACKEND-012 | Privileged route handlers and server modules carry the callable obligations | codebase-hygiene 23, 77; auth-boundary 12; callable-functions 12; client-write-security-audit 11 | — |
| RULE-STD-BACKEND-013 | Named surface classes carry a rate-limit decision | codebase-hygiene 40, 77; auth-boundary 12; callable-functions 5 | `rateLimitSurfaces` |
| RULE-STD-BACKEND-101 | All transaction reads before all transaction writes | codebase-hygiene 97; async-workflow 6; callable-functions 8; data-integrity 5 | — |
| RULE-STD-BACKEND-102 | create() / merge-set semantics on client-chosen IDs | codebase-hygiene 52; client-write-security-audit 5; firestore-storage-rules 6; migration 5 | `firestoreRandomUuidSites` |
| RULE-STD-BACKEND-103 | Concurrent arrays use atomic array operations | client-write-security-audit 6; migration 5 | — |
| RULE-STD-BACKEND-104 | Dotted paths only in update(); nested objects in merge-sets | codebase-hygiene 55; testing-coverage 11 | — |
| RULE-STD-BACKEND-105 | No PII on readable docs; use the privateData subcollection | auth-boundary 7; callable-functions 11; firestore-storage-rules 5 | — |
| RULE-STD-BACKEND-106 | Content writes route through callables | callable-functions 5; client-write-security-audit 1, 2; data-integrity 1; firestore-storage-rules 8; media-pipeline 3 | — |
| RULE-STD-BACKEND-108 | Singleton config/system docs live in one of three audience buckets | codebase-hygiene 56; auth-boundary 7; callable-functions 11; firestore-storage-rules 4, 5 | `singletonBucketAudience` |
| RULE-STD-BACKEND-109 | Field-aware allowlist rules on sensitive collections | auth-boundary 5; client-write-security-audit 3; firestore-storage-rules 1, 2, 4, 7, 8, 11; migration 7; testing-coverage 5 | `rulesClaimNames` |
| RULE-STD-BACKEND-111 | Custom claims merge, never overwrite | codebase-hygiene 31; auth-boundary 4 | — |
| RULE-STD-BACKEND-112 | Reads are bounded and index-backed | codebase-hygiene 98, 105; async-workflow 9; data-integrity 13; migration 6; performance-audit 1, 2, 3, 8 | `firestoreCollectionGroupIndexes` |
| RULE-STD-BACKEND-113 | Batch reads; no per-item read loop | performance-audit 9 | — |
| RULE-STD-BACKEND-114 | Scripts that write project data follow the backend write rules | codebase-hygiene 10; migration 1, 2, 5, 6, 10; testing-coverage 7 | `projectScripts` |
| RULE-STD-BACKEND-115 | A write stores only fields the document's `<APP_DATA_PACKAGE>` schema declares | codebase-hygiene 51, 80; data-integrity 7; migration 8 | `firestoreWrites` |
| RULE-STD-BACKEND-116 | Every write precondition is decided inside the write's transaction | codebase-hygiene 97, 108, 111; callable-functions 4 | `firestoreTransactionReads` |
| RULE-STD-BACKEND-117 | An existence-probe get proves ownership from the path, never from `resource.data` | codebase-hygiene 107 | — |
| RULE-STD-BACKEND-119 | A counter decrement reads the counter in its transaction and never writes it below zero | codebase-hygiene 111 | `firestoreCounterDecrements` |
| RULE-STD-BACKEND-120 | A rules change ships positive and negative access assertions | codebase-hygiene 46; auth-boundary 10; client-write-security-audit 9; firestore-storage-rules 10, 12; media-pipeline 10; migration 10; testing-coverage 5 | — |
| RULE-STD-BACKEND-201 | Sensitive state is backend-owned | codebase-hygiene 21; async-workflow 2; auth-boundary 5; client-write-security-audit 4, 6; data-integrity 1, 4; firestore-storage-rules 2, 7, 8; media-pipeline 5, 6 | — |
| RULE-STD-BACKEND-202 | The audit event commits atomically with the action | codebase-hygiene 20; callable-functions 10; observability 4 | — |
| RULE-STD-BACKEND-203 | Audit events are append-only | codebase-hygiene 20; firestore-storage-rules 8; migration 9 | `auditPayload` |
| RULE-STD-BACKEND-204 | Log failed sensitive attempts | codebase-hygiene 20, 108; callable-functions 10; observability 4 | `failureAuditChain`, `refusalAudit` |
| RULE-STD-BACKEND-205 | Every audited action declares its actor mode explicitly | codebase-hygiene 20, 49; auth-boundary 4 | `auditWriter` |
| RULE-STD-BACKEND-206 | Projections and moderation cascades are server-owned | auth-boundary 7 | — |
| RULE-STD-BACKEND-209 | No Partial<T> sensitive mutations | codebase-hygiene 21, 80; client-write-security-audit 4 | — |
| RULE-STD-BACKEND-210 | An account holding admin standing is never restricted | codebase-hygiene 108 | — |
| RULE-STD-BACKEND-211 | One audit writer; an event's origin comes from the request | codebase-hygiene 20, 49 | `auditWriter`, `requestOrigin`, `noAuthBlockingFunction` |
| RULE-STD-BACKEND-212 | Repair actions record a reason and the state they replaced | codebase-hygiene 65 — UI half only (the dialog gathers the reason a repair requires). **No audit step yet** for the backend half — the required reason and the recorded prior state; an app's own callable step is the candidate to promote here. | — |
| RULE-STD-BACKEND-301 | Post-commit side effects are non-blocking | codebase-hygiene 33; async-workflow 2, 7 | `postCommitCapture`, `fireAndForget` |
| RULE-STD-BACKEND-302 | Required work commits atomically or rides a durable outbox | codebase-hygiene 33, 105; async-workflow 2, 5, 6; callable-functions 8; data-integrity 10; migration 6; observability 5 | `swallowedReadWrite` |
| RULE-STD-BACKEND-303 | Cloud Functions concurrency is explicit on every heavy function | codebase-hygiene 64, 67; async-workflow 9, 12; callable-functions 1; media-pipeline 11; migration 6; performance-audit 6, 7, 8 | `codebaseManifest`, `lightFunctions` |
| RULE-STD-BACKEND-304 | Retried background work is idempotent | codebase-hygiene 50, 102, 112; async-workflow 3, 4, 8, 9, 10; callable-functions 8; data-integrity 6, 13; media-pipeline 7, 8, 11; migration 5, 6; observability 5; performance-audit 8; testing-coverage 4 | — |
| RULE-STD-BACKEND-305 | Callable names reveal their Firestore effect | codebase-hygiene 13 | — |
| RULE-STD-BACKEND-306 | Notifications: sanctioned lanes, one ledger and materializer | codebase-hygiene 31, 50, 112; async-workflow 8 | — |
| RULE-STD-BACKEND-307 | External services bind through one app adapter | codebase-hygiene 29, 40; async-workflow 7; callable-functions 1, 5, 7, 13; data-integrity 10; dependency-audit 6; media-pipeline 6; observability 9 | `secretBindings` |
| RULE-STD-BACKEND-308 | Emulator-only bypasses gate on the sanctioned emulator flag; no development-mode security bypass | codebase-hygiene 23; auth-boundary 12; callable-functions 12; media-pipeline 6 | — |
| RULE-STD-BACKEND-309 | A scheduled job isolates its passes and its rows | codebase-hygiene 105; async-workflow 9 | `scheduledPassIsolation` |
| RULE-STD-BACKEND-310 | A user-visible lane's first event has a signal | codebase-hygiene 112 | — |

## FRONTEND

| Rule | Title | Audited by (shared steps) | Guards |
|---|---|---|---|
| RULE-STD-FRONTEND-001 | One canonical component/variant/class per repeated UI pattern | codebase-hygiene 60, 68 | `readStateOwner`, `showMoreToggle`, `pendingNameSeat` |
| RULE-STD-FRONTEND-002 | One stylesheet entry point, pinned layer order, no direct CSS imports | codebase-hygiene 15, 66 | `stylesheetEntry`, `tailwindSources`, `semanticTextCollision` |
| RULE-STD-FRONTEND-003 | All colors resolve through theme tokens; no hex or raw HSL in app code | codebase-hygiene 15; ux-audit 4 | `colorLiterals`, `themeTokens`, `statusForegroundOnFill` |
| RULE-STD-FRONTEND-006 | State changes swap icons; destructive red lives only inside confirmation dialogs | codebase-hygiene 65, 68 | — |
| RULE-STD-FRONTEND-007 | One page column, one card recipe, truncation everywhere | codebase-hygiene 68; testing-coverage 10; ux-audit 3, 12 | — |
| RULE-STD-FRONTEND-008 | Semantic classes over repeated inline Tailwind; ui-core built-ins not overridden per-instance | codebase-hygiene 15, 68 | `themeScaleClasses`, `shadowOwnership`, `stackOnRows` |
| RULE-STD-FRONTEND-010 | Browser storage holds device-local state only, through guarded access | codebase-hygiene 31 | `browserStorage` |
| RULE-STD-FRONTEND-101 | React Query owns all server state | codebase-hygiene 1; performance-audit 4, 5 | `callableReads` |
| RULE-STD-FRONTEND-102 | Query keys come from `<QUERY_KEYS_MODULE>`; freshness from `STALE_TIMES` | codebase-hygiene 1, 2, 17; performance-audit 4 | `queryKeys`, `authScopedKeys` |
| RULE-STD-FRONTEND-103 | Invalidation is registry-owned; infinite feeds are patched, never invalidated | codebase-hygiene 1, 2, 3, 114; performance-audit 4; ux-audit 6 | `domainEventRegistry`, `queryCache` |
| RULE-STD-FRONTEND-104 | Components never import `firebase/firestore` directly | codebase-hygiene 7, 91; client-write-security-audit 1; performance-audit 5 | `firestoreRuntimeInUi`, `firestoreLiveSubscriptions` |
| RULE-STD-FRONTEND-105 | One callable invocation path; never raw `httpsCallable` | codebase-hygiene 31, 60; observability 6; ux-audit 8, 11; package-boundaries 5 | `callableTransport`, `callableNames`, `callableDoubleSurface` |
| RULE-STD-FRONTEND-106 | Gated actions go through the canonical auth gate | codebase-hygiene 36, 101; auth-boundary 9 | `clientAuthBoundary`, `bannedAuthCalls` |
| RULE-STD-FRONTEND-107 | The client never writes sensitive state | codebase-hygiene 21; client-write-security-audit 1, 2, 4; data-integrity 4; firestore-storage-rules 7 | — |
| RULE-STD-FRONTEND-108 | Auth-scoped subscribers reset on identity change | codebase-hygiene 35, 114; auth-boundary 14 | `authScopedKeys`, `signOutLiveness` |
| RULE-STD-FRONTEND-109 | One owner per data-layer failure's user-facing copy; never a raw SDK string | codebase-hygiene 60; ux-audit 8 | `callableErrorCopy`, `readFailureCopy`, `errorInternalsRender` |
| RULE-STD-FRONTEND-110 | An offered action mirrors the backend's predicate | codebase-hygiene 101, 108; auth-boundary 9 | — |
| RULE-STD-FRONTEND-111 | Admin actions outside the admin area go through the one admin-actions affordance | codebase-hygiene 121 | `adminActionSurface` |
| RULE-STD-FRONTEND-201 | Every async control shows its own pending state through the shared primitives | codebase-hygiene 57, 65, 68; ux-audit 2, 5, 6, 11, 12 | `loadingFeedback` |
| RULE-STD-FRONTEND-202 | ConsequenceDialog for consequential confirmations | codebase-hygiene 57, 65, 68, 104 | — |
| RULE-STD-FRONTEND-203 | Accessibility baseline: landmarks, labels, focus, Escape | codebase-hygiene 68, 103; ux-audit 4, 5, 12 | `accessibleControls`; guard-enforced: the `@ttt-productions/dev-standards/node/a11y` axe run (default, high-contrast, reduced-motion) in the app's e2e stage, and the shared ESLint base's `jsx-a11y` recommended rules |
| RULE-STD-FRONTEND-204 | Motion uses tokens, opacity/transform only, one reduced-motion kill-switch | codebase-hygiene 68, 103; ux-audit 4 | `motionTokens`, `effectiveMotion` |
| RULE-STD-FRONTEND-205 | Every in-app navigation goes through the navigation helper | codebase-hygiene 37, 82, 104; ux-audit 2, 6 | `navigationHelper`, `rootLayoutOrder` |
| RULE-STD-FRONTEND-206 | Pending, failed, and answered reads never stand in for one another | codebase-hygiene 57, 101; ux-audit 2, 11 | `hookReadDefault`, `defaultedReadBinding`, `readRetryState`, `laterPageFailure` |
| RULE-STD-FRONTEND-207 | Unsaved input is never discarded silently | codebase-hygiene 104; ux-audit 5 | `editorPermissionGate` |

## MEDIA

| Rule | Title | Audited by (shared steps) | Guards |
|---|---|---|---|
| RULE-STD-MEDIA-001 | One upload pipeline; fileOrigin ties the surface together | codebase-hygiene 31; firestore-storage-rules 9; media-pipeline 1, 7, 9 | — |
| RULE-STD-MEDIA-002 | Upload path invariant (LAW) | codebase-hygiene 6, 11; auth-boundary 8; client-write-security-audit 7; firestore-storage-rules 9, 12; media-pipeline 2, 4 | `storageUploadOrigins` |
| RULE-STD-MEDIA-003 | One guarded upload helper | codebase-hygiene 6 | — |
| RULE-STD-MEDIA-004 | Server derives targets; never trust client-supplied targets | auth-boundary 8; client-write-security-audit 7; firestore-storage-rules 9; media-pipeline 3 | — |
| RULE-STD-MEDIA-005 | Upload hooks consume their variables schema | codebase-hygiene 5 | — |
| RULE-STD-MEDIA-006 | A new origin extends the registry, rules, routing, and tests in lockstep | codebase-hygiene 5, 6; media-pipeline 2, 9 | — |
| RULE-STD-MEDIA-007 | Pickers render local upload state only | codebase-hygiene 4, 6 | `uploadListeners` |
| RULE-STD-MEDIA-008 | Upload UI ends at handoff; the tray owns processing | codebase-hygiene 58; ux-audit 6 | — |
| RULE-STD-MEDIA-009 | Cancellation and navigation guarding are package-owned | codebase-hygiene 37, 82, 104; ux-audit 6 | — |
| RULE-STD-MEDIA-010 | Upload-surface components own their full lifecycle | codebase-hygiene 39 | — |
| RULE-STD-MEDIA-101 | One media renderer | codebase-hygiene 14, 53, 59; media-pipeline 5 | `mediaRenderer`, `mimePrefixClassification` |
| RULE-STD-MEDIA-102 | One IntersectionObserver per viewer | codebase-hygiene 59 | — |

## QUALITY

| Rule | Title | Audited by (shared steps) | Guards |
|---|---|---|---|
| RULE-STD-QUALITY-001 | Behavior changes ship with their tests | codebase-hygiene 46, 117, 118, 119; async-workflow 10; auth-boundary 10; callable-functions 10; client-write-security-audit 9; firestore-storage-rules 10; media-pipeline 10; migration 10; testing-coverage 2, 3, 4, 7, 10, 11 | `partialMocks`, `sharedFakes` |
| RULE-STD-QUALITY-002 | Verify at the cost of the fix; one full gate | testing-coverage 1, 9 | — |
| RULE-STD-QUALITY-003 | E2E is green only at zero failures AND zero retry-passes | testing-coverage 1, 6 | — |
| RULE-STD-QUALITY-004 | E2E tests use the established fixtures and web-first assertions | codebase-hygiene 28; migration 10; testing-coverage 6, 8, 10 | — |
| RULE-STD-QUALITY-006 | Lint and format: zero suppression in apps, reasoned disables in packages; one enforced format | codebase-hygiene 73; package-boundaries 7 | — |
| RULE-STD-QUALITY-007 | Guard tests enforce ownership and boundaries, never inventories | codebase-hygiene 35, 42, 63, 80, 83, 87, 88, 90, 91, 95, 96, 117, 118, 119, 120, 122 | — |
| RULE-STD-QUALITY-008 | Rules and E2E run against a fresh dev:e2e | codebase-hygiene 29; dependency-audit 3; firestore-storage-rules 10; testing-coverage 1, 9 | — |
| RULE-STD-QUALITY-009 | A test loads the code it tests when its file loads | codebase-hygiene 42, 118; package-boundaries 8 | `testCaseModuleLoads` |
| RULE-STD-QUALITY-010 | A test's time limit names a budget | codebase-hygiene 119; package-boundaries 10 | `testTimeouts` |
| RULE-STD-QUALITY-011 | `test:quiet` is the canonical gate; a stage named by hand never skips | testing-coverage 1, 9 | `ciParity` |
| RULE-STD-QUALITY-101 | Every Cloud Function is monitored through monitoring-core withScope | codebase-hygiene 40, 87; callable-functions 9; observability 1, 2, 3, 4, 9 | `monitoring` |
| RULE-STD-QUALITY-102 | Generic packages stay monitoring-agnostic; each app binds monitoring once | codebase-hygiene 31, 40; callable-functions 9; observability 1, 9; package-boundaries 2 | `monitoring` |
| RULE-STD-QUALITY-103 | No duplicate captures or error surfaces where a wrapper owns them | codebase-hygiene 60, 114; observability 6; ux-audit 8, 11 | — |
| RULE-STD-QUALITY-104 | Must-complete background work exposes durable failure/retry state | codebase-hygiene 33, 50; async-workflow 1, 5, 7, 12; data-integrity 10; media-pipeline 8; migration 6; observability 5; performance-audit 8 | — |
| RULE-STD-QUALITY-105 | Callable error-exits go through `<CALLABLE_ERROR_EXIT>`; designed refusals are silent | codebase-hygiene 87; observability 3 | — |
| RULE-STD-QUALITY-106 | Telemetry carries diagnostics, never request content | codebase-hygiene 40; callable-functions 9; observability 9 | `telemetryTagKeys` |
| RULE-STD-QUALITY-107 | Every failure reaches one capture owner; a catch never ends at the user's screen | observability 6 | `authFailureCapture` |
| RULE-STD-QUALITY-201 | Docs match the current implementation | codebase-hygiene 27; observability 7 | — |
| RULE-STD-QUALITY-202 | No drift-prone inventories in permanent docs | codebase-hygiene 27; observability 7; react-leak-audit 8 | — |
| RULE-STD-QUALITY-203 | New or changed patterns update the owning playbook step | codebase-hygiene 69, 75 | — |
| RULE-STD-QUALITY-205 | Doc taxonomy: each home keeps its distinct purpose | codebase-hygiene 30, 69 | — |

## COMMENT

| Rule | Title | Audited by (shared steps) | Guards |
|---|---|---|---|
| RULE-STD-COMMENT-001 | No comment unless the code cannot say it | codebase-hygiene 89, 122 | `swallowedRejections` |
| RULE-STD-COMMENT-002 | No dates | codebase-hygiene 89 | — |
| RULE-STD-COMMENT-003 | No line numbers | codebase-hygiene 89 | — |
| RULE-STD-COMMENT-004 | No ticket names or work labels | codebase-hygiene 89 | — |
| RULE-STD-COMMENT-005 | No history | codebase-hygiene 89 | — |
| RULE-STD-COMMENT-006 | No people or review sources | codebase-hygiene 89 | — |
| RULE-STD-COMMENT-007 | No narrating the obvious, no change notes | codebase-hygiene 89 | — |
| RULE-STD-COMMENT-008 | No commented-out code, no TODO | codebase-hygiene 89 | — |
| RULE-STD-COMMENT-009 | Test names state behavior, with no tags | codebase-hygiene 89, 117 | — |
| RULE-STD-COMMENT-010 | Only point at things that cannot drift | codebase-hygiene 89 | — |
| RULE-STD-COMMENT-011 | No links to outside sources | codebase-hygiene 89 | — |
| RULE-STD-COMMENT-012 | No comment describes a security mechanism | codebase-hygiene 89 | — |

## Gaps for DJ

Each rule below has no standing shared audit for all or part of it. Each is DJ's decision:
add a shared step (promoting the app step named, where one exists), name a guard, or accept
the gap.

- RULE-STD-ARCH-006 — Code from another product is adapted, never carried with its identity
- RULE-STD-ARCH-109 — Compound document IDs have one builder and one parser
- RULE-STD-ARCH-209 — Everything in ttt-packages is public
- RULE-STD-BACKEND-212 — Repair actions record a reason and the state they replaced
