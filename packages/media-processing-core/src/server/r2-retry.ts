// Bounded transient-retry policy for the R2 object store.
//
// PRIVATE sibling of storage-ops.ts — imported ONLY by that module. It is
// deliberately NOT re-exported from the server barrel (`server/index.ts`); the
// only public surface is the `R2StorageError` type, which storage-ops re-exports
// so callers can recognize an exhausted storage operation.
//
// The policy applies to the idempotent-against-a-deterministic-key operations
// only (putFile, copy, readToFile). `delete` is intentionally one-shot and never
// routes through here. Signing/config failures, local filesystem errors, and
// deterministic HTTP 4xx responses are never retried.

// ---------------------------------------------------------------------------
// Fixed internal policy — never exposed as tunables on the public factory.
// ---------------------------------------------------------------------------

/** TOTAL attempts (initial + retries) — three totals means at most TWO delays. */
export const R2_REQUEST_MAX_ATTEMPTS = 3;
/** Base delay for full-jitter exponential backoff. */
export const R2_RETRY_BASE_DELAY_MS = 250;
/** Ceiling on the exponential backoff (before jitter). */
export const R2_RETRY_MAX_BACKOFF_MS = 5_000;
/** Hard cap on an honored server `Retry-After` so one response can't eat the
 *  caller's whole timeout budget. */
export const R2_RETRY_AFTER_CAP_MS = 30_000;

/** HTTP statuses treated as transient and safe to retry. */
export const R2_RETRYABLE_STATUSES: ReadonlySet<number> = new Set([408, 429, 500, 502, 503, 504]);

export type R2RetryableOperation = "putFile" | "copy" | "readToFile";

/** Deterministic seams for tests; production defaults are internal (see below). */
export interface R2RetrySeams {
  /** Resolve after `ms` milliseconds. */
  sleep: (ms: number) => Promise<void>;
  /** Uniform random in [0, 1). */
  random: () => number;
  /** Epoch-millisecond clock — keeps HTTP-date `Retry-After` tests off wall-clock. */
  now: () => number;
}

/** Production seam defaults. */
export function defaultR2RetrySeams(): R2RetrySeams {
  return {
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    random: Math.random,
    now: Date.now,
  };
}

// ---------------------------------------------------------------------------
// Transient-error classification
// ---------------------------------------------------------------------------

// Recognized transient transport failure codes (undici/fetch surface these on
// the error or its `.cause`). A broken connection to R2 lands here.
const RETRYABLE_NETWORK_ERROR_CODES: ReadonlySet<string> = new Set([
  "ECONNRESET",
  "ECONNREFUSED",
  "ECONNABORTED",
  "ETIMEDOUT",
  "EPIPE",
  "ENOTFOUND",
  "EAI_AGAIN",
  "ENETUNREACH",
  "ENETDOWN",
  "EHOSTUNREACH",
  "EHOSTDOWN",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_HEADERS_TIMEOUT",
  "UND_ERR_BODY_TIMEOUT",
  "UND_ERR_SOCKET",
]);

// Deterministic local filesystem errors are NEVER retried (disk full, perms,
// missing dir, etc.). This guard wins over any transport classification so a
// local write failure during readToFile piping can't be mistaken for transient.
const LOCAL_FS_ERROR_CODES: ReadonlySet<string> = new Set([
  "ENOSPC",
  "EACCES",
  "EISDIR",
  "ENOENT",
  "EROFS",
  "EMFILE",
  "ENFILE",
  "EBADF",
  "EEXIST",
  "EPERM",
  "ENAMETOOLONG",
  "ELOOP",
  "ENOTDIR",
  "EDQUOT",
]);

function codeOf(err: unknown): string | undefined {
  if (err && typeof err === "object") {
    const c = (err as { code?: unknown }).code;
    if (typeof c === "string") return c;
  }
  return undefined;
}

/**
 * True only for recognized transient transport failures. An explicit
 * `AbortError` and deterministic local-filesystem errors always return false —
 * an abort must never become another attempt.
 */
export function isRetryableTransportError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { name?: unknown; cause?: unknown };

  // NEVER convert an explicit abort into another attempt.
  if (e.name === "AbortError") return false;

  const selfCode = codeOf(err);
  const causeCode = codeOf(e.cause);

  // Deterministic local filesystem errors are not transient — decided first so a
  // local write error can never be reclassified as a transport failure.
  if (selfCode && LOCAL_FS_ERROR_CODES.has(selfCode)) return false;
  if (causeCode && LOCAL_FS_ERROR_CODES.has(causeCode)) return false;

  // Recognized transient network codes on the error or its cause.
  if (selfCode && RETRYABLE_NETWORK_ERROR_CODES.has(selfCode)) return true;
  if (causeCode && RETRYABLE_NETWORK_ERROR_CODES.has(causeCode)) return true;

  // fetch()/undici surface transport failures as `TypeError: fetch failed`
  // (often with an unrecognized or absent cause) — treat those as transient.
  if (err instanceof TypeError || e.name === "TypeError") return true;

  return false;
}

// ---------------------------------------------------------------------------
// Retry-After parsing + delay computation
// ---------------------------------------------------------------------------

/**
 * Parse a `Retry-After` header value into a non-negative millisecond delay.
 * Supports both the delta-seconds form (`"120"`) and the HTTP-date form
 * (`"Wed, 21 Oct 2015 07:28:00 GMT"`). Returns null when absent/unparseable.
 * An HTTP-date in the past clamps to 0.
 */
export function parseRetryAfterMs(headerValue: string | null | undefined, nowMs: number): number | null {
  if (headerValue == null) return null;
  const trimmed = headerValue.trim();
  if (trimmed === "") return null;

  // delta-seconds form
  if (/^\d+$/.test(trimmed)) {
    const seconds = Number(trimmed);
    if (!Number.isFinite(seconds) || seconds < 0) return null;
    return seconds * 1000;
  }

  // HTTP-date form
  const dateMs = Date.parse(trimmed);
  if (Number.isNaN(dateMs)) return null;
  const delta = dateMs - nowMs;
  return delta > 0 ? delta : 0;
}

/**
 * Compute the pre-next-attempt delay. If the failed response carries a valid
 * `Retry-After`, honor it (capped, no backoff added on top). Otherwise use
 * full-jitter exponential backoff: `random(0, min(maxBackoff, base * 2^retryIndex))`.
 */
export function computeR2DelayMs(params: {
  response: Response | null;
  /** 0-based index of the retry about to happen (0 for the first retry). */
  retryIndex: number;
  seams: R2RetrySeams;
}): number {
  const { response, retryIndex, seams } = params;

  if (response) {
    const retryAfterMs = parseRetryAfterMs(response.headers.get("retry-after"), seams.now());
    if (retryAfterMs !== null) {
      return Math.min(retryAfterMs, R2_RETRY_AFTER_CAP_MS);
    }
  }

  const ceiling = Math.min(R2_RETRY_MAX_BACKOFF_MS, R2_RETRY_BASE_DELAY_MS * 2 ** retryIndex);
  return Math.floor(seams.random() * ceiling);
}

// ---------------------------------------------------------------------------
// Exhaustion error
// ---------------------------------------------------------------------------

/**
 * Thrown when an R2 operation exhausts its retries or hits a non-retryable
 * response. Carries operation/bucket/key/attempt/status context and a
 * bounded, sanitized response body — never credentials, authorization headers,
 * or full signed URLs.
 */
export class R2StorageError extends Error {
  readonly operation: R2RetryableOperation;
  readonly bucket: string;
  readonly key: string;
  readonly attempts: number;
  readonly status?: number;
  readonly responseText?: string;

  constructor(params: {
    operation: R2RetryableOperation;
    bucket: string;
    key: string;
    attempts: number;
    status?: number;
    responseText?: string;
    cause?: unknown;
  }) {
    const statusPart = params.status !== undefined ? ` status ${params.status}` : "";
    const bodyPart = params.responseText ? ` ${params.responseText}` : "";
    super(
      `R2 ${params.operation} failed for ${params.bucket}/${params.key} after ${params.attempts} attempt(s):${statusPart}${bodyPart}`.trim(),
      params.cause !== undefined ? { cause: params.cause } : undefined,
    );
    this.name = "R2StorageError";
    this.operation = params.operation;
    this.bucket = params.bucket;
    this.key = params.key;
    this.attempts = params.attempts;
    this.status = params.status;
    this.responseText = params.responseText;
  }
}

// ---------------------------------------------------------------------------
// Retry driver
// ---------------------------------------------------------------------------

export type R2AttemptResult<T> =
  | { kind: "success"; value: T }
  | { kind: "response"; response: Response };

// Strip ASCII control characters (0x00-0x1F, 0x7F) and bound length. Done with a
// code-point filter rather than a control-character regex (which `no-control-regex`
// forbids and which would embed literal control bytes in source).
function sanitizeBodyText(text: string): string {
  let out = "";
  for (const ch of text.slice(0, 1000)) {
    const code = ch.codePointAt(0) ?? 0;
    out += code < 0x20 || code === 0x7f ? " " : ch;
  }
  return out.trim().slice(0, 500);
}

// Bounded, sanitized read of a failed response body. Also drains the body so
// the underlying socket can be reused before the next attempt. R2 error bodies
// are short XML and never contain our credentials; sanitize defensively regardless.
async function safeReadBoundedBody(res: Response): Promise<string> {
  try {
    return sanitizeBodyText(await res.text());
  } catch {
    return "<no body>";
  }
}

/**
 * Drive up to `R2_REQUEST_MAX_ATTEMPTS` attempts of a single storage operation.
 * `runAttempt` builds a FRESH signed request each call and returns either a
 * success value or the raw `Response` for the driver to classify. Thrown errors
 * are classified: only recognized transient transport failures are retried.
 */
export async function fetchWithR2Retry<T>(params: {
  operation: R2RetryableOperation;
  bucket: string;
  key: string;
  seams: R2RetrySeams;
  runAttempt: (attemptNumber: number) => Promise<R2AttemptResult<T>>;
}): Promise<T> {
  const { operation, bucket, key, seams, runAttempt } = params;

  for (let attempt = 1; attempt <= R2_REQUEST_MAX_ATTEMPTS; attempt++) {
    let result: R2AttemptResult<T>;
    try {
      result = await runAttempt(attempt);
    } catch (err) {
      // Signing failures, explicit aborts, and deterministic local-fs errors are
      // never retried; only recognized transient transport failures are.
      if (!isRetryableTransportError(err)) throw err;
      if (attempt >= R2_REQUEST_MAX_ATTEMPTS) {
        throw new R2StorageError({ operation, bucket, key, attempts: attempt, cause: err });
      }
      await seams.sleep(computeR2DelayMs({ response: null, retryIndex: attempt - 1, seams }));
      continue;
    }

    if (result.kind === "success") return result.value;

    const response = result.response;
    const status = response.status;
    // Consume the failed body before the next attempt.
    const responseText = await safeReadBoundedBody(response);

    if (R2_RETRYABLE_STATUSES.has(status) && attempt < R2_REQUEST_MAX_ATTEMPTS) {
      await seams.sleep(computeR2DelayMs({ response, retryIndex: attempt - 1, seams }));
      continue;
    }

    // Non-retryable status, or a retryable status with attempts exhausted.
    throw new R2StorageError({ operation, bucket, key, attempts: attempt, status, responseText });
  }

  // Unreachable: the loop always returns or throws.
  throw new R2StorageError({ operation, bucket, key, attempts: R2_REQUEST_MAX_ATTEMPTS });
}
