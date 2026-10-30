import { z } from 'zod';
import { epochMsSchema } from './atoms.js';

export const PublicUserSchema = z.object({
  uid: z.string(),
  displayName: z.string(),
  displayName_lowercase: z.string(),
  isGhost: z.boolean(),
  disabled: z.boolean(),
  selectedBadges: z.object({
    primary: z.string().optional(),
    secondary: z.string().optional(),
  }),
  updatedAt: epochMsSchema,
});
export type PublicUser = z.infer<typeof PublicUserSchema>;
