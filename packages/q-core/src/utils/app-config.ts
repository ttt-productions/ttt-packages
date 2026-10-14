// The `_appConfig/app` singleton at rest, and the one rule each for writing it and reading it.
//
// WRITE. `mergeAppConfigUpdate(existing, update)`: the writer's update on top of the document it
// read, any field that document lacks taken from DEFAULT_APP_CONFIG, the whole result validated.
// A writer that runs first on a fresh environment therefore still writes a complete, valid
// document rather than a partial one. A stored field that does not parse — a hand edit in the
// console — is never written over by a save that does not send it: the merge refuses, and the
// writer answers with the field, so the operator corrects it at the source. A save that sends the
// field replaces it.
//
// READ. The stored document is untrusted — an operator can edit any field in the console into any
// shape — and a config read must never take the product down by itself. `readAppConfigLever`
// answers one lever at a time: the stored value when its schema field accepts it, otherwise the
// lever's DEFAULT_APP_CONFIG value, so one bad field never costs the good ones. The server's cached
// snapshot reader and the client's readers both read through it.

import { AppConfigSchema } from '../doc-schemas/system.js';
import type { AppConfig } from '../doc-schemas/system.js';

/** Every operator lever of `_appConfig/app`, each at a value its schema field accepts. */
export type AppConfigLevers = Readonly<Required<AppConfig>>;

/** The name of one operator lever. */
export type AppConfigLeverKey = keyof AppConfigLevers;

/** Every lever name, derived from the document schema. */
export const APP_CONFIG_LEVER_KEYS = AppConfigSchema.keyof().options;

/**
 * The document a fresh environment behaves as if it held, and the value each reader falls back to
 * for a missing or unreadable field: maintenance off, registration open, no banner.
 *
 * `appVersion` is `''` — no version has been published — so the version gate stays dormant until an
 * operator sets a real one through `updateAppConfig`, whose input refuses `''`.
 */
export const DEFAULT_APP_CONFIG: AppConfigLevers = Object.freeze({
  appVersion: '',
  maintenanceMode: false,
  maintenanceMessage: '',
  registrationEnabled: true,
  announcementMessage: '',
});

/**
 * The line shown while maintenance is on and the operator left `maintenanceMessage` blank — on the
 * maintenance screen and in the callable refusal alike.
 */
export const DEFAULT_MAINTENANCE_MESSAGE =
  'Q-Sports is down for maintenance right now. We will be back shortly — thank you for your patience.';

/**
 * The code the callable maintenance refusal is thrown with. `unavailable` is also what a real outage
 * produces, so the code alone never identifies the refusal — its details do.
 */
export const MAINTENANCE_REFUSAL_CODE = 'unavailable' as const;

/** The `details.reason` the callable maintenance refusal carries. */
export const MAINTENANCE_REFUSAL_REASON = 'maintenance' as const;

/** Structured details carried by the callable maintenance refusal. */
export interface MaintenanceRefusalDetails {
  readonly reason: typeof MAINTENANCE_REFUSAL_REASON;
}

// The refusal code as the server (`unavailable`) and the Firebase client SDK
// (`functions/unavailable`) spell it.
const MAINTENANCE_REFUSAL_CODES: ReadonlySet<string> = new Set([
  MAINTENANCE_REFUSAL_CODE,
  `functions/${MAINTENANCE_REFUSAL_CODE}`,
]);

/** True when `details` is the maintenance refusal's structured details. */
export function isMaintenanceRefusalDetails(details: unknown): details is MaintenanceRefusalDetails {
  if (!details || typeof details !== 'object') return false;
  return (details as Record<string, unknown>).reason === MAINTENANCE_REFUSAL_REASON;
}

/**
 * True when `err` is the callable maintenance refusal — an `unavailable` error in either spelling
 * whose details carry `reason: 'maintenance'`. Works on the server-side error and on the client-side
 * callable error alike, and is decided by the code and the details, never the message, so a genuine
 * outage is never mistaken for the designed refusal.
 */
export function isMaintenanceRefusalError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const candidate = err as { code?: unknown; details?: unknown };
  return (
    typeof candidate.code === 'string' &&
    MAINTENANCE_REFUSAL_CODES.has(candidate.code) &&
    isMaintenanceRefusalDetails(candidate.details)
  );
}

function definedFields(fields: Readonly<Record<string, unknown>>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined));
}

/**
 * The complete `_appConfig/app` document to write after applying `update` to `existing` (the
 * document as read in the writer's transaction; `null` or `undefined` when it does not exist). The
 * update's fields win, `existing` supplies the rest, and any field still missing comes from
 * DEFAULT_APP_CONFIG. An `undefined` update field changes nothing. Pure.
 *
 * Throws when the result would not parse — the update itself, or a stored field the update does not
 * replace — so an invalid document is never written.
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
      `_appConfig/app would not match its schema after this update (${field}: ${issue?.message ?? 'invalid'}). Nothing should be written.`,
    );
  }
  return parsed.data;
}

/**
 * One operator lever off an unvalidated `_appConfig/app` snapshot (`null` or `undefined` when the
 * document is missing or not yet read): the stored value when its schema field accepts it, otherwise
 * the lever's DEFAULT_APP_CONFIG value — for an absent field and a refused one alike. Never throws.
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
 * True when an unvalidated `_appConfig/app` snapshot holds `lever` with a value its schema field
 * refuses — the value every reader passes over for the default. An absent field is not refused.
 * Never throws.
 */
export function isAppConfigLeverRefused(
  snapshot: Readonly<Record<string, unknown>> | null | undefined,
  lever: AppConfigLeverKey,
): boolean {
  const stored = snapshot?.[lever];
  return stored !== undefined && !AppConfigSchema.shape[lever].safeParse(stored).success;
}

/** Every lever off an unvalidated snapshot, each through `readAppConfigLever`. Never throws. */
export function readAppConfigLevers(
  snapshot: Readonly<Record<string, unknown>> | null | undefined,
): AppConfigLevers {
  const levers: Partial<Record<AppConfigLeverKey, unknown>> = {};
  for (const lever of APP_CONFIG_LEVER_KEYS) {
    levers[lever] = readAppConfigLever(snapshot, lever);
  }
  return levers as AppConfigLevers;
}
