// `reservedDisplayNames/{reservedDisplayNameKey}` — one document per display name a real account
// holds. The document id is `toReservedDisplayNameKey(displayName)`, so taking a name is a
// transactional create at a known id rather than a query that can race. Registration and rename
// are its only writers; ghosts reserve nothing. No client access.

import { z } from 'zod';
import { epochMsSchema, userIdSchema } from './atoms.js';

export const ReservedDisplayNameSchema = z.object({
  userId: userIdSchema,
  // The name as the holder typed it; the key is its normalized form.
  displayName: z.string(),
  reservedAt: epochMsSchema,
});
export type ReservedDisplayName = z.infer<typeof ReservedDisplayNameSchema>;
