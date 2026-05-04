# @ttt-productions/chat-core

Full chat system with realtime messaging, infinite scroll history, file attachments, and a composable UI shell. The highest-dependency package in the monorepo — integrates ui-core, firebase-helpers, mobile-core, file-input, upload-core, media-viewer, media-contracts, and ttt-core.

## Version
0.4.12

## Dependencies
Runtime: @ttt-productions/ttt-core, @ttt-productions/ui-core, @ttt-productions/firebase-helpers, @ttt-productions/mobile-core, @ttt-productions/file-input, @ttt-productions/upload-core, @ttt-productions/media-viewer, @ttt-productions/media-contracts.
Peer: @tanstack/react-query, firebase, react, react-dom.

## Entry Points

- `@ttt-productions/chat-core` — server-safe main barrel. Use for constants and type-only imports.
- `@ttt-productions/chat-core/react` — React barrel. Use for hooks, components, providers, and context consumers.
- `@ttt-productions/chat-core/styles` — CSS side-effect import for app layouts.

`src/react/index.ts` starts with `"use client"`. `src/index.ts` does not.

## What It Contains

### Server-safe entry point (`index.ts`)
Re-exports only server-safe values and types:
- `MAX_CHAT_MESSAGE_LENGTH`
- `CHAT_ATTACHMENT_STALE_AGE_MS`
- `GROUP_GAP_SEC`
- `ChatAttachmentStatus`
- `ChatAttachment`
- `ChatId`
- `ChatThreadV1`
- `ChatMessageV1`
- `ChatAccessMode`
- `ChatCoreConfig`
- `ChatAttachmentConfig`
- `RegisterAttachmentInput`
- `RegisterAttachmentFn`
- `DismissFailedAttachmentFn`
- `ModerationHandlers`
- `MessageRenderer`
- `MessageRendererRegistry`
- `ChatNameResolver`
- `ChatPrewarmSenders`

`GROUP_GAP_SEC` is a runtime export from `types.ts`, so the main barrel uses explicit named re-exports instead of `export *` or `export type *`. This keeps React out of the server graph and preserves the runtime constant.

### React entry point (`react/index.ts`)
Re-exports all React-coupled chat surface:
- `ChatNameResolverProvider`, resolver hooks, and related context exports from `context/ChatNameResolverContext.tsx`
- `useChatMessages(options)` — Core chat hook implementing a newest-window realtime subscription plus infinite older pagination.
- `useChatThreadAccess(options)` — Access control check for chat threads.
- `ChatShell` — Main container component that orchestrates MessageList + Composer with mobile keyboard handling.
- `MessageList` — Scrollable message list with auto-scroll-to-bottom on new messages and scroll-up-to-load-more for history.
- `Composer` — Message input with attachment support.
- `MessageItemDefault` — Default message bubble renderer with media attachments.
- `menus.tsx` exports — Context menus for message actions.

### Types (`types.ts`)
Core chat data model and configuration types. Messages store a `text` field. `targetDocPath` wiring connects chat to its parent entity.

`ChatAttachmentConfig` takes `userId: string` instead of `pendingStoragePath`. chat-core internally builds the canonical `uploads/chat-attachment/{userId}/{pendingMediaDocId}` path, uploads to Storage, then calls the app-provided `registerAttachment` callback. The consumer should wire `registerAttachment` to a backend callable that creates both the chat message and pendingMedia doc atomically.

### Name Resolution (`context/ChatNameResolverContext.tsx`)
- `ChatNameResolverProvider` — App-provided synchronous sender-name resolver. Runtime import path: `@ttt-productions/chat-core/react`.
- `useResolvedSenderName(senderId)` — Resolves display names at render time, with `"User"` fallback. Runtime import path: `@ttt-productions/chat-core/react`.
- `ChatPrewarmSenders` — Optional prewarm callback so apps can fetch public identity docs for visible sender ids. Type-only import path: `@ttt-productions/chat-core`.

Chat documents store `senderId`/`replyTo.senderId`, not `senderUsername` snapshots. ttt-prod resolves names from `publicUsers`; other consumers provide their own resolver.

### Firestore Queries (`firestore/queries.ts`)
Internal Firestore query builders for chat message collections. They are used by React hooks and are not exported from the package entry points.

## Architecture: Newest Window + Infinite Older
The chat uses a split data-fetching strategy:
1. **Realtime window** — `onSnapshot` listener on the newest N messages. New messages appear instantly.
2. **Older messages** — TanStack Query infinite pagination. Loaded on scroll-up. Cached and deduplicated.
3. Messages are merged client-side with dedup by message ID.

This avoids the common pitfall of subscribing to the entire message history while still providing realtime updates for new messages.

## Key Design Decisions
- `ChatShell` handles the full mobile experience: virtual keyboard avoidance, safe areas, scroll management.
- `text` field on messages is the canonical content field — the send mutation writes `text`.
- `targetDocPath` connects each chat to its parent entity (project channel, admin thread, invite conversation).
- Attachment registration is delegated to the app-provided `registerAttachment` callback, normally backed by a callable. Attachment processing then goes through the consuming app's backend-side processor, not this package.
- Media attachments in messages use media-contracts types and are rendered by media-viewer components.
- UI components, hooks, providers, and resolver hooks are imported from `@ttt-productions/chat-core/react`; type-only imports and chat constants stay on `@ttt-productions/chat-core`.

## Files
```
src/
  index.ts, constants.ts, types.ts
  firestore/
    queries.ts
  react/
    index.ts
  context/
    ChatNameResolverContext.tsx
  hooks/
    useChatMessages.ts, useChatThreadAccess.ts
  ui/
    ChatShell.tsx, MessageList.tsx, Composer.tsx
    MessageItemDefault.tsx, menus.tsx
  styles/
    chat.css
```

## Upload Path Integration

Composer.tsx:
- Imports `type FileOrigin` from media-contracts and declares the local `FILE_ORIGIN` constant as that type — any future drift in the string literal fails at compile time.
- Calls `ensureFileWithContentType` from file-input before uploading, guaranteeing a valid MIME.
- Builds the storage path via `buildTempUploadPath(FILE_ORIGIN, attachmentConfig.userId, uuid)` from `@ttt-productions/ttt-core` — no extension, matches the Firestore rule equality check, and stays in sync with the canonical temp-upload path invariant.
- Uploads the file to Storage first, then calls `registerAttachment({ text, attachment })`. chat-core does **not** write `pendingMedia` directly.
