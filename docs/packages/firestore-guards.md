# @ttt-productions/firestore-guards

The static Firestore guards an app runs in its own test gate: the write guard (every field a writer
stores on a registered document is declared by that document's schema in the app's core package)
and the test-code path checker (test code builds Firestore paths through the core's builders, never
by hand). One implementation for every app; each app supplies its core and its trees.

## Owns

- The write-guard analyzer: target resolution through the core's `PATH_BUILDERS` /
  `COLLECTION_REFS` / constant maps to a `COLLECTION_SCHEMAS` template, payload key reading, the
  independent structural cross-check, the reviewed-exception binding, and the report.
- The test-code path checker.
- Registry-checked seed writes for an app's test fixtures.
- Zod schema introspection (`kindOf`, `unwrap`, `objectShape`, `arrayElement`, `compositeMembers`,
  `knownKeys`) — the one owner for the guard and an app's audit tools.

## Contract shape

Three entry points.

- `.` — pure; reads no file and imports nothing but `typescript` (a peer).
  - `createGuardProfile({ corePackage, coreLibraryRoot?, importAliases?, transactionTypeNames?,
    handleModulePrefixes?, removalOnlyTables? })` — everything the analyzer knows about the app: its
    core package specifier (only an import of it is canonical), the root of the core's code read as
    library code (an installed `dist`, or a workspace source folder), import aliases
    (`{ '@/': 'src/' }`), app types a write-handle parameter may be annotated with, the app's own
    packages that can hand back a Firestore handle, and tables of documents no schema owns that a
    write may only remove from.
  - `loadRegistry({ sources, constantMapNames })` — builds the registry from the core's entry points,
    passed as loaders (`core`, `docSchemas`, optional `subpaths`); a missing entry point or constant
    map fails the load.
  - `runGuardOnSources({ sources, librarySources?, registry, profile, exceptions?, packageDeclarations? })`,
    `analyzeFiles`, `evaluate`, `enumerateWriteCallSites`, `parseFile`, `formatReport`,
    `VIOLATION_KINDS`, and the key helpers (`declaredKeys`, `closedCanonicalKeys`,
    `narrowedDeclaredKeys`, `numericSentinelSegments`, the package-builder helpers).
  - `findHandTypedFirestorePaths(files, { collectionNames })` — `path:line` for every test-code
    literal that begins with a declared collection name and a slash, or that is a declared collection
    name passed to `doc` / `collection` / `collectionGroup`.
- `./node` — the file-system half.
  - `runGuard({ repoRoot, trees, optionalTrees?, registry, profile, libraryTrees?, exceptions?, excludePaths? })` —
    sweeps the writer trees (`trees` must exist; `optionalTrees` are swept when present); reads the
    profile's core library root as library code unless `libraryTrees` says otherwise; reports stale
    exceptions and stale exclusions.
  - `collectSourceFiles(repoRoot, root, { excludePaths?, optional? })`,
    `collectTestCode(repoRoot, roots, { testTrees? })` (a root may carry `optional: true`),
    `nodePackageDeclarations(repoRoot)` (the installed-package `.d.ts` reader `analyzeFiles` takes).
- `./seed` — registry-checked seed writes, pure (the app injects its write).
  - `createRegistrySeedWriter({ schemas, write, registryName })` returns `setSeededDoc(docPath, doc)`,
    which parses a whole fixture against its path's registered schema and writes the PARSED result,
    and `mergeSeededDoc(docPath, patch)`, which writes a patch only when every field it writes is one
    the schema's object shape declares. An unregistered path, a fixture that does not parse, an
    undeclared patch field, or a schema with no readable object shape is refused and nothing is
    written. `schemas` is the app's template → schema registry; `registryName` names it in the
    failure messages.
  - `registeredSchemaForPath(schemas, docPath)` — a concrete path's template: literal segments match
    exactly, `{placeholder}` segments match any id, and the template with the most literal segments
    wins.

## Guarantees

- Fails closed: an unresolved target, an unreadable payload, an unclassified write-method call, or an
  analysis ceiling is a violation; only a reviewed exception bound to the structural write site
  passes it, and an exception that no longer matches is reported stale.
- A local or foreign object named like a core export is never read as canonical: `PATH_BUILDERS`
  and `COLLECTION_REFS` count only through the core's own import, under any local name.
- A write's target and payload are paired only where the analysis proves one decision chose both:
  a same-carrier pair, or one core const map entry both sides read (`const slot = MAP[kind]`, the
  path from `slot.subcollection`, the payload from `slot.schema.parse(…)` or its
  `safeParse(…).data`), split into one branch per entry. The same selector read in two places, two
  independent selectors over one set of documents, or crossed branches prove nothing: every
  candidate document is diffed against every key the payload can carry.
- A tree the guard is told to read is read whole or the run fails: a missing required root, or any
  unreadable directory under a root, throws naming that directory, so no writer subtree is skipped
  with the run still passing. An optional root may be absent, never unreadable; a package that is not
  installed declares nothing, and an installed one whose files cannot be read throws. A readable
  empty tree is valid.

## Source

Authored as JavaScript with JSDoc on the public API; `tsc` (`allowJs`) emits `dist` and the
declarations. The self-tests run against two generated fixture cores under `__tests__/` — static
reproductions of a core's registry structure — so the package tests no app's core.

## Boundary

Each app owns its profile, its registry sources, its writer trees and exclusions, its exception
list, and the live-tree tests that run the guards over its repository. This package names no app,
collection, or path.
