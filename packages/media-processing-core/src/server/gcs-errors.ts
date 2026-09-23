/**
 * True when a Cloud Storage call failed because the object does not exist. The Admin
 * SDK reports it as a numeric or string `404` code, or only in the message.
 */
export function isObjectNotFoundError(e: unknown): boolean {
  const err = e as { code?: unknown; message?: unknown } | null | undefined;
  return err?.code === 404 || err?.code === "404" || /No such object/i.test(String(err?.message));
}
