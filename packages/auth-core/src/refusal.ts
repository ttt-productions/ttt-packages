const FAILED_PRECONDITION_CODES: ReadonlySet<string> = new Set([
  'failed-precondition',
  'functions/failed-precondition',
]);

const UNAUTHENTICATED_CODES: ReadonlySet<string> = new Set([
  'unauthenticated',
  'functions/unauthenticated',
]);

export function failedPreconditionDetails(err: unknown): unknown {
  if (!err || typeof err !== 'object') return undefined;
  const e = err as { code?: unknown; details?: unknown };
  return typeof e.code === 'string' && FAILED_PRECONDITION_CODES.has(e.code)
    ? e.details
    : undefined;
}

export function unauthenticatedRefusal(err: unknown): { readonly details: unknown } | null {
  if (!err || typeof err !== 'object') return null;
  const e = err as { code?: unknown; details?: unknown };
  return typeof e.code === 'string' && UNAUTHENTICATED_CODES.has(e.code)
    ? { details: e.details }
    : null;
}
