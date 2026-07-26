// ============================================================================
// ConversationFileRef — the ONE declaration of which conversation a Conversation
// File belongs to. Owned here (ttt-core) and imported by the `conversation-file`
// upload target-info schema, the conversation-file path builders' callers, and
// every backend/frontend consumer.
//
// EXACTLY TWO supported scopes (DJ ruling 2026-07-25):
//   - guildInvite   — a 1:1 guild-invite conversation (guildInviteConversations/{id})
//   - adminSupport  — an admin dispatch thread (pendingAdminDispatches/{id}); covers
//                     BOTH user-to-admin and Work-to-admin correspondence.
//
// Guild chat CHANNELS are deliberately EXCLUDED: guildmates share files through the
// existing Work Files feature, so a second per-channel file surface would duplicate
// it. There is no `guildChannel` member here, and there never should be — the
// contract test asserts it is rejected.
//
// Structurally these two members mirror the `guildInvite` / `adminSupport` members
// of `MediaServingScope` (doc-schemas/media-assets.ts) because a Conversation File's
// serving scope IS its conversation. They stay separate declarations because they
// answer different questions (which conversation owns the file vs. which grant may
// serve its bytes) and MediaServingScope also covers non-conversation surfaces.
// ============================================================================

import { z } from 'zod';
import { guildInviteIdSchema, adminDispatchIdSchema } from '../schemas/atoms.js';

export const ConversationFileRefSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('guildInvite'),
    guildInviteId: guildInviteIdSchema,
  }).strict(),
  z.object({
    kind: z.literal('adminSupport'),
    adminDispatchId: adminDispatchIdSchema,
  }).strict(),
]);
export type ConversationFileRef = z.infer<typeof ConversationFileRefSchema>;

/** The supported conversation-scope kinds (for iteration / exhaustiveness tests). */
export const CONVERSATION_FILE_SCOPE_KINDS = ['guildInvite', 'adminSupport'] as const;
export type ConversationFileScopeKind = ConversationFileRef['kind'];
