import { AppConfigSchema } from '../doc-schemas/system.js';
import type { AppConfig } from '../doc-schemas/system.js';

export type AppConfigLevers = Readonly<Required<AppConfig>>;

export type AppConfigLeverKey = keyof AppConfigLevers;

export const APP_CONFIG_LEVER_KEYS = AppConfigSchema.keyof().options;

export const DEFAULT_APP_CONFIG: AppConfigLevers = Object.freeze({
  appVersion: '',
  maintenanceMode: false,
  maintenanceMessage: '',
  registrationEnabled: true,
  announcementMessage: '',
});

export const DEFAULT_MAINTENANCE_MESSAGE =
  'Q-Sports is down for maintenance right now. We will be back shortly — thank you for your patience.';

export const MAINTENANCE_REFUSAL_CODE = 'unavailable' as const;

export const MAINTENANCE_REFUSAL_REASON = 'maintenance' as const;

export interface MaintenanceRefusalDetails {
  readonly reason: typeof MAINTENANCE_REFUSAL_REASON;
}

// The refusal code as the server (`unavailable`) and the Firebase client SDK
// (`functions/unavailable`) spell it.
const MAINTENANCE_REFUSAL_CODES: ReadonlySet<string> = new Set([
  MAINTENANCE_REFUSAL_CODE,
  `functions/${MAINTENANCE_REFUSAL_CODE}`,
]);

export function isMaintenanceRefusalDetails(
  details: unknown,
): details is MaintenanceRefusalDetails {
  if (!details || typeof details !== 'object') return false;
  return (details as Record<string, unknown>).reason === MAINTENANCE_REFUSAL_REASON;
}

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

export function readAppConfigLever<L extends AppConfigLeverKey>(
  snapshot: Readonly<Record<string, unknown>> | null | undefined,
  lever: L,
): AppConfigLevers[L] {
  const stored = snapshot?.[lever];
  if (stored === undefined) return DEFAULT_APP_CONFIG[lever];
  const parsed = AppConfigSchema.shape[lever].safeParse(stored);
  if (!parsed.success) {
    throw new Error(
      `_appConfig/app.${lever} does not match its schema (${parsed.error.issues[0]?.message ?? 'invalid'}).`,
    );
  }
  return parsed.data as AppConfigLevers[L];
}

export function readAppConfigLevers(
  snapshot: Readonly<Record<string, unknown>> | null | undefined,
): AppConfigLevers {
  const levers: Partial<Record<AppConfigLeverKey, unknown>> = {};
  for (const lever of APP_CONFIG_LEVER_KEYS) {
    levers[lever] = readAppConfigLever(snapshot, lever);
  }
  return levers as AppConfigLevers;
}
