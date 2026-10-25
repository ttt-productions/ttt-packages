# Release preflight's vitest stage crashes natively, then passes on a rerun

**What:** The release preflight's `vitest` stage intermittently dies with a native access violation and no output, so a release fails until it is rerun.
**Severity:** high
**Came from:** the ttt-prod shared-standards Phase 3 repair session (sixth package release)

## Symptom

`./scripts/release-multiple.sh …` → `scripts/preflight.sh` → `npm run test:quiet -- --format-check-only`.
Every stage before `vitest` passes; `vitest` fails about 8 s in with:

```
Could not parse vitest JSON output (exit code 3221225477, 0 bytes on stdout).
```

The only stderr is the repeated Vite `__dirname` / `configLoader: 'native'` warning, which is not
the cause. Rerunning the release passes. It recurs across releases, and a session's own green
`npm run test:quiet` has not predicted it.

## What is known

- `3221225477` is `0xC0000005`: the vitest node process crashed in native code. No test failed; the
  JSON reporter never wrote, hence 0 bytes. This machine's Windows Error Reporting holds no record
  for `node.exe`, so there is no crash dump naming the faulting module.
- `stageVitest` in `scripts/test-quiet.mjs` runs the root `test` script, `vitest run --pool=threads`
  (its comment: only that script chooses the threads pool). Under threads every test file runs in a
  worker thread of one process, so a native fault in any worker kills the whole run.
- Native addons in `node_modules`: `@img/sharp-win32-x64` (sharp/libvips), rolldown, rollup,
  lightningcss, `@unrs/resolver-binding`, `@next/swc`. Test code reaching sharp:
  `packages/media-processing-core` (`src/image/resize.ts`, `src/image/image-processor.ts`,
  `src/image/formats.ts`, `src/inspection/inspect-media.ts`) and
  `packages/repo-guards/__tests__/backend/functions-build.test.ts`.
- The preflight's state differs from a plain `test:quiet` run: before the gate it deletes nested
  `packages/*/node_modules/@ttt-productions`, every `dist`, and every `*.tsbuildinfo`, runs
  `npm install` and `npm ci --dry-run`, then runs the gate check-only. A plain run starts from a warm
  tree.

## Leading hypothesis — not verified

sharp (libvips) loaded and unloaded across several vitest worker threads faults at load or at thread
exit; sharp is not safe to load per worker thread unless the main thread loads it first. It fits "early
in the run, intermittent, whole process gone". The preflight's cold tree may raise the odds.

## To do

1. Reproduce from the preflight's state, not a warm tree: the preflight's cleanup and install steps,
   the build, then `npm run --silent test -- --reporter=json`, repeated until the crash rate is known.
2. Isolate: the same loop on `--project media-processing-core` and on repo-guards alone, versus the
   rest.
3. Find why the threads pool was chosen before changing it, then compare the candidate fixes under
   the same loop: sharp loaded in the main thread before any worker (a vitest `globalSetup`), and
   `--pool=forks`, with their run-time cost.
4. While there: `stageVitest` reports a native crash only as "could not parse JSON". It should say
   that the process crashed, with the exit code read as a crash.

## Done when

The cause is proven: the crash reproduces from the preflight's state without the fix and never with
it, over enough consecutive runs to trust. A release preflight passes on its first run.
