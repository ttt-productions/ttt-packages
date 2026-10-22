# `braces` high advisory in dev-standards' lint devDependency — no patched release exists yet

**What:** `npm audit` reports 5 high advisories, all GHSA-vfj7-8cjw-p6xm in `braces`, reached only
through `dev-standards`' `eslint-config-next` devDependency.
**Severity:** low
**Came from:** the shared-standards run, installing `dev-standards`' devDependencies
**Trigger:** a `braces` release outside the advisory's affected range is published

## Evidence

`eslint-config-next` → `@next/eslint-plugin-next` → `fast-glob` → `micromatch` → `braces`
(GHSA-vfj7-8cjw-p6xm, stack-exhaustion denial of service through deeply nested patterns). The
advisory's affected range is `*`: every published `braces` (latest 3.0.3) is affected, so no install
or override can reach a fix. npm's only offer, `npm audit fix --force`, downgrades
`eslint-config-next` to 14 — a breaking change to the lint base. Never run it.

`dev-standards` holds `eslint-config-next` only as a devDependency (to build and test its app ESLint
base) and as an optional peer, so the publish workflow's audit (`npm audit --omit=dev
--audit-level=high`) reports 0 and no release is blocked. The consuming apps reach the same chain
through their own `eslint-config-next`.

## Fix shape

When a patched `braces` is published: `npm audit fix` in the ttt-packages root if `micromatch` /
`fast-glob`'s declared ranges reach it; otherwise a parent-scoped root `overrides` entry, guarded by
repo-guards' `dependencyOverrides` guard (`test/boundary/dependency-overrides.test.ts`).

## Done when

`npm audit` in the ttt-packages root reports no `braces` advisory. Then delete this file.
