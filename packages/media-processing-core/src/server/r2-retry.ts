export const R2_REQUEST_MAX_ATTEMPTS = 3;
export const R2_RETRY_BASE_DELAY_MS = 250;
export const R2_RETRY_MAX_BACKOFF_MS = 5_000;
export const R2_RETRY_AFTER_CAP_MS = 30_000;

export const R2_RETRYABLE_STATUSES: ReadonlySet<number> = new Set([408, 429, 500, 502, 503, 504]);

export type R2RetryableOperation = 'putFile' | 'copy' | 'readToFile' | 'deleteCopy';

export type R2Operation = R2RetryableOperation | 'delete';

export interface R2RetrySeams {
  sleep: (ms: number) => Promise<void>;
  random: () => number;
  now: () => number;
}

export function defaultR2RetrySeams(): R2RetrySeams {
  return {
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    random: Math.random,
    now: Date.now,
  };
}

// undici/fetch surface these codes on the error or its `.cause`.
const RETRYABLE_NETWORK_ERROR_CODES: ReadonlySet<string> = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'ECONNABORTED',
  'ETIMEDOUT',
  'EPIPE',
  'ENOTFOUND',
  'EAI_AGAIN',
  'ENETUNREACH',
  'ENETDOWN',
  'EHOSTUNREACH',
  'EHOSTDOWN',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_BODY_TIMEOUT',
  'UND_ERR_SOCKET',
]);

const LOCAL_FS_ERROR_CODES: ReadonlySet<string> = new Set([
  'ENOSPC',
  'EACCES',
  'EISDIR',
  'ENOENT',
  'EROFS',
  'EMFILE',
  'ENFILE',
  'EBADF',
  'EEXIST',
  'EPERM',
  'ENAMETOOLONG',
  'ELOOP',
  'ENOTDIR',
  'EDQUOT',
]);

function codeOf(err: unknown): string | undefined {
  if (err && typeof err === 'object') {
    const c = (err as { code?: unknown }).code;
    if (typeof c === 'string') return c;
  }
  return undefined;
}

export function isRetryableTransportError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { name?: unknown; cause?: unknown };

  if (e.name === 'AbortError') return false;

  const selfCode = codeOf(err);
  const causeCode = codeOf(e.cause);

  if (selfCode && LOCAL_FS_ERROR_CODES.has(selfCode)) return false;
  if (causeCode && LOCAL_FS_ERROR_CODES.has(causeCode)) return false;

  if (selfCode && RETRYABLE_NETWORK_ERROR_CODES.has(selfCode)) return true;
  if (causeCode && RETRYABLE_NETWORK_ERROR_CODES.has(causeCode)) return true;

  // fetch()/undici surface transport failures as `TypeError: fetch failed`, often with no recognizable cause.
  if (err instanceof TypeError || e.name === 'TypeError') return true;

  return false;
}

export function parseRetryAfterMs(
  headerValue: string | null | undefined,
  nowMs: number,
): number | null {
  if (headerValue == null) return null;
  const trimmed = headerValue.trim();
  if (trimmed === '') return null;

  if (/^\d+$/.test(trimmed)) {
    const seconds = Number(trimmed);
    if (!Number.isFinite(seconds) || seconds < 0) return null;
    return seconds * 1000;
  }

  const dateMs = Date.parse(trimmed);
  if (Number.isNaN(dateMs)) return null;
  const delta = dateMs - nowMs;
  return delta > 0 ? delta : 0;
}

export function computeR2DelayMs(params: {
  response: Response | null;
  retryIndex: number;
  seams: R2RetrySeams;
}): number {
  const { response, retryIndex, seams } = params;

  if (response) {
    const retryAfterMs = parseRetryAfterMs(response.headers.get('retry-after'), seams.now());
    if (retryAfterMs !== null) {
      return Math.min(retryAfterMs, R2_RETRY_AFTER_CAP_MS);
    }
  }

  const ceiling = Math.min(R2_RETRY_MAX_BACKOFF_MS, R2_RETRY_BASE_DELAY_MS * 2 ** retryIndex);
  return Math.floor(seams.random() * ceiling);
}

export class R2StorageError extends Error {
  readonly operation: R2Operation;
  readonly bucket: string;
  readonly key: string;
  readonly attempts: number;
  readonly status?: number;
  readonly s3ErrorCode?: string;
  readonly responseText?: string;

  constructor(params: {
    operation: R2Operation;
    bucket: string;
    key: string;
    attempts: number;
    status?: number;
    responseText?: string;
    cause?: unknown;
  }) {
    const code = parseS3ErrorCode(params.responseText);
    const detail = [params.status !== undefined ? `status ${params.status}` : undefined, code]
      .filter(Boolean)
      .join(' ');
    super(
      `R2 ${params.operation} failed after ${params.attempts} attempt(s)${detail ? `: ${detail}` : ''}`,
      params.cause !== undefined ? { cause: params.cause } : undefined,
    );
    this.name = 'R2StorageError';
    this.operation = params.operation;
    this.bucket = params.bucket;
    this.key = params.key;
    this.attempts = params.attempts;
    this.status = params.status;
    this.s3ErrorCode = code;
    this.responseText = params.responseText;
  }
}

function parseS3ErrorCode(responseText: string | undefined): string | undefined {
  return responseText ? /<Code>([A-Za-z0-9]{1,64})<\/Code>/.exec(responseText)?.[1] : undefined;
}

export type R2AttemptResult<T> =
  { kind: 'success'; value: T } | { kind: 'response'; response: Response };

// A code-point filter, not a control-character regex, which `no-control-regex` forbids.
function sanitizeBodyText(text: string): string {
  let out = '';
  for (const ch of text.slice(0, 1000)) {
    const code = ch.codePointAt(0) ?? 0;
    out += code < 0x20 || code === 0x7f ? ' ' : ch;
  }
  return out.trim().slice(0, 500);
}

// Draining the body lets the socket be reused before the next attempt.
async function safeReadBoundedBody(res: Response): Promise<string> {
  try {
    return sanitizeBodyText(await res.text());
  } catch {
    return '<no body>';
  }
}

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
      if (!isRetryableTransportError(err)) throw err;
      if (attempt >= R2_REQUEST_MAX_ATTEMPTS) {
        throw new R2StorageError({ operation, bucket, key, attempts: attempt, cause: err });
      }
      await seams.sleep(computeR2DelayMs({ response: null, retryIndex: attempt - 1, seams }));
      continue;
    }

    if (result.kind === 'success') return result.value;

    const response = result.response;
    const status = response.status;
    const responseText = await safeReadBoundedBody(response);

    if (R2_RETRYABLE_STATUSES.has(status) && attempt < R2_REQUEST_MAX_ATTEMPTS) {
      await seams.sleep(computeR2DelayMs({ response, retryIndex: attempt - 1, seams }));
      continue;
    }

    throw new R2StorageError({ operation, bucket, key, attempts: attempt, status, responseText });
  }

  throw new R2StorageError({ operation, bucket, key, attempts: R2_REQUEST_MAX_ATTEMPTS });
}
