# @ttt-productions/chat-core

Reusable chat runtime and React UI package.

## Owns

- Chat shell, composer, message list, attachment UI, and realtime/infinite-scroll chat behavior
- Package-level chat defaults such as maximum message length
- Chat upload adapter integration through `upload-ui`
- Generic mention system: parser, provider registry, autocomplete UI, keyboard behavior, insertion, rendering, and optional recent-mentions adapter
- `./schemas` re-export for chat schemas from `chat-schemas`

## Boundary

`chat-core` does not import `ttt-core`, does not hardcode TTT origins, and does not build TTT storage paths. Consumers pass a chat upload adapter with opaque origin id, upload path builder, and optional metadata builder.

TTT mention kinds, permissions, provider lists, routing, and search live in TTT code. The package only owns the generic mention mechanism.

## Entry points

- `.` — server-safe constants/types and pure helpers
- `./react` — React chat UI and hooks
- `./schemas` — schema-only re-export from `chat-schemas`
- `./styles` — chat CSS
