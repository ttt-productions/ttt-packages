// Why a picture's files are owed deletion (ARCH-102). A retirement is written in the same
// transaction that drops a picture's last reference, fails its upload, or deletes its owner.
//   removed       an admin removed it from its gallery or its slot
//   replaced      a newer upload took its slot
//   superseded    it finished after a newer upload already held the slot, so it never took it
//   uploadFailed  its upload failed, and whatever sizes were written go with it
//   ownerDeleted  its owner — a team, a location, an award — was deleted
export const PICTURE_RETIREMENT_REASON_KEYS = [
  'removed',
  'replaced',
  'superseded',
  'uploadFailed',
  'ownerDeleted',
] as const;
export type PictureRetirementReason = (typeof PICTURE_RETIREMENT_REASON_KEYS)[number];
