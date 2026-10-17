// The ONE declaration of the "expected callable answer" HttpsError code set —
// gate/precondition/permission rejections that are the server ANSWERING the user,
// not failing. Consumers use it to keep benign rejections out of their monitoring
// and to tell a designed refusal from a fault. Generic Firebase codes —
// deliberately app-agnostic, so it lives here rather than an app-data package.

/** Bare HttpsError codes (server-side shape, e.g. `failed-precondition`). */
export const EXPECTED_CALLABLE_ANSWER_CODES = [
  'failed-precondition',
  'permission-denied',
  'unauthenticated',
  'not-found',
  'already-exists',
  'invalid-argument',
  'resource-exhausted',
  'out-of-range',
  // Optimistic-concurrency conflict: "this changed since you loaded it — reload and
  // retry" is the server answering the user, not failing.
  'aborted',
] as const;

export type ExpectedCallableAnswerCode = (typeof EXPECTED_CALLABLE_ANSWER_CODES)[number];

const BARE_SET: ReadonlySet<string> = new Set(EXPECTED_CALLABLE_ANSWER_CODES);

/**
 * Is this error code an expected callable answer? Accepts both the server-side bare
 * form (`failed-precondition`) and the client SDK's prefixed form
 * (`functions/failed-precondition`).
 */
export function isExpectedCallableAnswerCode(code: unknown): boolean {
  if (typeof code !== 'string') return false;
  const bare = code.startsWith('functions/') ? code.slice('functions/'.length) : code;
  return BARE_SET.has(bare);
}

/**
 * The code of a designed refusal, bare (`not-found`) whether the error carries the server's form
 * or the client SDK's `functions/` prefix; null for anything else. A caller that acts on a refusal
 * matches this, never the message.
 */
export function callableRefusalCode(error: unknown): ExpectedCallableAnswerCode | null {
  const code = (error as { code?: unknown } | null)?.code;
  if (typeof code !== 'string' || !isExpectedCallableAnswerCode(code)) return null;
  return code.replace(/^functions\//, '') as ExpectedCallableAnswerCode;
}

/**
 * The reason a designed `failed-precondition` refusal names in its `details.reason`, when it is
 * one of `reasons`; null for any other failure. Refusals sharing that code are told apart by
 * `details.reason`, never by the message, so each recognizer passes its own reason set.
 */
export function callableRefusalReason<TReason extends string>(
  error: unknown,
  reasons: readonly TReason[],
): TReason | null {
  if (callableRefusalCode(error) !== 'failed-precondition') return null;
  const details = (error as { details?: unknown }).details;
  const reason =
    details !== null && typeof details === 'object' ? (details as { reason?: unknown }).reason : undefined;
  return (reasons as readonly unknown[]).includes(reason) ? (reason as TReason) : null;
}
