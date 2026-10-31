# Adopt @ttt-productions/chat-react 0.13.23

**What:** The inbox client can reuse a still-valid grant across reconnects instead of minting one per connect.
**Severity:** low
**Came from:** the ttt-prod decided-work-items session (one combined package release)

- **Package and version:** `@ttt-productions/chat-react` 0.13.23.
- **Release:** `./scripts/release-multiple.sh ttt-core query-core chat-react media-viewer patch`.
- **What changed:** Additive. The inbox's grant provider (`InboxGrantProvider`, used by
  `createInboxClient` / `InboxClient`) may answer `{ token, expiresAt }` (epoch ms) instead of a bare
  token. The `InboxClient` then reuses the grant its last socket opened with while that socket
  opened, did not close `AUTH_EXPIRED` or `REVOKED`, and more than `INBOX_GRANT_REUSE_MARGIN_MS`
  is left before `expiresAt`; `close()` forgets it. A bare-token provider is called on every
  connect, as before. `GrantProvider` and the channel client are unchanged.
- **What the app must change:** Install. To stop minting an inbox grant on every reconnect, have the
  inbox grant provider return `{ token, expiresAt }` from its mint answer, keeping any per-connect
  work (a media-session refresh, a signed-in check) on every provider call. A bare-token provider
  needs no change.
- **Done when:** The lockfiles name `@ttt-productions/chat-react` 0.13.23 or later.
