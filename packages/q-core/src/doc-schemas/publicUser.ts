// `publicUsers/{uid}` — display identity for real users AND ghosts, resolved at read time by
// everything that shows a name (ARCH-103). `displayName_lowercase` powers prefix search.

import { z } from 'zod';
import { epochMsSchema } from './atoms.js';

export const PublicUserSchema = z.object({
  uid: z.string(),
  displayName: z.string(),
  displayName_lowercase: z.string(),
  // True for a `ghost_*` placeholder player; derived from the id, stored for query filters.
  isGhost: z.boolean(),
  // True while the account is banned; always false for a ghost.
  disabled: z.boolean(),
  // Award ids the user chose to show beside their name.
  selectedBadges: z.object({
    primary: z.string().optional(),
    secondary: z.string().optional(),
  }),
  updatedAt: epochMsSchema,
});
export type PublicUser = z.infer<typeof PublicUserSchema>;
