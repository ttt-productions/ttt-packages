# @ttt-productions/chat-core

Full chat system with realtime messaging, infinite scroll history, file attachments, and a composable UI shell. The highest-dependency package in the monorepo — integrates ui-core, firebase-helpers, mobile-core, file-input, upload-core, media-viewer, and media-contracts.

## Version
0.3.3

## Dependencies
Runtime: @ttt-productions/ui-core, @ttt-productions/firebase-helpers, @ttt-productions/mobile-core, @ttt-productions/file-input, @ttt-productions/upload-core, @ttt-productions/media-viewer, @ttt-productions/media-contracts.
Peer: @tanstack/react-query, firebase, react, react-dom.

## What It Contains

### Types (`types.ts`)
Core chat data model and configuration types. Messages store a `text` field. `targetDocPath` wiring connects chat to its parent entity.

### Firestore Queries (`firestore/queries.ts`)
Firestore query builders for chat message collections.

### Hooks
- `useChatMessages(options)` — Core chat hook implementing a "newest window + infinite older pagination" pattern: subscribes to realtime updates for the newest messages via `onSnapshot`, and uses TanStack Query infinite pagination for loading older messages on scroll-up.
- `useChatThreadAccess(options)` — Access control check for chat threads (determines if current user can read/write)

### UI Components
- `ChatShell` — Main container component that orchestrates MessageList + Composer with mobile keyboard handling (via mobile-core's KeyboardAvoidingView). Used in all 3 chat views in TTT Productions: channel chat, admin message threads, and project invite conversations.
- `MessageList` — Scrollable message list with auto-scroll-to-bottom on new messages and scroll-up-to-load-more for history
- `Composer` — Message input with attachment support (uses file-input for media selection, upload-core for uploads, media-contracts for validation)
- `MessageItemDefault` — Default message bubble renderer with media attachments (uses media-viewer for display)
- `menus.tsx` — Context menus for message actions (delete, etc.)

## Architecture: Newest Window + Infinite Older
The chat uses a split data-fetching strategy:
1. **Realtime window** — `onSnapshot` listener on the newest N messages. New messages appear instantly.
2. **Older messages** — TanStack Query infinite pagination. Loaded on scroll-up. Cached and deduplicated.
3. Messages are merged client-side with dedup by message ID.

This avoids the common pitfall of subscribing to the entire message history (expensive) while still providing realtime updates for new messages.

## Key Design Decisions
- `ChatShell` handles the full mobile experience: virtual keyboard avoidance, safe areas, scroll management.
- `text` field on messages is the canonical content field — the send mutation writes `text`.
- `targetDocPath` connects each chat to its parent entity (project channel, admin thread, invite conversation).
- Attachment processing goes through `processChatAttachment` Cloud Function (backend-side, not in this package).
- Media attachments in messages use media-contracts types and are rendered by media-viewer components.

## Files
```
src/
  index.ts, types.ts
  firestore/queries.ts
  hooks/
    useChatMessages.ts, useChatThreadAccess.ts
  ui/
    ChatShell.tsx, MessageList.tsx, Composer.tsx
    MessageItemDefault.tsx, menus.tsx
```
