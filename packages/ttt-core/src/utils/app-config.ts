import { AppConfigSchema, type AppConfig } from '../doc-schemas/system.js';
import type { PublicDocumentVersionBlock } from '../doc-schemas/public-documents.js';

export type AppConfigLevers = Readonly<Required<Omit<AppConfig, 'publicDocumentVersions'>>>;

export type AppConfigLeverKey = keyof AppConfigLevers;

// `appVersion: ''` keeps VersionGate dormant: it skips a falsy version.
export const DEFAULT_APP_CONFIG: AppConfigLevers = Object.freeze({
  appVersion: '',
  maintenanceMode: false,
  maintenanceMessage: '',
  registrationEnabled: true,
  announcementMessage: '',
  rateLimitMultiplier: 1,
});

export const DEFAULT_MAINTENANCE_MESSAGE =
  'TTT Productions is down for maintenance right now. We will be back shortly — thank you for your patience.';

// A real outage also answers `unavailable`, so the code alone never identifies this refusal.
export const MAINTENANCE_REFUSAL_CODE = 'unavailable' as const;

export const MAINTENANCE_REFUSAL_REASON = 'maintenance' as const;

export interface MaintenanceRefusalDetails {
  readonly reason: typeof MAINTENANCE_REFUSAL_REASON;
}

// The server spells the code `unavailable`, the Firebase client SDK `functions/unavailable`.
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
  const e = err as { code?: unknown; details?: unknown };
  return (
    typeof e.code === 'string' &&
    MAINTENANCE_REFUSAL_CODES.has(e.code) &&
    isMaintenanceRefusalDetails(e.details)
  );
}

function definedFields(fields: Readonly<Record<string, unknown>>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined));
}

export interface AppConfigLeverRepair {
  readonly lever: AppConfigLeverKey;
  readonly storedValue: unknown;
}

export interface AppConfigMerge {
  readonly next: AppConfig;
  readonly repairs: readonly AppConfigLeverRepair[];
  // When true, the writer must write `next` as a merge, never a full overwrite, so the stored block
  // is kept.
  readonly keepsStoredVersionBlock: boolean;
}

export function mergeAppConfigUpdate(
  existing: Readonly<Record<string, unknown>> | null | undefined,
  update: Readonly<Partial<AppConfig>>,
): AppConfigMerge {
  const stored = definedFields(existing ?? {});
  const repairs: AppConfigLeverRepair[] = [];
  for (const lever of Object.keys(DEFAULT_APP_CONFIG) as AppConfigLeverKey[]) {
    if (!(lever in stored) || AppConfigSchema.shape[lever].safeParse(stored[lever]).success)
      continue;
    repairs.push({ lever, storedValue: stored[lever] });
    delete stored[lever];
  }
  const sent = definedFields(update);
  const keepsStoredVersionBlock =
    'publicDocumentVersions' in stored &&
    !('publicDocumentVersions' in sent) &&
    !AppConfigSchema.shape.publicDocumentVersions.safeParse(stored.publicDocumentVersions).success;
  if (keepsStoredVersionBlock) delete stored.publicDocumentVersions;
  const parsed = AppConfigSchema.safeParse({ ...DEFAULT_APP_CONFIG, ...stored, ...sent });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue?.path.join('.') || 'document';
    throw new Error(
      `_appConfig/app would not match AppConfigSchema after this update (${field}: ${issue?.message ?? 'invalid'}). Nothing should be written.`,
    );
  }
  return { next: parsed.data, repairs, keepsStoredVersionBlock };
}

export function readAppConfigLever<L extends AppConfigLeverKey>(
  snapshot: Readonly<Record<string, unknown>> | null | undefined,
  lever: L,
): AppConfigLevers[L] {
  const parsed = AppConfigSchema.shape[lever].safeParse(snapshot?.[lever]);
  return parsed.success && parsed.data !== undefined
    ? (parsed.data as AppConfigLevers[L])
    : DEFAULT_APP_CONFIG[lever];
}

export function readAppConfigLevers(
  snapshot: Readonly<Record<string, unknown>> | null | undefined,
): AppConfigLevers {
  const levers: Partial<Record<AppConfigLeverKey, unknown>> = {};
  for (const lever of Object.keys(DEFAULT_APP_CONFIG) as AppConfigLeverKey[]) {
    levers[lever] = readAppConfigLever(snapshot, lever);
  }
  return levers as AppConfigLevers;
}

export type PublicDocumentVersionBlockReading =
  | { readonly status: 'absent'; readonly block: undefined }
  | { readonly status: 'valid'; readonly block: PublicDocumentVersionBlock }
  | { readonly status: 'invalid'; readonly issue: string };

const ABSENT_PUBLIC_DOCUMENT_VERSION_BLOCK: PublicDocumentVersionBlockReading = Object.freeze({
  status: 'absent',
  block: undefined,
});

export function readPublicDocumentVersionBlock(
  snapshot: Readonly<Record<string, unknown>> | null | undefined,
): PublicDocumentVersionBlockReading {
  const stored = snapshot?.publicDocumentVersions;
  if (stored === undefined) return ABSENT_PUBLIC_DOCUMENT_VERSION_BLOCK;
  const parsed = AppConfigSchema.shape.publicDocumentVersions.safeParse(stored);
  if (parsed.success && parsed.data !== undefined) return { status: 'valid', block: parsed.data };
  const issue = parsed.success ? undefined : parsed.error.issues[0];
  const field = ['publicDocumentVersions', ...(issue?.path ?? []).map(String)].join('.');
  return { status: 'invalid', issue: `${field}: ${issue?.message ?? 'invalid'}` };
}
