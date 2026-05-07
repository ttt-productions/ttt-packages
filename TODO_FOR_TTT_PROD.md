# TODO for ttt-prod (after Phase C ttt-core publish)

Add a note to `docs/design/architectural-preferences.md` (Section 2 or wherever subpaths are documented):

- `@ttt-productions/ttt-core/schemas/<domain>` now contains per-domain Zod schemas for all callable inputs (Phase C of the Zod validation sweep). The `<Name>InputSchema` and `<Name>Input` type for each callable wrapper live in the matching domain file. Wrappers import both from this subpath rather than defining schemas locally.

Also note: `ReplyToSchema` and `ChatAttachmentSchema` are parked in `ttt-core/src/schemas/chat.ts` temporarily. They will move to `@ttt-productions/chat-core` when chat-core grows a Zod surface. See the chat architecture review backlog.

This file gets deleted by the next ttt-prod prompt after the doc update lands.
