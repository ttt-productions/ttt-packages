export const MAINTENANCE_REFUSAL_CODE = 'unavailable' as const;

export const MAINTENANCE_REFUSAL_REASON = 'maintenance' as const;

export interface MaintenanceRefusalDetails {
  readonly reason: typeof MAINTENANCE_REFUSAL_REASON;
}

// A client SDK error carries its code with a `functions/` prefix; the server carries it bare.
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
  const { code, details } = err as { code?: unknown; details?: unknown };
  return (
    typeof code === 'string' &&
    MAINTENANCE_REFUSAL_CODES.has(code) &&
    isMaintenanceRefusalDetails(details)
  );
}
