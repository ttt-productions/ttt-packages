// Cloud Storage path builders. Storage paths are plain slash strings — no SDK takes segments.
//
// The staging path is the one path a client writes. Every other path is derived by the server:
// picture sizes by the picture processor, and signature files — legal artifacts kept under their
// subject's prefix, with no client grant at all — by the callable that records the signing.

import { isFileOrigin } from '../media/file-origins.js';
import type { FileOrigin } from '../media/file-origins.js';
import { isStagingId } from '../ids/picture-ids.js';
import type { PictureVariantKey } from '../types/unions.js';

export const USER_FILES_PREFIX = 'users/';
const SIGNED_WAIVERS_FOLDER = 'waiverSigs';
const HARDWARE_SIGNATURES_FOLDER = 'hardwareSigs';
const PICTURES_FOLDER = 'pictures';
const STAGING_FOLDER = 'uploads';

/** Everything a client uploads lands under this prefix, and nothing else does. */
export const STAGING_UPLOAD_PREFIX = `${STAGING_FOLDER}/`;

/** A real user's own waiver signature for one league. */
export function buildSignedWaiverPath(userId: string, leagueId: string, fileName: string): string {
  return `${USER_FILES_PREFIX}${userId}/${SIGNED_WAIVERS_FOLDER}/${leagueId}/${fileName}`;
}

/** A ghost player's waiver signature, captured by a witness for the ghost's team, `teamId`. */
export function buildGhostSignedWaiverPath(
  ghostUserId: string,
  leagueId: string,
  teamId: string,
  fileName: string,
): string {
  return `${USER_FILES_PREFIX}${ghostUserId}/${SIGNED_WAIVERS_FOLDER}/${leagueId}/${teamId}/${fileName}`;
}

/** A referee's signature on one hardware contract, named for its staging id like every kept signature. */
export function buildHardwareSignaturePath(
  userId: string,
  contractId: string,
  fileId: string,
): string {
  return `${USER_FILES_PREFIX}${userId}/${HARDWARE_SIGNATURES_FOLDER}/${contractId}/${fileId}`;
}

/** The folder holding every processed size of one picture. */
export function buildPictureObjectPrefix(pictureId: string): string {
  return `${PICTURES_FOLDER}/${pictureId}`;
}

/**
 * One processed size of a picture. Every picture kind shares this prefix, and the key carries no
 * extension: the object's own content type says what it is.
 */
export function buildPictureObjectPath(pictureId: string, variantKey: PictureVariantKey): string {
  return `${buildPictureObjectPrefix(pictureId)}/${variantKey}`;
}

/**
 * Where a client stages one upload: its origin, the uploader's own uid, and the id it minted. The
 * callable that accepts the upload rebuilds this from the AUTHENTICATED uid and refuses anything
 * not exactly equal (RULE-STD-MEDIA-002), so a client can only ever name its own staged object.
 */
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

/**
 * The parts of a staging path, or `null` for anything that is not one: another prefix, a wrong
 * segment count, an unknown origin, an empty uid, or a staging id that is not a lowercase UUID.
 */
export function parseStagingUploadPath(path: string): StagingUploadPathParts | null {
  const segments = path.split('/');
  if (segments.length !== 4) return null;
  const [folder, fileOrigin, userId, stagingId] = segments as [string, string, string, string];
  if (folder !== STAGING_FOLDER || !isFileOrigin(fileOrigin) || userId.length === 0) return null;
  if (!isStagingId(stagingId)) return null;
  return { fileOrigin, userId, stagingId };
}
