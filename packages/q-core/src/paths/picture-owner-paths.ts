// The document each kind of picture owner is (ARCH-104), split by what the picture core writes on
// it: a gallery owner holds a `pictures` summary, and a slot owner holds one picture in its slot
// field. A writer indexes the map for the owners it writes, so its target is only those documents;
// the full map, composed from both, serves the reads that take any owner.

import type { AwardDefinition } from '../doc-schemas/catalogs.js';
import type { GameLocation } from '../doc-schemas/game-location.js';
import type {
  GalleryOwnerKind,
  PictureOwnerKind,
  PictureSlotOwnerKind,
} from '../types/picture-owners.js';
import { SPECIAL_DOCS } from './collections.js';
import { PATH_BUILDERS } from './path-builders.js';

export const GALLERY_OWNER_PATHS = {
  sportLeague: { ownerDoc: (ownerId: string) => PATH_BUILDERS.sportLeague(ownerId) },
  leagueTeam: { ownerDoc: (ownerId: string) => PATH_BUILDERS.leagueTeam(ownerId) },
  // There is one landing page, and its owner id is its document id.
  landingPage: { ownerDoc: () => PATH_BUILDERS.landingPageConfig() },
} as const satisfies Record<GalleryOwnerKind, { ownerDoc: (ownerId: string) => [string, string] }>;

// Each slot field is a key of its own document's schema, so a renamed field fails to build here.
export const PICTURE_SLOT_OWNERS = {
  gameLocation: {
    ownerDoc: (ownerId: string) => PATH_BUILDERS.gameLocation(ownerId),
    slotField: 'pictureId' satisfies keyof GameLocation,
  },
  awardDefinition: {
    ownerDoc: (ownerId: string) => PATH_BUILDERS.awardDefinition(ownerId),
    slotField: 'badgePictureId' satisfies keyof AwardDefinition,
  },
} as const satisfies Record<
  PictureSlotOwnerKind,
  { ownerDoc: (ownerId: string) => [string, string]; slotField: string }
>;

export const PICTURE_OWNER_PATHS = {
  ...GALLERY_OWNER_PATHS,
  ...PICTURE_SLOT_OWNERS,
} as const satisfies Record<PictureOwnerKind, { ownerDoc: (ownerId: string) => [string, string] }>;

/**
 * Whether an owner id can name an owner of its kind. Every kind but the landing page takes any
 * document id; the landing page is the one document `SPECIAL_DOCS.LANDING_PAGE` names.
 */
export function isPictureOwnerId(kind: PictureOwnerKind, ownerId: string): boolean {
  if (ownerId.length === 0) return false;
  return kind !== 'landingPage' || ownerId === SPECIAL_DOCS.LANDING_PAGE;
}
