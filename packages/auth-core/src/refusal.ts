const FAILED_PRECONDITION_CODES: ReadonlySet<string> = new Set([
  'failed-precondition',
  'functions/failed-precondition',
]);

export function failedPreconditionDetails(err: unknown): unknown {
  if (!err || typeof err !== 'object') return undefined;
  const e = err as { code?: unknown; details?: unknown };
  return typeof e.code === 'string' && FAILED_PRECONDITION_CODES.has(e.code)
    ? e.details
    : undefined;
}
