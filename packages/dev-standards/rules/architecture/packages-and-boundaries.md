# Architecture — packages and boundaries (RULE-STD-ARCH-200–299)

Format, scopes, and rule IDs: [../README.md](../README.md).

How `@ttt-productions/*` packages stay generic, safe to import, and correctly released; how an app imports and adopts them; and what may be written into ttt-packages at all. Package model: ttt-packages `docs/packages/package-architecture.md`. Fundamentals: [core-rules.md](core-rules.md).

### RULE-STD-ARCH-201 — Generic packages stay application-agnostic; supply policy via factory/adapter
**Scope.** packages

**Rule.** A generic package never contains any app's identifiers, Firestore collection names or paths, business policy, application copy, moderation policy, domain-event catalog, or app config, and never imports an application-data package (RULE-STD-ARCH-207). Where a generic mechanism needs app-specific values, it exposes a factory, adapter, callback, schema factory, or configuration object, and the app wires its values in at its boundary (the `auth-core` `createAssertAuth<TUser, TAdmin>(config)` pattern). Generic packages also stay monitoring-agnostic (RULE-STD-QUALITY-102).

**Why.** An app identifier or policy baked into a generic package makes it un-reusable by the other app and turns it into a second home for a definition the app owns.

**Prohibits.**
- Any app's identifiers, paths, copy, or policy in a generic package.
- A generic package importing an application-data package.
- Hardcoding app policy where a factory, adapter, or callback should accept it.

**References.** ttt-packages `docs/packages/package-architecture.md`; RULE-STD-ENG-004; RULE-STD-ARCH-207; RULE-STD-QUALITY-102.

### RULE-STD-ARCH-202 — Package entry points preserve the safety boundary; consumers import from the entry that matches the runtime
**Scope.** both

**Rule.** **Packages:** package roots stay server-safe: React exports live behind `./react`, Admin SDK behind `./server`, browser-only runtime behind `./browser`, CSS behind the style subpath. The intentional non-pure roots are declared in the boundary suite and nowhere else. Every non-root entry follows the same purity (RULE-STD-ARCH-203). A server-side module graph never pulls React, browser upload code, or app-shell code, and every client-only peer is declared `optional` so a server-only install never force-installs React. An application-data package's root, which Cloud Functions and the browser both import, holds types, schemas, constants, unions, builders, and pure functions only.

**Apps:** an app imports `@ttt-productions/*` from the entry point that matches the runtime: server-safe primitives (constants, schemas, pure functions, type-only imports) → main; React runtime → `/react`; Cloud Functions/Admin SDK → `/server`; browser upload runtime → `/browser`; CSS → the style subpath. Type-only imports stay on main even when `/react` exists. An app's backend module graph never pulls React, browser upload code, or app-shell code.

A consumer — app or package — imports each package definition by name, never the whole module through `import * as`, `export * as`, or `export * from` a package; the repo-guards `packageWildcardImports` check enforces it.

**Companion conventions (apps).** Callable input Zod schemas live in `<APP_DATA_PACKAGE>/schemas/<domain>`, backend-only inputs included (RULE-STD-BACKEND-002). Backend chat schema imports use `chat-schemas`, never `chat-core` or the React `chat-react` runtime. `transpilePackages` carries only frontend-imported packages.

**Why.** A server module that pulls React into its graph crashes on cold start — the Functions emulator fails first; a required client-only peer forces React into a server-only install. A wildcard names no definition, so nothing traces the names it uses to their entries, and a test's mock of one name stands in for the rest.

**Prohibits.**
- A React, browser, or Admin SDK export on a server-safe root; a non-pure root outside the declared exceptions; a client-only peer not declared `optional`.
- Anything but types, schemas, constants, unions, builders, and pure functions on an application-data package's root.
- Functions importing any `/react` subpath; frontend importing a React surface from main.
- `import * as X`, `export * as X from`, or `export * from` another package; ambient `.d.ts` shims for broken package exports.

**References.** ttt-packages `docs/design/react-safety.md`, `docs/packages/package-architecture.md`; RULE-STD-ARCH-203; RULE-STD-BACKEND-002.

### RULE-STD-ARCH-203 — One import path per definition; no compatibility barrels or laundering re-exports
**Scope.** both

**Rule.** Never hide an unsafe import behind a re-export, and never create a compatibility barrel or keep a second path for a moved definition. Canonical imports come from the owner; an unused transitional path or subpath is deleted once no consumer remains. Every definition a package exports is exported by exactly one package entry — the entry of the folder that holds it (`@ttt-productions/<pkg>/<folder>`); a file-level entry exists only for a file no folder entry covers, and a definition in a root-level file with no entry of its own belongs to the package root — so the root and a deep entry never forward what a folder entry exports. Every consumer imports a package definition from the entry that owns it, never from the root, a parent folder's entry, or another entry that also carries it.

**Apps:** in app code, every definition is imported along one path: from the module that owns it, or through the `index` of the folder that holds it. A module that is not a folder `index` never re-exports anything, value or type — no file-split leftover, no forwarded package name, no callable re-exporting its input type; consumers import the owner (the sibling file, or the package entry RULE-STD-ARCH-202 names). A folder `index` forwards only files inside its own folder's subtree. Code outside a folder that has an `index` imports through it, never past it; a test may import a folder's internal file only for a name that `index` does not export. Code inside a folder imports its siblings directly, never through the `index` of a folder that contains it. The one exception is the Functions deploy manifest (`functions/src/index.ts`), named in the guard's app config. An `index` member nothing outside its folder imports is usage, not a boundary.

**Packages:** package code — an application-data package's included — imports the file that defines each name — never a folder `index`, a nested entry, or the package's own name; tests too, except that an entry-surface test may import an entry `index` to prove it forwards a name. Every relative import, in source and tests alike, names its file with its built extension: `./x.js` for `x.ts` or `x.tsx`, `./folder/index.js` for a folder. Only an entry `index` re-exports, and only files in its own subtree, each named directly; an index declares nothing of its own, and no `index.ts` exists that is not a package entry. An entry not declared runtime-specific carries no Node, React, or browser runtime import or type, `node:*` included; the runtime-specific entries are the subpaths `package-architecture.md` § Subpath conventions names plus the exceptions the boundary suite declares. No package has a runtime import cycle. Generic packages hold mechanisms, each application-data package holds its app's business, and a foundation never depends on its adapters.

The repo-guards import-paths and package-entry checks enforce both halves in the build.

**Why.** Two import paths onto one definition are two names for one concept: callers and test mocks split across them, a mock of one path silently misses the other, and a re-export can launder a `/react`, browser, or Admin SDK import behind a path that reads as server-safe. A compatibility barrel is a second name for one concept, and two package entries for one definition split callers and mocks the same way two file paths do. Inside a package, cross-folder imports through indexes manufacture import cycles and make a consumer evaluate a whole folder to use one name.

**Prohibits.**
- A re-export laundering a `/react`, browser, or Admin SDK import behind a server-safe path.
- A compatibility barrel or a second path kept for a moved definition; a dead transitional path or subpath kept after its consumers are gone.
- Two entries of one package exporting the same definition; importing a package definition from an entry that does not own it.
- Apps: a re-export from any module that is not a folder `index`, including forwarding a package's name; a folder `index` forwarding a file outside its folder; importing past a folder's `index` from outside it, or through an enclosing `index` from inside it.
- Packages: importing a folder `index`, a nested entry, or the package's own name from inside the package, except an entry-surface test proving an entry forwards a name; a relative import, mock, or `import()` that does not name its file with its built extension (`./x`, `./folder`, `./x.ts`), in source or a test.
- Packages: a re-export from any file but an entry `index`; an entry `index` forwarding a file outside its subtree or through another index; an `index.ts` that is not an entry; a definition declared in an index.
- Packages: a Node, React, or browser runtime import or type (`node:*` included) in an entry not declared runtime-specific; a runtime import cycle inside a package; a foundation depending on its adapter; a generic package importing an application-data package.

**References.** RULE-STD-ARCH-202; RULE-STD-ENG-002; ttt-packages `docs/packages/package-architecture.md`.

### RULE-STD-ARCH-204 — Adoption wrappers keep the app's call-site shape
**Scope.** apps

**Rule.** An adoption wrapper's **call-site shape** stays identical to the pre-adoption shape (new optional fields are fine; renames and removals are not). All translation lives inside the wrapper. Once `<HOLDS_LIVE_DATA>` is yes, a change to the **on-disk shape** ships with its migration (RULE-STD-ENG-011); any latitude an app takes before then is stated in its own addition.

**Why.** Changing the call-site shape during adoption forces an unrelated sweep of every caller; leaking translation to call sites spreads the package's private shape across the app; an on-disk change without a migration breaks the records already stored.

**Prohibits.**
- Breaking the call-site shape "because the new package is better".
- Translation leaking to call sites.
- An on-disk shape change with no migration once `<HOLDS_LIVE_DATA>` is yes; an undocumented on-disk shape change at any time.

**References.** RULE-STD-ARCH-205; RULE-STD-ENG-011.

### RULE-STD-ARCH-205 — Packages-first; no publish-avoidance shims
**Scope.** apps

**Rule.** Any `@ttt-productions/*` change — `<APP_DATA_PACKAGE>` included — happens in ttt-packages first and is published before the consuming app adopts it. Consuming apps import published, installed packages (`node_modules/@ttt-productions/*`) — never an unpublished sibling source checkout of ttt-packages. A definition, DTO, constant, or copy created app-side specifically to avoid a routine package release is auto-rejected. Package-owned work completes and passes its package gate (`npm run test:quiet` in ttt-packages) before any app adoption.

**Why.** Adopting against unpublished source ships an app that cannot build for anyone else; a "to avoid a publish" shim is a deliberate second copy of a package-owned truth.

**Prohibits.**
- An app-side local DTO, constant, or copy justified by "avoids a package publish" (auto-reject).
- Importing or referencing a sibling ttt-packages source checkout from app code.
- Combining a package-source change and its app adoption in one step.

**References.** RULE-STD-ENG-004, RULE-STD-ENG-005; RULE-STD-ARCH-101, RULE-STD-ARCH-102, RULE-STD-ARCH-208; ttt-packages `docs/packages/package-architecture.md`. The release, install, and adoption hand-off itself is operational and lives in [../../claude/CLAUDE.base.md](../../claude/CLAUDE.base.md).

### RULE-STD-ARCH-206 — Package Firestore access goes through query-core
**Scope.** packages

**Rule.** React packages read and write Firestore through `query-core`'s `useFirestore*` hooks (one shared `<FirestoreProvider>` supplies `db`), never direct `firebase/firestore` operations. `firebase-helpers` and `query-core` are the only direct-Firestore layers. Building constraints and importing Firestore types is fine. A package needing those hooks declares `query-core` as an **optional peer** so the app supplies the single instance.

**Sanctioned exception.** A genuine need a query-core hook cannot express carries an in-file `SANCTIONED EXCEPTION` block and is listed in ttt-packages `docs/packages/package-architecture.md`. The only current one is `upload-ui`'s in-flight-uploads provider, which needs `onSnapshot` transition events behind an injectable `FirestoreSubscribeFn`.

**Why.** Scattered direct Firestore calls fork the data layer and break the shared provider identity.

**Prohibits.**
- Direct `getDoc(s)` / `onSnapshot` / `setDoc` / `updateDoc` / `writeBatch` in a React package outside query-core and firebase-helpers.
- A package taking its own `db`; an undocumented direct-Firestore path.

**References.** ttt-packages `docs/packages/package-architecture.md`, `docs/packages/query-core.md`.

### RULE-STD-ARCH-207 — Application-data packages are not generic packages
**Scope.** packages

**Rule.** An application-data package belongs to one app and holds that app's cross-boundary schemas, constants, paths, and copy. It may depend on generic packages; no generic package depends on it. Its content and design are governed as that app's code — by the apps-scoped rules and its own app's rulebook; the packages-scoped rules govern only how it is built, structured, and released alongside the generic packages (RULE-STD-ARCH-202, RULE-STD-ARCH-203, RULE-STD-ARCH-208).

**Why.** App business truth needs one home that its app controls, and generic packages must stay usable by every app.

**Prohibits.**
- A generic package importing an application-data package.
- Moving an app's business definition into a generic package to avoid an app-data release.

**References.** RULE-STD-ARCH-101, RULE-STD-ARCH-201; ttt-packages `docs/packages/package-architecture.md`.

### RULE-STD-ARCH-208 — Releases go through the batch release command, patch-only until v1
**Scope.** packages

**Rule.** Every release is a batch through `./scripts/release-multiple.sh <folder> [<folder> ...] <bump>`; `release-package.sh` is its internal engine, never invoked directly. Until the packages' v1, every bump is `patch` — additive changes, fixes, and breaking changes alike — because published internal ranges are 0.x carets, which lock the minor. A breaking change still confirms no consumer relies on what it removes or alters before it ships. The package gate (`npm run test:quiet`) is green before any release. A package's very first publish is not a release: it is the one-time first-publish setup in [../../claude/CLAUDE.base.md](../../claude/CLAUDE.base.md), after which every release is the batch command.

**Why.** A `minor` bump escapes every dependent's caret range, so consumers fail to install until every dependent package republishes in lockstep.

**Prohibits.**
- A `minor` or `major` bump before v1; a release outside the batch command.
- A release with a red package gate.

**References.** ttt-packages `docs/packages/package-architecture.md` (release order, caret pinning).

### RULE-STD-ARCH-209 — Everything in ttt-packages is public
**Scope.** both

**Rule.** ttt-packages is a public repository and every `@ttt-productions/*` package is published publicly, so everything written there is public: package code with its comments, tests, and fixtures; package docs; and the shared rules, workflows, and playbooks. None of it names an app's security internals — emulator bypass gating, route-guard or provenance mechanics, secret or key handling, detection thresholds, the shape of a privileged path. That detail lives only in the app's private repo. A shared rule states the general obligation, and the app's specifics go in that app's own addition; a package holds a generic mechanism, never how an app wires it into its own security boundary.

**Why.** A public repository and a public registry are read by attackers as well as consumers. An app's guard arrangement, threshold, or privileged path published there is a map of where its defenses sit and how to step around them, and a published version cannot be taken back.

**Prohibits.**
- An app's emulator bypass gating, route-guard or provenance mechanics, secret or key handling, detection thresholds, or privileged-path shape in package code, comments, tests, fixtures, or docs, or in a shared rule, workflow, or playbook.
- An example in a shared rule, workflow, or playbook drawn from an app's security internals.
- Moving app code or docs into ttt-packages without first keeping that detail back in the app's private repo.

**References.** RULE-STD-ENG-006; RULE-STD-ARCH-005, RULE-STD-ARCH-201, RULE-STD-ARCH-207.
