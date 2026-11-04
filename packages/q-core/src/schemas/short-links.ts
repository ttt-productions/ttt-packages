import { z } from 'zod';
import { shortLinkIdSchema } from '@ttt-productions/short-link-core';
import { teamIdSchema, userIdSchema } from '../doc-schemas/atoms.js';

export const CreateShortLinkInputSchema = z.discriminatedUnion('targetType', [
  z
    .object({
      targetType: z.literal('ghostPlayerInvite'),
      teamId: teamIdSchema,
      ghostUserId: userIdSchema,
    })
    .strict(),
]);
export type CreateShortLinkInput = z.infer<typeof CreateShortLinkInputSchema>;

export const CreateShortLinkResultSchema = z.object({ shortId: shortLinkIdSchema }).strict();
export type CreateShortLinkResult = z.infer<typeof CreateShortLinkResultSchema>;

export const UpdateShortLinkClickInputSchema = z.object({ shortId: shortLinkIdSchema }).strict();
export type UpdateShortLinkClickInput = z.infer<typeof UpdateShortLinkClickInputSchema>;

export const UpdateShortLinkClickResultSchema = z
  .object({ destinationUrl: z.string().min(1) })
  .strict();
export type UpdateShortLinkClickResult = z.infer<typeof UpdateShortLinkClickResultSchema>;
