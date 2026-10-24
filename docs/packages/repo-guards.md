# @ttt-productions/repo-guards

The one guard suite every app runs in its gate. One reader of the repository, every generic guard,
and the three shapes an app builds its business guards on. An app supplies facts — its roots, its
aliases, its owner files, its reviewed exceptions — never logic.

## Owns

- **The reader** — one scope policy for every guard: the roots an app declares by role (`app`,
  `functions`, `sharedSource`, `e2e`, `hostedE2e`, `scripts`, `coreDist`, and each named Worker tree;
  a root may be the whole repository, `.`) — `sharedSource` is an optional private source folder both
  the app and its Functions build from, and every scope that reads the app or the Functions root
  reads it too, so each guard over either tree also guards it; the file
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
  chain, and the emulator seed runner. The playbook check reads every playbook folder a repository
  declares — an installed package's and its own — and resolves each folder's references against
  that folder's declared root, so an installed playbook's package-relative path is checked inside
  the installed package. A bare `*.md` token or a Markdown link target with no `/` names a sibling
  playbook file and resolves against the playbook folder itself, counting toward its floor; a
  folder with no path prefixes counts no prefixed path. A path holding a `<UPPER_SNAKE>` placeholder
  or a glob is skipped, as is a line marked `<!-- no-check -->`; a rule ID is never a file reference;
  and each folder declares its own floor (at least 1): a folder that checks fewer references than
  its floor fails, as does a missing reference or a folder that cannot be read. Each tool has one behavior for every app, with no switch
  that changes it: an app passes only its facts (projects, ports, paths, stages, components).

## Contract shape

- `.` — pure: `ownerOnly`, `reviewedAllowlist`, `declaredLiteral`, `matchPattern`, `sampleHits`, the
  `Guard` / `Finding` / `Sample` / `GuardContext` types, `formatFindings`, `viewOfText`, and
  `rawMutations(file)` — the one detector of a raw TanStack `useMutation` (by name, through a
  namespace, re-exported, or loaded at run time), which the mutation-owner guard and any
  repository's own check share. A
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

## Facts

An app's config gives every generic guard its facts under `generic.<guard id>`. The facts types in
the guard source are the one statement of what each guard takes (`GenericGuardFacts` joins them);
this section says what the facts mean, area by area, and never lists them guard by guard.

**What a fact is.** Every area uses the same few kinds:

- **A path** — repo-relative and forward-slashed, with no trailing slash — naming a file or folder
  the app's layout reaches. A whole root is named by its role (`RootRole`), never by a path.
- **A name** — an identifier as the app's code spells it: the exported function, component,
  constant, hook, or prop the guard treats as the one owner of a behavior, or a call it looks for.
  An app's import aliases map each alias prefix to the repo path it stands for.
- **A reviewed exception** — an entry naming the site it excuses (a `path`, a `file`, or a name)
  and its `why`; an allowlist entry may also carry the reviewed `count` of matches. An entry with no
  `why` or a duplicate fails the config, and one that no longer matches anything fails as stale.
- **A loader** — a function that returns, or resolves to, a value read from the app's own code or
  installed build (its application-data package's registry, path builders, schemas, declarations,
  or policy), so the guard checks the code against what the app ships rather than a copy kept in
  the config.
- `{}` for a guard that takes no facts, and `{ absent: why }` only where the guard allows it (see
  Guarantees).

**By area** (each area is a folder of `src/modules/`):

- **Import paths** — the app's import aliases, the packages folder and package scope, the
  runtime-specific package subpaths, the application-data packages, and the reviewed files and
  entries that are exceptions.
- **Repository** — the repository-wide facts: the CI workflow and the gate it must mirror, the
  roots kept isolated from each other and the tsconfig files whose aliases must stay inside their
  root, the package scope and which roots are server or client, the shared fakes and their owners,
  the files that may set a test timeout, each Worker tree's config files and production
  environment, the dependency overrides, the env files and the values in them that are public, the
  project ids, the product names no installed generic package may carry, and the reviewed files
  that discard a promise rejection with no reason.
- **Firestore and Storage** — the app's data package and import aliases, the constants and
  builders that own path assembly, retired segments with their replacements, the indexes file,
  the server-side metadata readers, and loaders for the registry, collection names, and the values
  the rules files must agree with.
- **Backend** — the owner of each server concern (the audit writer and its entry points, the
  monitoring package with its capture calls and failure exits, the lazy loader, the Functions entry
  index and deploy manifest, and the module that owns each server boundary the app declares), the
  folders and modules that make up the app's server zone, and the reviewed exceptions to each. The
  admin action surface adds the auth call and the option that marks a callable admin-only, the
  app's admin-checker names with their reviewed readers, the admin declarations module and the
  client's full declarations, the admin claim keys and hooks, the admin-area roots (a module under one
  counts as an admin hook when imported from outside), the admin-actions affordance, and the reviewed
  admin-standing reads outside them, each a path with an optional symbol.
- **Frontend reads** — the read-state module and its failure seat, the hooks tree, the query-key
  module (with a loader for its builders), the domain-event registry, the session-retirement
  owner, and the read fields a render surface branches on (data, failure, failure carriers, and
  loading) with the reviewed failure branches and loading-only surfaces.
- **Frontend actions** — the callable declaration modules and the factory for each callable kind,
  the callable transports, the client auth accessor and boundary modules, and each client owner
  (the app-config provider, the browser-storage helper, the media renderers, the upload listener)
  with its allowlist, and the mutation owner every mutation is built with (its module and hook
  name).
- **UI** — the entry stylesheet, token sheet, and pinned stylesheet order, the root layout module
  and what it mounts in which order, the navigation, motion, and loading helpers, the accessible
  control and display components, the trees the shared truncation class governs with that class and
  the clamp-owner selectors, and the reviewed colour, label, text-entry, bound, and truncation
  exceptions.
- **Core definitions** — the app's data package, its schema and wire folders, the wire-input name
  suffixes, loaders for its wire modules, field declarations, and field schema builder, and the
  reviewed exceptions (guarded literals, length literals, non-segment ids, verbatim fields). The
  route owner adds the module and name that build every app page path, the page roots it builds
  (each a whole leading segment), the trees where no other code may write one, and the reviewed
  exceptions, among them the framework route files the app names.

A guard over a security boundary takes only names and paths — which module owns the boundary and
which sites are reviewed exceptions. What the boundary does is the app's, and stays in its private
code and docs (RULE-STD-ARCH-209).

## Boundary

The package names no app, folder, file, collection, or product. Each app owns its one guard-config
folder and its one suite test file; its business guards stay in the app, built on the shapes.
