import type { FileOrigin } from '../media/file-origin.js';

export const TEMP_UPLOAD_PREFIX = 'uploads/' as const;

export function buildTempUploadPath(fileOrigin: FileOrigin, userId: string, fileId: string): string {
  return `uploads/${fileOrigin}/${userId}/${fileId}`;
}

export function isTempUploadPath(path: string): boolean {
  const segments = path.split('/');
  return (
    segments.length === 4 &&
    segments[0] === 'uploads' &&
    !!segments[1] &&
    !!segments[2] &&
    !!segments[3]
  );
}

export function extractFileIdFromTempPath(path: string): string | null {
  const segments = path.split('/');
  if (
    segments.length !== 4 ||
    segments[0] !== 'uploads' ||
    !segments[1] ||
    !segments[2] ||
    !segments[3]
  ) {
    return null;
  }
  return segments[3];
}
