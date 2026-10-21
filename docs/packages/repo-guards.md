# @ttt-productions/repo-guards

The one guard suite every app runs in its gate. One reader of the repository, every generic guard,
and the three shapes an app builds its business guards on. An app supplies facts — its roots, its
aliases, its owner files, its reviewed exceptions — never logic.

## Owns

- **The reader** — one scope policy for every guard: the roots an app declares by role (`app`,
  `functions`, `e2e`, `hostedE2e`, `scripts`, `coreDist`, and each named Worker tree; a root may be
  the whole repository, `.`), the file
  kinds (code, declarations, stylesheets, rules files, config — env files by any name included —,
  markdown, shell scripts), what counts as test code
  (a `.test.` / `.spec.` name, a `__tests__` folder, an end-to-end root, or a declared test-code path
  or name marker), and what is never read (dependency, build, and dot folders by name; anything
  else only by a reviewed repo-relative path; a symbolic link named like a skipped folder is skipped
  with it, and any other symbolic link is neither followed nor skipped — the walk fails naming it). Every file is read, comment-stripped (code, stylesheets, rules files), and
  parsed once per run and shared by every guard. The reader also reads an installed package's
  shipped files under any folder's `node_modules` (each labelled an installed file of that package),
  and a file outside the checkout by absolute path (a sibling repository).
- **The rules files** — the layout's `rulesFiles` is the one list of every rules file the app
  deploys. Each is a Firestore or a Storage rules file by the service it declares (a file that
  declares neither, or both, fails the layout), and every rules guard reads every listed file of its
  kind; no guard names a rules file of its own. When the layout names the deploy config
  (`firebaseConfig`, the app's `firebase.json`), every rules file it deploys must be listed, or the
  layout fails.
- **The suite** — one entry that checks an app's whole config and then registers every generic
  guard and every business guard as tests.
- **The generic guards** — each a single behavior: where two apps' copies differed, the guard
  carries the stronger logic of both. The guards themselves are the list; this doc never restates
  it.
- **The three shapes** — owner-only, reviewed allowlist, and declared literal.
- **Hand-run reports** — what they list is a judgment call, never a gate failure: the duplicate
  exports report, the unused index-member report, the shared-fake report (modules faked and helpers
  declared in several test files of one tree with no shared owner yet), the slow-test report (test
  cases at or over a threshold, read from the test runner's JSON results, in files that name no
  timeout budget), and the Firestore write guard's coverage table.
- **The registry seed writer and Zod introspection**, which an app's test tooling and audit
  scripts use beside the guards.
- **The repository tooling** an app's thin scripts run: the quiet verification gate, the
  release-scope resolver and the release gate and verdict, the App Hosting build environment, the
  post-deploy cloud checks (Storage CORS, callable invokers, deployed functions), stopping the local
  stack, the playbook file-reference check, the field-lineage report, cleanup, the fresh-login
  chain, and the emulator seed runner. Each tool has one behavior for every app, with no switch
  that changes it: an app passes only its facts (projects, ports, paths, stages, components).

## Contract shape

- `.` — pure: `ownerOnly`, `reviewedAllowlist`, `declaredLiteral`, `matchPattern`, `sampleHits`, the
  `Guard` / `Finding` / `Sample` / `GuardContext` types, `formatFindings`, and `viewOfText`. A
  `FileView` carries the file's `imports`: every place its code names a module (imports,
  re-exports, `import()`, `require()`, test-runner mocks, type-position imports) with the names each
  binds, read once from its parse. Only code and declarations have imports; reading them on any
  other kind of file throws. `MODULE_LOADS` names the import kinds that load a module at run time,
  with the `ImportKind`, `ImportedName`, and `ModuleImport` types.
- `./node` — the reader: `createRepoReader(layout)`, `layoutProblems(layout)`, the layout types, and
  the scope policy (`isTestPath`, `kindOfFile`).
- `./node/suite` — `registerGuardSuite(config)`, called once at the top of an app's one guard test file;
  needs `vitest` (an optional peer) and runs under Node. A repository that is no app (this
  monorepo's boundary suite) runs the generic guards that apply to it through
  `registerSuiteOf(config, definitions)`, picking them from `GENERIC_GUARDS` by id.
- `./node/reports` — the hand-run reports; run under Node.
- `./node/tooling` — the repository tooling; runs under Node.
- `./seed` — `createRegistrySeedWriter`, `registeredSchemaForPath`.
- `./zod-shape` — `kindOf`, `unwrap`, `objectShape`, `arrayElement`, `compositeMembers`, `knownKeys`.

## Guarantees

- **No guard is skipped silently.** Every generic guard needs its facts in the config, or — only
  where the guard allows it — an `{ absent: why }`. A guard over the Functions tree or the Worker
  trees may be declared absent only when the layout declares no such root. A missing, unknown, or
  malformed entry fails the config before any guard runs.
- **Fails closed.** A folder the reader cannot read throws naming it; a root a guard needs that the
  layout does not declare throws; an exclusion, owner, or allowlist entry that no longer matches is
  stale and fails; a guard fails as vacuous when any scope it reads reaches no file, even beside a
  named file it also read; every declared root's anchor file must be reached by its walk.
- **A guard that cannot run here says why.** Only a guard whose input lies outside the checkout (a
  sibling repository CI never checks out) can skip, only when that checkout is absent, and the suite
  shows it SKIPPED with its reason — never passed. A sibling checkout that is there but lacks its
  copy fails.
- **Comments never reach a guard.** `code` is the file with every comment blanked and every index
  and line kept, read from the parse so a `//` in a string, template, regular expression, or JSX text
  stays.
- **A business guard proves its matcher.** Each shape requires must-fail and must-pass samples, and
  the suite runs them beside the guard.
- **Failures are in words.** A failure states what the check requires and how it is fixed; it never
  cites a rule ID.

## Boundary

The package names no app, folder, file, collection, or product. Each app owns its one guard-config
folder and its one suite test file; its business guards stay in the app, built on the shapes.
