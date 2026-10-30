import type { GalleryOwnerKind } from '../types/picture-owners.js';

const STAGING_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function isStagingId(value: string): boolean {
  return STAGING_ID_PATTERN.test(value);
}

const GALLERY_RETIREMENT_ID_PREFIX = 'gallery';

export function buildGalleryRetirementId(ownerKind: GalleryOwnerKind, ownerId: string): string {
  return `${GALLERY_RETIREMENT_ID_PREFIX}_${ownerKind}_${ownerId}`;
}
