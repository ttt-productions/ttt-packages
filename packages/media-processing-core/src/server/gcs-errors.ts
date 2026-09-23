/**
 * True when a storage read or delete failed because the object does not exist, from
 * either backend this package's stores use. The Cloud Storage Admin SDK reports it as a
 * numeric or string `404` code, or only in the message ("No such object"); the R2 store
 * throws an `R2StorageError` whose message carries the S3 `NoSuchKey` error code. Any
 * other failure — an R2 `NoSuchBucket` included — is not an object-not-found.
 */
export function isObjectNotFoundError(e: unknown): boolean {
  const err = e as { code?: unknown; message?: unknown } | null | undefined;
  return err?.code === 404 || err?.code === "404" || /No such object|NoSuchKey/i.test(String(err?.message));
}
