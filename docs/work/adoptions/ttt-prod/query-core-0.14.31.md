# Adopt @ttt-productions/query-core 0.14.31

**What:** The app-config mechanism is shared: `createAppConfig` on `./react`.
**Severity:** medium
**Came from:** the ttt-packages shared-package session (Q-Sports scope, ttt-parity Foundations)

- **Package and version:** `@ttt-productions/query-core` 0.14.31.
- **Release:** `./scripts/release-multiple.sh firebase-helpers monitoring-core query-core patch`.
- **What changed:**
  - New on `./react`: `createAppConfig(definition)`, returning `AppConfigProvider`, `useAppConfig`, `readAppConfigSnapshot`, `LOADING_APP_CONFIG` and `UNAVAILABLE_APP_CONFIG`, with `APP_CONFIG_MAX_QUICK_ATTEMPTS`, `APP_CONFIG_BACKGROUND_RETRY_MS` and the types (`AppConfigDefinition`, `AppConfigState`, `AppConfigSnapshotState`, `AppConfigStatus`, `AppConfigLeverOf`, `StoredAppConfig`, `AppConfig`). It is ttt-prod's `src/components/app-config-provider.tsx` made generic: the one live listener (reading `db` from the `FirestoreProvider`), its self-healing retry ladder and minute-by-minute background retry, lever-by-lever reading, refused levers reported once per field and value, `retry` / `retrying`.
  - The app supplies `path`, `defaults`, `readLevers`, `isLeverRefused`, `extra: { read, whileUnknown }` (fields spread into the state beside the levers) and the `onLeverRefused` / `onUnavailable` reporting callbacks.
  - Design: ttt-packages `docs/packages/query-core.md` § `createAppConfig`.
- **What the app must change:** Install. `src/components/app-config-provider.tsx` becomes one `createAppConfig<AppConfigLevers, { versionBlock: PublicDocumentVersionBlockReading | null }>({ path: toPath(PATH_BUILDERS.appConfig()), defaults: DEFAULT_APP_CONFIG, readLevers: readAppConfigLevers, isLeverRefused: (stored, lever) => stored[lever] !== undefined && !AppConfigSchema.shape[lever].safeParse(stored[lever]).success, extra: { read: (stored) => ({ versionBlock: readPublicDocumentVersionBlock(stored ?? undefined) }), whileUnknown: { versionBlock: null } }, onLeverRefused: <its captureMessage, same text and extra>, onUnavailable: <its captureException, same tags and attempts> })`, exporting the returned names under the names it has today; `publicDocumentBlockState` and its type stay in the app. Every consumer's call site is unchanged. The provider's tests keep the ttt-prod facts (the version block, the levers' schema, the consumers); the listener mechanics are the package's.
- **Done when:** The lockfiles name `@ttt-productions/query-core` 0.14.31 or later, the app holds no `_appConfig/app` listener of its own, and the gate is green.
