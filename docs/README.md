# ttt-packages docs

Documentation for the `@ttt-productions/*` shared monorepo.

## Folders

### The shared standards (`packages/dev-standards/`)
How an AI works with DJ (`development-preferences.md`), the one shared rulebook (`rules/`), the shared playbooks (`playbooks/`), the development workflows, and the `docs/work/` rules live in the `@ttt-productions/dev-standards` package, which every repo reads; ttt-packages reads them from its own source. `CLAUDE.md` names the required reading.

### `packages/`
Per-package reference documentation. One file per package describes what that package owns, what it must not own, and which entry points are public. Read these when using or changing a package.

### `design/`
Cross-cutting design rules and architectural invariants that span multiple packages or govern how packages must be built. Server-safe entries, React boundaries, identity invariants, upload path shape, and similar rules live here.

### `work/`
All work to do for ttt-packages, laid out by `packages/dev-standards/work/README.md`, plus `adoptions/<app>/` — the adoption file each release hands each app.

### `generated/`
Auto-generated reference, rebuilt from source (e.g. the Firestore schema generated from `COLLECTION_SCHEMAS`). Never hand-edit — regenerate with `npm run schema:docs` (`npm run schema:check` fails if stale; the `test:quiet` schema stage checks and auto-regenerates) and commit the result.

## Where to start

- New to a package → read `packages/<name>.md`.
- Designing a change that touches package boundaries or affects how packages are consumed → read the relevant files in `design/`.
- Verifying a package still follows the rules → run the relevant shared playbook in `packages/dev-standards/playbooks/`.
