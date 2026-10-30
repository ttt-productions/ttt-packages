import { isFileOrigin } from '../media/file-origins.js';
import type { FileOrigin } from '../media/file-origins.js';
import { isStagingId } from '../ids/picture-ids.js';
import type { PictureVariantKey } from '../types/unions.js';

export const USER_FILES_PREFIX = 'users/';
const SIGNED_WAIVERS_FOLDER = 'waiverSigs';
const HARDWARE_SIGNATURES_FOLDER = 'hardwareSigs';
const PICTURES_FOLDER = 'pictures';
const STAGING_FOLDER = 'uploads';

export const STAGING_UPLOAD_PREFIX = `${STAGING_FOLDER}/`;

export function buildSignedWaiverPath(userId: string, leagueId: string, fileName: string): string {
  return `${USER_FILES_PREFIX}${userId}/${SIGNED_WAIVERS_FOLDER}/${leagueId}/${fileName}`;
}

export function buildGhostSignedWaiverPath(
  ghostUserId: string,
  leagueId: string,
  teamId: string,
  fileName: string,
): string {
  return `${USER_FILES_PREFIX}${ghostUserId}/${SIGNED_WAIVERS_FOLDER}/${leagueId}/${teamId}/${fileName}`;
}

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
  userId: string,
  stagingId: string,
): string {
  return `${STAGING_UPLOAD_PREFIX}${fileOrigin}/${userId}/${stagingId}`;
}

export interface StagingUploadPathParts {
  fileOrigin: FileOrigin;
  userId: string;
  stagingId: string;
}

export function parseStagingUploadPath(path: string): StagingUploadPathParts | null {
  const segments = path.split('/');
  if (segments.length !== 4) return null;
  const [folder, fileOrigin, userId, stagingId] = segments as [string, string, string, string];
  if (folder !== STAGING_FOLDER || !isFileOrigin(fileOrigin) || userId.length === 0) return null;
  if (!isStagingId(stagingId)) return null;
  return { fileOrigin, userId, stagingId };
}
