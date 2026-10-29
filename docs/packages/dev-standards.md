# @ttt-productions/dev-standards

Everything every product shares about how its software is built and how an AI works on it: the
engineering rules, the AI docs, the development workflows, the shared playbooks, the `docs/work/`
rules, and the lint, TypeScript, and test config bases.

## Owns

- **The shared rulebook** (`rules/`) — every `RULE-STD-*` rule, product-neutral, each stating its
  scope (apps, packages, or both). An app's own rulebook holds only its `RULE-<PRODUCT>-*-9xx` rules
  and its additions and overrides on shared rules.
- **The AI docs** — `development-preferences.md` (how an AI works with DJ), `model-tiers.md` (the one
  tier table), `AGENTS.base.md`, and `claude/CLAUDE.base.md` (mandatory reading, the Normal Test and
  Dev Flows, the adoption workflow, and the first-publish procedure).
- **The development workflows** (`workflows/`), written in skill format.
- **The shared playbooks** (`playbooks/`) — each step cites the rule IDs it audits;
  `playbooks/crosswalk.md` maps every shared rule to the step or guard that audits it.
- **The `docs/work/` rules** (`work/`) and the runbooks README and postmortem template
  (`runbooks/`).
- **The config bases** (`config/`, `src/node/`) and the config copies each repo keeps
  (`config/copies/`).
- **The typed module-mock helpers** (`src/testing.ts`) every repo's tests return their module
  mocks through.

## Boundary

- Depends on no `@ttt-productions/*` package; a Tier 0 foundation.
- Product-neutral: an app's values reach the shared text only through the placeholders its
  `CLAUDE.md` values block declares (`<APP_NAME>`, `<APP_DATA_PACKAGE>`, …). Nothing is rewritten at
  install time.
- Public, like every package: nothing here names an app's security internals
  (RULE-STD-ARCH-209). That detail lives in the app's private rulebook and playbook additions.
- An app adds to a shared doc in its own same-named file under a "`<App> additions`" heading, and
  overrides shared text only explicitly ("Overrides shared `<doc>` § X: …").

## How an app consumes it

- The app's `CLAUDE.md` holds its values block, its own facts, and one `@import` of
  the installed package's `claude/CLAUDE.base.md` (in `node_modules`); its `AGENTS.md` points Codex
  at the same files. ttt-packages imports the base from its own source,
  `packages/dev-standards/claude/CLAUDE.base.md`.
- The docs ship as plain files; the app reads them from `node_modules`.
- The config bases are extended or imported by the app's own config files, which keep their scoped
  exceptions. Each repo keeps its own copy of the files in `config/copies/`, and a copy-drift test in
  the repo fails when its copy differs from the package's.

## Entry points

The package has no root entry: `exports` names only the subpaths below, so a consumer imports a
config base by its subpath and reads the docs as files.

- `@ttt-productions/dev-standards/node/eslint` — the ESLint bases (Node). The app and Functions
  bases fail an explicit `any` and every unsafe use of an `any` value (the type-aware `no-unsafe-*`
  rules) in every TypeScript file, source and tests alike, so each linted `.ts` / `.tsx` file must be
  included by the nearest `tsconfig.json`.
- `@ttt-productions/dev-standards/node/vitest` — the Vitest bases (Node). Every base fails a `.only`
  (`allowOnly: false`). No base runs the tests of a file concurrently, and `test/boundary/dev-standards-vitest-bases.test.ts` fails if one sets
  `concurrent`. `createAppVitestConfig`'s `browserEntryTests` names the app tests of a client
  entry (the browser monitoring init): they run in an `app-browser` jsdom project that resolves
  each package's `browser` build and puts every dependency through Vite, so the test loads the
  build the client ships rather than a package's server build.
- `@ttt-productions/dev-standards/node/playwright` — the Playwright base (Node). It fails a `.only`
  on CI and off it (`forbidOnly: true`), and every project's browser asks for reduced motion
  (`use.reducedMotion: 'reduce'`), so an app's one motion kill switch stops motion in every suite.
- `@ttt-productions/dev-standards/node/postcss` — the PostCSS base (Node).
- `@ttt-productions/dev-standards/node/a11y` — the axe accessibility check for Playwright e2e:
  one page in the default theme, the high-contrast theme, and reduced motion (Node).
- `@ttt-productions/dev-standards/testing` — the typed module-mock helpers every repo's tests share
  (universal; no runtime import). `passThroughModule(importOriginal, overrides)` keeps the real module
  and replaces the named exports; `stubModule(importOriginal, stubs)` answers only the stubs and never
  loads the real module. Both take the module's type from the mock factory's own `importOriginal`, so
  in a `vi.mock(import('…'), …)` a wrong module, a misspelled export, or a wrong signature fails to
  compile (RULE-STD-QUALITY-006; repo-guards' `typedMocks`).
- `@ttt-productions/dev-standards/config/tsconfig.app.json` — the app TypeScript base, for `extends`.
- `@ttt-productions/dev-standards/config/tsconfig.functions.json` — the Functions TypeScript base,
  for `extends`.
- `@ttt-productions/dev-standards/config/prettier.json` — the shared Prettier config.
