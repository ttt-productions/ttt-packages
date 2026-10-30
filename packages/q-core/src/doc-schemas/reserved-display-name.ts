import { z } from 'zod';
import { epochMsSchema, userIdSchema } from './atoms.js';

export const ReservedDisplayNameSchema = z.object({
  userId: userIdSchema,
  displayName: z.string(),
  reservedAt: epochMsSchema,
});
export type ReservedDisplayName = z.infer<typeof ReservedDisplayNameSchema>;
