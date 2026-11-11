const GRPC_ALREADY_EXISTS = 6;

export function isAlreadyExistsError(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  return (
    code === GRPC_ALREADY_EXISTS ||
    code === 'already-exists' ||
    // RULE-STD-QUALITY-012: the SDK's error shape is an external answer, so the message form is matched too.
    (error instanceof Error && /already.?exists/i.test(error.message))
  );
}
