// The `_appConfig/app` singleton at rest, and the ONE rule each for writing to it and reading it.
//
// WRITE. Several backend writers touch this doc (the admin App configuration card through
// updateAppConfig, the public-document release publish, a seed), and each sends only the fields
// it owns. Written as a bare merge, the first of them to run after the doc is gone (a fresh or
// wiped environment) creates a doc WITHOUT the fields AppConfigSchema requires. The write rule
// is `mergeAppConfigUpdate(existing, update)`: the writer's update on top of the doc it read,
// with any field that doc lacks taken from DEFAULT_APP_CONFIG, validated as a whole.
//
// READ. The stored doc is untrusted — an operator can console-edit any field into any shape —
// and a config read must never take the product down by itself. The read rule is
// `readAppConfigLever(snapshot, lever)`: the lever's stored value when its AppConfigSchema field
// accepts it, otherwise its DEFAULT_APP_CONFIG value, one lever at a time so a bad field never
// costs the good ones. `readAppConfigLevers` is every lever through it. The backend's cached
// snapshot reader and the client shell both read through these.
//
// See docs/design/ttt-productions-version-gate.md (ttt-prod) § The `_appConfig/app` document and
// § Operational levers.

import { AppConfigSchema, type AppConfig } from '../doc-schemas/system.js';

/**
 * Every operator lever of `_appConfig/app`, each at a value its AppConfigSchema field accepts.
 * The release-owned `publicDocumentVersions` block is not a lever.
 */
export type AppConfigLevers = Readonly<Required<Omit<AppConfig, 'publicDocumentVersions'>>>;

/** The name of one operator lever — a key of DEFAULT_APP_CONFIG. */
export type AppConfigLeverKey = keyof AppConfigLevers;

/**
 * Every operator lever of `_appConfig/app` at rest — the doc a fresh environment behaves as if
 * it held, and the value each reader falls back to for a missing or unreadable field. The OPEN
 * posture: maintenance off, registration open, no banner, no throttle.
 *
 * `appVersion` is `''`: no version has been published. VersionGate skips a falsy version, so it
 * stays dormant — no reload for any browser, whatever version it stored before — until an
 * operator sets a real one through updateAppConfig (whose input refuses `''`). From then on the
 * gate compares as usual.
 *
 * The release-owned `publicDocumentVersions` block is not a lever and has no default: it is
 * absent until the first release.
 */
export const DEFAULT_APP_CONFIG: AppConfigLevers = Object.freeze({
  appVersion: '',
  maintenanceMode: false,
  maintenanceMessage: '',
  registrationEnabled: true,
  announcementMessage: '',
  rateLimitMultiplier: 1,
});

/**
 * The line shown while maintenance is on and the operator left `maintenanceMessage` blank — on
 * the maintenance takeover screen and in the callable refusal alike.
 */
export const DEFAULT_MAINTENANCE_MESSAGE =
  'TTT Productions is down for maintenance right now. We will be back shortly — thank you for your patience.';

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

/**
 * One operator lever off an unvalidated `_appConfig/app` snapshot (the raw stored doc; `null` or
 * `undefined` when it is missing or not yet read): the stored value when its AppConfigSchema
 * field accepts it, otherwise the lever's DEFAULT_APP_CONFIG value — for an absent field and for
 * a value the schema refuses (a wrong type, an over-cap message, an out-of-range multiplier)
 * alike. Pure; never throws.
 */
export function readAppConfigLever<L extends AppConfigLeverKey>(
  snapshot: Readonly<Record<string, unknown>> | null | undefined,
  lever: L,
): AppConfigLevers[L] {
  const parsed = AppConfigSchema.shape[lever].safeParse(snapshot?.[lever]);
  return parsed.success && parsed.data !== undefined
    ? (parsed.data as AppConfigLevers[L])
    : DEFAULT_APP_CONFIG[lever];
}

/**
 * Every operator lever off an unvalidated `_appConfig/app` snapshot, each read through
 * `readAppConfigLever` — so a field the schema refuses falls back to its default while every
 * valid field survives, and a missing doc reads as DEFAULT_APP_CONFIG: the open posture. Pure;
 * never throws.
 */
export function readAppConfigLevers(
  snapshot: Readonly<Record<string, unknown>> | null | undefined,
): AppConfigLevers {
  const levers: Partial<Record<AppConfigLeverKey, unknown>> = {};
  for (const lever of Object.keys(DEFAULT_APP_CONFIG) as AppConfigLeverKey[]) {
    levers[lever] = readAppConfigLever(snapshot, lever);
  }
  return levers as AppConfigLevers;
}
