export const CALLABLE_DEADLINE_EXCEEDED_CODE = 'functions/deadline-exceeded';

export function isCallableDeadlineError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  return (error as { code?: unknown }).code === CALLABLE_DEADLINE_EXCEEDED_CODE;
}
