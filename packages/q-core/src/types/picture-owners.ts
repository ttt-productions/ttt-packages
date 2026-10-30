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

export const AWARD_DEFINITION_OWNER_KIND = 'awardDefinition' as const satisfies PictureOwnerKind;

export const LEAGUE_TEAM_GALLERY_OWNER_KIND = 'leagueTeam' as const satisfies GalleryOwnerKind;

export function isGalleryOwnerKind(kind: PictureOwnerKind): kind is GalleryOwnerKind {
  return (GALLERY_OWNER_KIND_KEYS as readonly PictureOwnerKind[]).includes(kind);
}
