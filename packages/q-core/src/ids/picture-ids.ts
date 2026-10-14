// Upload and picture ids.
//
// A staging id is minted by the uploading client as a UUID (the migration console's picture carry
// mints name-based ones). It names the staged object, and for a picture it is also the upload row's
// id and the picture's id for as long as the picture exists. Only the lowercase form is accepted, so
// a path the server rebuilds from the id can be compared for exact equality.

import type { GalleryOwnerKind } from '../types/picture-owners.js';

const STAGING_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function isStagingId(value: string): boolean {
  return STAGING_ID_PATTERN.test(value);
}

const GALLERY_RETIREMENT_ID_PREFIX = 'gallery';

/**
 * The `pictureRetirements` id of a whole gallery, written when its owner is deleted. A single
 * picture's retirement is keyed by the picture id, which is a UUID and never starts with this
 * prefix, so the two families cannot collide.
 */
export function buildGalleryRetirementId(ownerKind: GalleryOwnerKind, ownerId: string): string {
  return `${GALLERY_RETIREMENT_ID_PREFIX}_${ownerKind}_${ownerId}`;
}
