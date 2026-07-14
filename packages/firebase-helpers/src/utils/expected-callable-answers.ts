// The ONE declaration of the "expected callable answer" HttpsError code set —
// gate/precondition/permission rejections that are the server ANSWERING the user,
// not failing. Consumers use it to keep benign rejections out of Sentry (the
// backend Sentry event processor drops them; the client callable wrapper skips
// capture + shows the toast). Consolidated 2026-07-13 from the former "keep the
// two code sets in sync" pair in the consuming app (its Cloud Functions entry ↔
// its client callable hook). Generic Firebase codes — deliberately
// app-agnostic, so it lives here rather than an app-data package.

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
