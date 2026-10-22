import { z } from 'zod';

export const PublicUserSchema = z.object({
  uid: z.string(),
  displayName: z.string(),
  displayName_lowercase: z.string(),
  profilePictureAssetId: z.string().nullable().optional(),
  artisanCreator: z.number().optional(),
  disabled: z.boolean(),
  anonymizedAt: z.number().optional(),
});
export type PublicUser = z.infer<typeof PublicUserSchema>;
