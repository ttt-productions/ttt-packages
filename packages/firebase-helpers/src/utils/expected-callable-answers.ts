export const EXPECTED_CALLABLE_ANSWER_CODES = [
  'failed-precondition',
  'permission-denied',
  'unauthenticated',
  'not-found',
  'already-exists',
  'invalid-argument',
  'resource-exhausted',
  'out-of-range',
  'aborted',
] as const;

export type ExpectedCallableAnswerCode = (typeof EXPECTED_CALLABLE_ANSWER_CODES)[number];

const BARE_SET: ReadonlySet<string> = new Set(EXPECTED_CALLABLE_ANSWER_CODES);

export function isExpectedCallableAnswerCode(code: unknown): boolean {
  if (typeof code !== 'string') return false;
  const bare = code.startsWith('functions/') ? code.slice('functions/'.length) : code;
  return BARE_SET.has(bare);
}

export function callableRefusalCode(error: unknown): ExpectedCallableAnswerCode | null {
  const code = (error as { code?: unknown } | null)?.code;
  if (typeof code !== 'string' || !isExpectedCallableAnswerCode(code)) return null;
  return code.replace(/^functions\//, '') as ExpectedCallableAnswerCode;
}

export function callableRefusalReason<TReason extends string>(
  error: unknown,
  reasons: readonly TReason[],
): TReason | null {
  if (callableRefusalCode(error) !== 'failed-precondition') return null;
  const details = (error as { details?: unknown }).details;
  const reason =
    details !== null && typeof details === 'object'
      ? (details as { reason?: unknown }).reason
      : undefined;
  return (reasons as readonly unknown[]).includes(reason) ? (reason as TReason) : null;
}
