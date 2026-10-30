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
  landingPage: { ownerDoc: () => PATH_BUILDERS.landingPageConfig() },
} as const satisfies Record<GalleryOwnerKind, { ownerDoc: (ownerId: string) => [string, string] }>;

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

export function isPictureOwnerId(kind: PictureOwnerKind, ownerId: string): boolean {
  if (ownerId.length === 0) return false;
  return kind !== 'landingPage' || ownerId === SPECIAL_DOCS.LANDING_PAGE;
}
