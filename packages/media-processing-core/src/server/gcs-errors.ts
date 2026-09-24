import { R2StorageError } from "./r2-retry.js";

/**
 * True when a storage read or delete failed because the object does not exist, from
 * either backend this package's stores use, decided from structured fields only — never
 * from message text, which a library may rewrite and which carries no contract. The R2
 * store's `R2StorageError` answers with status `404` and S3 error code `NoSuchKey`, which
 * tells a missing key from a missing bucket (`NoSuchBucket`); the Cloud Storage Admin SDK
 * answers with the numeric HTTP code `404`.
 */
export function isObjectNotFoundError(e: unknown): boolean {
  if (e instanceof R2StorageError) return e.status === 404 && e.s3ErrorCode === "NoSuchKey";
  return (e as { code?: unknown } | null | undefined)?.code === 404;
}
