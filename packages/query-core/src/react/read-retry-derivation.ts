export interface ReadRetrySource<TError = Error> {
  error: TError | null | undefined;
  isFetching: boolean;
  isLoading: boolean;
  isPaused?: boolean;
}

export interface ReadRetryState<TError = Error> {
  error: TError | null;
  isRetrying: boolean;
  isLoading: boolean;
}

export interface HeldFailure<TError> {
  error: TError;
}

/** A composite source builds a new error object every render, so a failure is compared by name, message, and `code`. */
function sameFailure(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) return false;
  const x = a as { name?: unknown; message?: unknown; code?: unknown };
  const y = b as { name?: unknown; message?: unknown; code?: unknown };
  return x.name === y.name && x.message === y.message && x.code === y.code;
}

export function nextHeldFailure<TError>(
  held: HeldFailure<TError> | undefined,
  source: ReadRetrySource<TError>,
): HeldFailure<TError> | undefined {
  const live = source.error ?? null;
  if (live !== null)
    return held !== undefined && sameFailure(held.error, live) ? held : { error: live };
  const running = source.isFetching || source.isPaused === true;
  return running ? held : undefined;
}

export function toRetryState<TError>(
  source: ReadRetrySource<TError>,
  held: HeldFailure<TError> | undefined,
): ReadRetryState<TError> {
  const error = source.error ?? held?.error ?? null;
  return {
    error,
    isRetrying: error !== null && (source.isFetching || source.isPaused === true),
    isLoading: error === null && source.isLoading,
  };
}
