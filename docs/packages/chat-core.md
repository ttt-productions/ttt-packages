# @ttt-productions/chat-core

Pure chat contracts and logic package. **No React, no Firebase.**

## Owns

- Message/thread contract types that are not React-shaped (`ChatMessageV1`,
  `ChatThreadV1`, `ChatId`, `ChatAccessMode`, `ModerationHandlers`,
  `ChatNameResolver`, …). `ChatMessageV1` is TEXT-only — there is no attachment
  field or attachment-send contract; a conversation's files are owned by the
  consuming app's Conversation Files surface.
- Mention wire-format contracts (`MentionRef`, `ParsedSegment`,
  `MentionProvider`, `RecentMentionsAdapter`, `MentionAnchor`)
- The mention parser/serializer (`parseMentionTokens`, `formatMentionToken`)
- Message grouping helper (`isContinuation`) and package constants
  (`MAX_CHAT_MESSAGE_LENGTH`, `GROUP_GAP_SEC`)

## Boundary

`chat-core` depends only on [`@ttt-productions/chat-schemas`](./chat-schemas.md)
(for `ReplyTo`). It pulls in no React, Firebase, or UI
packages, so a Cloud Function, script, or future native/TV client can consume
the parser and contracts without dragging in the frontend tree.

`chat-core` does not import `ttt-core`. TTT mention kinds, permissions, provider
lists, routing, and search live in TTT code; the package only owns the generic
mention mechanism.

## Related packages

- The chat **React UI**, hooks, Firebase-client adapter config, and React render
  types live in [`@ttt-productions/chat-react`](./chat-react.md).
- Pure chat **schemas** are canonical in
  [`@ttt-productions/chat-schemas`](./chat-schemas.md).

## Entry points

- `.` — pure contracts, mention parser, grouping helpers, constants
