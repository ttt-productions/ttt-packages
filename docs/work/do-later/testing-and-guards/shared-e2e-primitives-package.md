# One package for the E2E code both apps share

**What:** Move the generic hosted and local E2E code that ttt-prod and Q-Sports both carry into one generic package, so a fix made once reaches both apps.
**Severity:** medium
**Came from:** the Q-Sports 2.0 migration orchestrator (Q-Sports scope), on DJ's call of 2026-10-30 to copy ttt-prod's hosted E2E into Q-Sports for the November 7 launch instead of building this package first. It folds in ttt-prod's earlier write-up of the hosted half (2026-10-21, from the Q-Sports `bring-up` step).
**Trigger:** after Q-Sports 2.0 is live on production, or sooner if a hosted E2E engine fix has to be made twice

This is a write-up of the item as it is known now, not a finished design.

## The goal, in DJ's words

When a path passes on chrome and fails on firefox, and the fix is a shared helper (a swallowed
click, a lost load event, a covered-window hang), that fix has to reach Q-Sports and every app
created later. It must not be copied by hand and drift.

It follows the same pattern as `repo-guards`:
- one behavior per primitive;
- the app supplies only its facts (profile root, target URL, selectors, flows), never logic;
- copies that differ are drift, and the package carries the stronger logic of both.

## The gap

For the launch, Q-Sports copies ttt-prod's hosted E2E harness (renamed and adapted) instead of
installing a shared package. Its local E2E harness already holds code of the same kind as ttt-prod's.
Two copies of one mechanism drift: an engine fix or a flake fix made in one app never reaches the
other. The workspace rule is that a mechanism both apps need lives in ttt-packages.

When the item is picked up, diff Q-Sports' copy against ttt-prod's first. Each app will have fixed
things the other has not; the package takes the stronger version of each primitive.

## What moves (to be confirmed against both apps when the item is picked up)

### Hosted E2E engine primitives

Measured in ttt-prod on 2026-10-21: six helper files, about 4,200 lines, mix the engine knowledge
with TTT-only flows. Re-measure when picked up; the files have grown since.

| ttt-prod file | Lines then | Generic part (moves) | App-only part (stays) |
|---|---|---|---|
| `e2e-hosted-dev/helpers/journey.ts` | 1,967 | the engine union and `HOSTED_BROWSER` parsing, `journeyHeadless`, per-engine persistent profile dirs, the installed-Firefox launch (`installed-firefox.mjs`) and its prefs (occlusion tracking off, remembered camera grant), the mobile device profile, `launchJourneyContext` / `createJourneyContext`, the App Check profile hygiene, and the click-and-verify set: `clickUntilVisible`, `clickUntilUrl`, `clickToggleUntil`, `clickWhenSettled`, `setCheckbox`, `gotoDomReady`, `ensureAccordionOpen`, `dialogFooterButton`, plus the file-chooser primitives (`clickUntilFileChooser`, `untilFileChooser` and `file-chooser-probe.ts`) | `registerViaUi`, `loginViaUi`, the account menu, cookie banner, site tour, artisan dialog, and the craft / Square / pledge / admin-queue / report helpers (about 1,500 lines) |
| `e2e-hosted-dev/helpers/watchdog.ts` | 1,537 | the engine-scoped parsers and noise classes: firefox image-decode, per-engine CORS wording, the `_rsc=` prefetch wording, the firefox `requestfailed` echo after a ≥400 | media-session, chat WS, app-edge, Sentry telemetry, and TTT endpoint classification (about 50 TTT references) |
| `e2e-hosted-dev/helpers/render.ts` | 525 | `expectImagesPainted`, `settleLoaded`, `expectVideoReady` | the media-viewer `.mv-recovery-*` phase contract: decide whether it rides along (see Open calls) |
| `e2e-hosted-dev/helpers/toast-observer.ts` | 84 | the whole file: the init-script MutationObserver on the ui-core `data-variant` contract | the binding name `__tttHostedE2eToastReport` needs a neutral rename |
| `e2e-hosted-dev/helpers/nav-defaults.ts` | 23 | the whole file: `applyDomReadyNavigationDefaults` | — |
| `e2e-hosted-dev/helpers/chromium-launch-args.ts` | 72 | the whole file | — |

Two engine mechanisms decided in ttt-prod on 2026-10-30 belong to the generic half and move with it
once they are built:
- the firefox fallback in the file-chooser primitive: hand the file to the same input when BiDi raises
  no chooser event for a second pick (ttt-prod `firefox-second-file-pick-on-one-input.md`);
- the harness-set App Check debug token on the non-chrome engines (ttt-prod
  `hosted-e2e-app-check-debug-token-on-three-engines.md`). The package takes the token and the engine
  list from the app; it never reads an app's env file.

**Tests that move.** ttt-prod's `src/__tests__/hosted-harness/` cases that prove this code:
- certainly `chromium-launch-args.test.ts`, `firefox-image-decode-echo.test.ts`,
  `cors-blocked-echo.test.ts`;
- likely `nav-defaults.test.ts`, `headless-toggle.test.ts`, `file-chooser-primitive.test.ts`, and the
  App Check part of `profile-hygiene.test.ts`.

The rest of that folder proves app code and stays: casting supply, front door, intakes, safety cases,
run archive, timings.

**Lessons that move.** The engine lessons in ttt-prod's `e2e-hosted-dev/CONVENTIONS.md` move with
their fixes. A lesson lives where its fix lives:
- swallowed clicks and the verify-outcome-and-retry set;
- controlled Radix checkboxes, and toggle controls needing `clickToggleUntil`;
- the covered-window hang, the profile launch-hang (startup-crash counter), the lost load event;
- the mobile engine;
- firefox running the installed browser because App Check refuses Playwright's own build;
- the WebDriver BiDi gaps (no second file chooser on one input, `emulateMedia` ignored, no page
  WebSocket events, no request bodies).

Each app's file keeps its app lessons (ttt-prod: front door, intakes, adult-media sweep,
media-session, chat).

### Local E2E code of the same kind

Wherever both apps hold it:
- the emulator client (callables with the App Check header, the project-scoped custom-claims endpoint);
- the App Check debug-token setup and its restore into each browser context;
- the auth-state setup;
- generic page helpers.

The Q-Sports files are `e2e/helpers/emulator-client.ts`, `page-helpers.ts`, `e2e/app-check.setup.ts`,
and `e2e/auth.setup.ts`, plus their ttt-prod counterparts.

### What stays in each app

Every flow that names an app's control, route, role, or copy. Also: casting and catalogues, seeds and
factories, the front door, safety and adult-media code, the runner (ttt-prod
`scripts/run-hosted.mjs`), timings, evidence, ledgers, archives, `targets.json`, and `env.ts`.

## Shape

- One generic package under the shared rulebook: no app identifiers, URLs, selectors, roles, or copy
  (RULE-STD-ARCH-201); `@playwright/test` a peer; a Node entry, no React. Possibly two entries
  (hosted, local) in one package.
- Engine launch takes everything app-specific as arguments: profile root, target URL, headless flag,
  video dir, debug token. Nothing inside the package reads an app's env file or `targets.json`.
- The watchdog's engine parsers and noise classes are exported so each app's watchdog composes them
  rather than re-declaring them.
- The package carries its own vitest suite (the moved tests) and its own `CONVENTIONS.md` (the moved
  lessons).
- `repo-guards` already declares a `hostedE2e` root in its reader. A static guard such as "no
  primitive is re-declared in an app's `e2e-hosted-dev/helpers/`" goes in `repo-guards` as a generic
  guard, not in this package.

## Order of work

1. **Baseline:** a record run of every hosted path on chrome, firefox, msedge, and mobile in ttt-prod,
   with no fixing during the run. A red here is dealt with before the extraction starts, never during
   it. Without a green baseline, a red after the extraction cannot be attributed.
2. **Create the package** with the moved tests and lessons. Packages gate green. DJ releases.
3. **ttt-prod adopts it** in one change set under the Normal Dev Flow:
   - install;
   - the helper files import from the package and delete their local copies;
   - the moved tests leave `src/__tests__/hosted-harness/`;
   - CONVENTIONS loses the moved lessons and gains a pointer;
   - full ttt-prod gate (`test:quiet`, including `typecheck:hosted`).
   There is no separate "adapt in ttt-prod" step before the install.
4. **Proof:** a full hosted pass on the same four engines, against a deploy that carries no app
   changes, so steps 1 and 4 are a clean before and after.
5. **Q-Sports adopts it** in its own session and scope:
   - install the published package and delete its copied helpers;
   - keep only its own journey file, casting catalogue, watchdog composition, and paths;
   - a primitive Q-Sports needs that the package lacks is added to the package first, and reaches
     ttt-prod on its next install.

## Open calls for the extracting session

- Package name (something in the `*-core` family that says "E2E engine primitives").
- Whether `render.ts`'s media-viewer recovery contract rides along. It keys on `media-viewer` package
  classes, so it is package-generic, not app-generic.
- Exactly which hosted-harness tests beyond the three named move.

**Done when:** the package is published, both apps' hosted and local suites import the shared code
from it, no copy of it is left in either app, and every hosted path is green on all four engines in
both apps after the adoption.
