import { isFileOrigin } from '../media/file-origins.js';
import type { FileOrigin } from '../media/file-origins.js';
import { isStagingId } from '../ids/picture-ids.js';
import type { PictureVariantKey } from '../types/unions.js';

export const USER_FILES_PREFIX = 'users/';
const HARDWARE_SIGNATURES_FOLDER = 'hardwareSigs';
const PICTURES_FOLDER = 'pictures';
const STAGING_FOLDER = 'uploads';

export const STAGING_UPLOAD_PREFIX = `${STAGING_FOLDER}/`;

// Where V1 kept a hardware contract's signature; the migration console checks a carried contract's
// file against it.
export function buildHardwareSignaturePath(
  userId: string,
  contractId: string,
  fileId: string,
): string {
  return `${USER_FILES_PREFIX}${userId}/${HARDWARE_SIGNATURES_FOLDER}/${contractId}/${fileId}`;
}

export function buildPictureObjectPrefix(pictureId: string): string {
  return `${PICTURES_FOLDER}/${pictureId}`;
}

export function buildPictureObjectPath(pictureId: string, variantKey: PictureVariantKey): string {
  return `${buildPictureObjectPrefix(pictureId)}/${variantKey}`;
}

export function buildStagingUploadPath(
  fileOrigin: FileOrigin,
  owner: string,
  stagingId: string,
): string {
  return `${STAGING_UPLOAD_PREFIX}${fileOrigin}/${owner}/${stagingId}`;
}

export interface StagingUploadPathParts {
  fileOrigin: FileOrigin;
  owner: string;
  stagingId: string;
}

export function parseStagingUploadPath(path: string): StagingUploadPathParts | null {
  const segments = path.split('/');
  if (segments.length !== 4) return null;
  const [folder, fileOrigin, owner, stagingId] = segments as [string, string, string, string];
  if (folder !== STAGING_FOLDER || !isFileOrigin(fileOrigin) || owner.length === 0) return null;
  if (!isStagingId(stagingId)) return null;
  return { fileOrigin, owner, stagingId };
}
