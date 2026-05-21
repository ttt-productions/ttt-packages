# @ttt-productions/chat-schemas

Pure schema package for chat data that must be safe to import from UI, backend, and app-data packages.

## Owns

- `ChatAttachmentSchema`
- `ReplyToSchema`
- Inferred `ChatAttachment` and `ReplyTo` types

## Boundary

This package is intentionally tiny and has no internal `@ttt-productions/*` dependencies. It exists so `ttt-core` can compose TTT callable schemas without importing `chat-core`'s React/upload dependency graph.

## Does not own

- Chat UI
- Composer behavior
- Upload logic
- TTT-specific callable schemas
- TTT-specific mention providers
