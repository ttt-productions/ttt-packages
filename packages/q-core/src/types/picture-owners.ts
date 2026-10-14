// Which document owns a picture (ARCH-102). An upload's target, its indexes, and a picture's
// removal take the full union; a gallery picture document takes the gallery subset, because only
// those three owners hold a gallery — a location and an award hold one picture in a single slot.

export const PICTURE_OWNER_KIND_KEYS = [
  'sportLeague',
  'leagueTeam',
  'landingPage',
  'gameLocation',
  'awardDefinition',
] as const;
export type PictureOwnerKind = (typeof PICTURE_OWNER_KIND_KEYS)[number];

export const GALLERY_OWNER_KIND_KEYS = [
  'sportLeague',
  'leagueTeam',
  'landingPage',
] as const satisfies readonly PictureOwnerKind[];
export type GalleryOwnerKind = (typeof GALLERY_OWNER_KIND_KEYS)[number];
export type PictureSlotOwnerKind = Exclude<PictureOwnerKind, GalleryOwnerKind>;

// An award's badge slot, which the award catalog's own core fills.
export const AWARD_DEFINITION_OWNER_KIND = 'awardDefinition' as const satisfies PictureOwnerKind;

// A team's gallery, which the team's deletion retires whole.
export const LEAGUE_TEAM_GALLERY_OWNER_KIND = 'leagueTeam' as const satisfies GalleryOwnerKind;

/** Whether an owner holds a gallery, as opposed to a single picture slot. */
export function isGalleryOwnerKind(kind: PictureOwnerKind): kind is GalleryOwnerKind {
  return (GALLERY_OWNER_KIND_KEYS as readonly PictureOwnerKind[]).includes(kind);
}
