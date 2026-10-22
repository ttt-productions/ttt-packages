
## ttt-core — addendum (FX-F)

`TEXT_MODERATION_MIN_LENGTH` (3; installed `dist/constants/moderation.js`) removed →
`functions/src/shared/backend-constants.ts`; `text-moderation.ts` imports it there; the
`backend-constants.test.ts` assertion switches to the local import; drop it from the stale "moved to
ttt-core" comment.

## monitoring-core — BEHAVIOR (the app decides when monitoring is off)

The package reads no environment variable; `initMonitoring({ enabled })` is the off switch.
`functions/src/monitoring-init-options.ts` returns `enabled: env.FUNCTIONS_EMULATOR !== 'true'` (and
`functions/src/monitoring-init.test.ts` flips its "no enable switch" assertion; the header comments
in `monitoring-init.ts` / `monitoring-init-options.ts` are rewritten). `src/app/monitoring-provider.tsx`
passes `enabled: process.env.NEXT_PUBLIC_USE_EMULATORS !== 'true'`. The instrumentation files and
Workers do not call `initMonitoring`.
