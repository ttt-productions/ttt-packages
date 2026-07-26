// Conversation Files limits — the derived enforcement values for the flat,
// Firestore-owned file list on a guild-invite conversation or an admin-support
// dispatch thread. The mode-varied source of truth is `ACTIVE_LIMITS.conversation`
// (constants/app-mode.ts); every enforcement point (startUpload's quota
// reservation, the publication transfer, Firestore rules mirroring, and the
// Conversation Files panel's usage line) DERIVES from these — never a literal.

import { ACTIVE_LIMITS } from './app-mode.js';

/** Published active Conversation Files allowed in ONE conversation.
 *  Mode-varied: charter 10 / full 20 (DJ ruling 2026-07-25). */
export const MAX_CONVERSATION_FILES = ACTIVE_LIMITS.conversation.maxConversationFiles;

/** Published STORED-OUTPUT bytes allowed in ONE conversation.
 *  Mode-varied: charter 500 MiB / full 1 GiB (DJ ruling 2026-07-25). */
export const MAX_CONVERSATION_FILE_STORAGE_BYTES =
  ACTIVE_LIMITS.conversation.maxConversationFileStorageBytes;
