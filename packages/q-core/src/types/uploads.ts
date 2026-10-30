export const PICTURE_RETIREMENT_REASON_KEYS = [
  'removed',
  'replaced',
  'superseded',
  'uploadFailed',
  'ownerDeleted',
] as const;
export type PictureRetirementReason = (typeof PICTURE_RETIREMENT_REASON_KEYS)[number];
