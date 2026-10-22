import { R2StorageError } from './r2-retry.js';

export function isObjectNotFoundError(e: unknown): boolean {
  if (e instanceof R2StorageError) return e.status === 404 && e.s3ErrorCode === 'NoSuchKey';
  return (e as { code?: unknown } | null | undefined)?.code === 404;
}
