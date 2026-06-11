// Thin canonical user-display + search projection at `publicUsers/{uid}`, mirrored
// from `userProfiles` by a Cloud Function trigger and written ONLY server-side.
// `displayName_lowercase` powers prefix search; `disabled` is derived from
// `FullUser.status` (!== 'active' -> true) and always written explicitly so user
// search has a stable equality filter. Type is inferred from this schema.

import { z } from 'zod';

export const PublicUserSchema = z.object({
  uid: z.string(),
  displayName: z.string(),
  displayName_lowercase: z.string(),
  // Mirror of FullUser.profilePictureAssetId (variants live in mediaAssets;
  // URLs built at render time).
  profilePictureAssetId: z.string().nullable().optional(),
  artisanCreator: z.number().optional(),
  disabled: z.boolean(),
});
export type PublicUser = z.infer<typeof PublicUserSchema>;
