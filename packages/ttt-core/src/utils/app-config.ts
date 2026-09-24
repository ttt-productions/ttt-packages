// The `_appConfig/app` singleton at rest, and the ONE rule for writing to it.
//
// Several backend writers touch this doc (the admin App configuration card through
// updateAppConfig, the public-document release publish, a seed), and each sends only the fields
// it owns. Written as a bare merge, the first of them to run after the doc is gone (a fresh or
// wiped environment) creates a doc WITHOUT the fields AppConfigSchema requires. The write rule
// is `mergeAppConfigUpdate(existing, update)`: the writer's update on top of the doc it read,
// with any field that doc lacks taken from DEFAULT_APP_CONFIG, validated as a whole.
//
// See docs/design/ttt-productions-version-gate.md (ttt-prod) § The `_appConfig/app` document.

import { AppConfigSchema, type AppConfig } from '../doc-schemas/system.js';

/**
 * Every operator lever of `_appConfig/app` at rest — the doc a fresh environment behaves as if
 * it held, and the default each reader falls back to for a missing field. The OPEN posture:
 * maintenance off, registration open, no banner, no throttle.
 *
 * `appVersion` is `''`: no version has been published. VersionGate skips a falsy version, so it
 * stays dormant — no reload for any browser, whatever version it stored before — until an
 * operator sets a real one through updateAppConfig (whose input refuses `''`). From then on the
 * gate compares as usual.
 *
 * The release-owned `publicDocumentVersions` block is not a lever and has no default: it is
 * absent until the first release.
 */
export const DEFAULT_APP_CONFIG: Readonly<Required<Omit<AppConfig, 'publicDocumentVersions'>>> =
  Object.freeze({
    appVersion: '',
    maintenanceMode: false,
    maintenanceMessage: '',
    registrationEnabled: true,
    announcementMessage: '',
    rateLimitMultiplier: 1,
  });

function definedFields(fields: Readonly<Record<string, unknown>>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined));
}

/**
 * The complete `_appConfig/app` doc to write after applying `update` to `existing` (the doc as
 * read in the writer's transaction; `undefined` or `null` when it does not exist). The update's
 * fields win; `existing` supplies the rest; any field still missing comes from
 * DEFAULT_APP_CONFIG. An `undefined` update field changes nothing. Pure.
 *
 * Throws when the result would not parse under AppConfigSchema — an invalid update, or an
 * invalid field already on the doc — so nothing invalid is ever written over it.
 */
export function mergeAppConfigUpdate(
  existing: Readonly<Record<string, unknown>> | null | undefined,
  update: Readonly<Partial<AppConfig>>,
): AppConfig {
  const parsed = AppConfigSchema.safeParse({
    ...DEFAULT_APP_CONFIG,
    ...definedFields(existing ?? {}),
    ...definedFields(update),
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue?.path.join('.') || 'document';
    throw new Error(
      `_appConfig/app would not match AppConfigSchema after this update (${field}: ${issue?.message ?? 'invalid'}). Nothing should be written.`,
    );
  }
  return parsed.data;
}
