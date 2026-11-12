# `minimatch` moderate advisory under ESLint 10: the only fix on offer is a downgrade

**What:** `npm audit` in the ttt-packages root reports a moderate `minimatch` advisory reached through ESLint 10, and the only fix npm offers is ESLint 9.
**Severity:** low
**Trigger:** ESLint 10 publishes a release whose `@eslint/config-array` takes a patched `minimatch`.

## What

`npm audit` in the root reports four moderate findings that share one cause: `minimatch` (a denial
of service through a pattern built to make it backtrack), reached through `eslint` →
`@eslint/config-array` → `minimatch`. The four are `minimatch`, `@eslint/config-array`, `eslint` and
`@eslint/js`. The root declares `eslint` `^10.4.1` and `@eslint/js` `^10.0.1`.

npm's only offer for them is `eslint@9.39.5` and `@eslint/js@9.39.5`, a downgrade of the lint
toolchain by a major version. `npm audit fix --force` would take it. Never run it.

The other findings the same audit reports (the `glob` and `fast-xml-parser` advisories, and the
`minimatch` paths under typescript-eslint, Sentry's build plugins and the Google client tooling)
have fixes inside the declared ranges, and a plain `npm audit fix` takes them.

## Why it does not block

The chain is development tooling. The audit the gate and the publish workflow run,
`npm audit --omit=dev --audit-level=high`, reports nothing, at any severity, in what ships. The
exposure is a lint run over a pattern written to exploit the matcher, on a developer machine or in
CI, over this repository's own files.

## Fix shape

When ESLint 10 publishes a release that clears it: if the root's declared ranges reach it,
`npm audit fix` in the root, then `npm run test:quiet`, since a newer lint toolchain can report new
findings. If the declared ranges do not reach it, the root's `eslint` and `@eslint/js` ranges move
to the release that does.

## Done when

`npm audit` in the root reports no `minimatch`, `@eslint/config-array`, `eslint` or `@eslint/js`
finding, and `npm run test:quiet` is green. Then delete this file.
