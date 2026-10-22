export const RESUBSCRIBE_DELAYS_MS = [5_000, 15_000, 45_000] as const;

export function isPermissionDeniedError(error: unknown): boolean {
  return (error as { code?: string } | null | undefined)?.code === 'permission-denied';
}
