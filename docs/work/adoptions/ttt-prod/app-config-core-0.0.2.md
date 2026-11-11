# Adopt @ttt-productions/app-config-core 0.0.2

**What:** A new shared app-config package: the strict read of the app config document's settings, the merge that finds what an update really changes, and the one writer that writes only that.
**Severity:** high

- **Package and version:** `@ttt-productions/app-config-core` 0.0.2 (new).
- **Release:** `./scripts/release-multiple.sh dev-standards storage-core firebase-helpers
  ui-core repo-guards theme-core consent-core query-core app-config-core notification-core
  sweep-core auth-core q-core media-viewer file-input upload-core patch`.
- **What the package owns** (`docs/packages/app-config-core.md`):
  - `.` — `defineAppConfig({ path, schema })` returns the product's definition: `settings` (the
    setting names, taken from the schema), `read(stored)` (the settings alone; throws
    `AppConfigInvalidError` naming the missing document, or the missing or invalid setting, from
    the product's path), and `merge(stored, update)` (`before`, `after`, and `changes` holding only
    the settings whose value really differs, compared by value, so a nested block or a list sent
    again unchanged is no change; an update the schema refuses throws, `problem: 'invalid-update'`).
    A stored field that is not a setting is never read, refused, merged or written.
  - `./server` — `writeAppConfig(writer, { ref, definition, stored, update })`: merges the data the
    caller read in its own transaction, calls `writer.update(ref, …)` with exactly the changed
    settings (never when nothing changed), and returns `updatedSettings` with each one's `before`
    and `after` for the audit. A missing or invalid stored document throws and nothing is written.
    An Admin SDK transaction is a writer, from a TypeScript callable and from a plain `.mjs` script.
- **What ttt-prod hands in:** the `_appConfig/app` path and ttt-core's `AppConfigSchema`, bound
  once in ttt-core with `defineAppConfig` and exported from ttt-core for every reader and writer. A
  nested block (`publicDocumentVersions`) and a number (`rateLimitMultiplier`) are settings like any
  other: the package serves them as they are.
- **What the app must change:** ttt-prod's own app-config work — the document must exist and hold
  every setting with a valid value, no setting has a default anywhere, an admin save writes only
  what changed — is built on this package instead of in ttt-core:
  - ttt-core's copy of the read and the merge in `src/utils/app-config.ts` goes
    (`readAppConfigLevers`, `readAppConfigLever`, `mergeAppConfigUpdate` with its
    `repairs` and `keepsStoredVersionBlock`, and the defaults they read); ttt-core keeps its schema,
    its path and its own maintenance and refusal values, and exports its definition.
  - The two writers, `functions/src/shared/app-config-write.ts` and
    `scripts/hosted-wipe/lib/barrier.mjs`, call `writeAppConfig` with the definition and the data
    their transaction read. Neither builds a payload, sets the document whole, or decides which
    settings changed; the save's audit records `before` and `after` from what `writeAppConfig`
    returns.
  - With the one writer, the hosted wipe's barrier and the admin save FAIL on a missing or invalid
    `_appConfig/app` instead of creating or repairing it, and the hand-built `failed-precondition`
    catch in `functions/src/shared/app-config-write.ts` goes.
  - The two `package-builder` entries for `mergeAppConfigUpdate` in
    `src/__tests__/guards/config/firestore-write-exceptions.ts` go: no app code writes the app
    config payload any more.
  - Every reader that reads the document through ttt-core's read takes the definition's `read`,
    the query-core `createAppConfig` provider included (its `read`).
  - The strict read reports a setting as missing only once ttt-core's `AppConfigSchema` makes every
    setting required: while a setting is optional in the schema, a document without it reads as
    valid.
- **Done when:** the lockfiles name `@ttt-productions/app-config-core` 0.0.2 or later; no code in
  ttt-core or the app reads, merges or writes `_appConfig/app` but through the definition and
  `writeAppConfig`; the stored-field guard is green with neither `mergeAppConfigUpdate` exception;
  and the Normal TTT Test Flow is green.
