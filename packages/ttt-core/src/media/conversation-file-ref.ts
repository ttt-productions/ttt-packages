import { z } from 'zod';
import { guildInviteIdSchema, adminDispatchIdSchema } from '../schemas/atoms.js';

export const ConversationFileRefSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('guildInvite'),
      guildInviteId: guildInviteIdSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal('adminSupport'),
      adminDispatchId: adminDispatchIdSchema,
    })
    .strict(),
]);
export type ConversationFileRef = z.infer<typeof ConversationFileRefSchema>;

export const CONVERSATION_FILE_SCOPE_KINDS = ['guildInvite', 'adminSupport'] as const;
export type ConversationFileScopeKind = ConversationFileRef['kind'];
