# TTT Packages

The shared `@ttt-productions/*` packages used by the TTT Productions and Q-Sports apps. This is
an npm-workspaces monorepo: each package lives in its own folder under `packages/` and is
published to npm on its own.

## Documentation

- [`docs/packages/package-architecture.md`](docs/packages/package-architecture.md) — how the
  packages fit together: tiers, dependency direction, entry-point conventions, build and release
  order, internal version pinning, and the boundary-guard tests.
- [`docs/packages/`](docs/packages/) — one doc per package: what it owns, what it must not own,
  and its public entry points.
- [`docs/design/`](docs/design/) — invariants that span several packages.
- [`CLAUDE.md`](CLAUDE.md) — the working rules for this repo, including the verification gate,
  the release workflow, and version-bump policy.

Each package's `package.json` is the source of truth for its exports and dependencies.

## Development

Use the Node version in `.nvmrc`.

```bash
npm install
npm run test:quiet
```

`npm run test:quiet` is the gate every change must pass before a release. It prints one line per
stage; `CLAUDE.md` describes the stages, and `node scripts/test-quiet.mjs --help` lists the ones
you can run alone with `--only`.

## Releasing

Every release goes through one command, run from the repo root with short package folder names:

```bash
./scripts/release-multiple.sh <folder> [<folder> ...] patch
```

It runs `scripts/preflight.sh` once, which ends with `npm run test:quiet`, then releases the named
packages in dependency order. For each one it bumps the version, commits, tags, and pushes. The
pushed tag triggers `.github/workflows/publish.yml`, which rewrites internal `"*"` ranges to caret
ranges and publishes the package to npm. `./scripts/release-all.sh` releases every package through
the same script. Before launch, every release is a `patch` bump (see `CLAUDE.md`).

## License

MIT © TTT Productions
