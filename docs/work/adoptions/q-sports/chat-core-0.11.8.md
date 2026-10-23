# Adopt @ttt-productions/chat-core 0.11.8

**What:** A failed sender-name read carries its own error.
**Severity:** medium
**Came from:** the ttt-packages shared-standards run

- **Package and version:** `@ttt-productions/chat-core` 0.11.8.
- **Release:** `./scripts/release-multiple.sh chat-core chat-react patch`.
- **What changed:** `ChatNameReadFailure` is `{ error, retry }`, and the `failed` member of `ChatNameResolution` is `{ status: 'failed' } & ChatNameReadFailure` — both now require the read's `error`.
- **What the app must change:** Install `@ttt-productions/chat-core@latest`. A name resolver passes each failed read's real error in its `failed` resolution and in a held name's `failure`, and the app's failure seats read it from there instead of passing no error.
- **Done when:** The lockfiles name `@ttt-productions/chat-core` 0.11.8 or later, every name failure seat receives the read's real error, and the gate is green.
