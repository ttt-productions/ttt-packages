# Adopt @ttt-productions/auth-core 1.6.18

**What:** Exports carry real types instead of `any`.
**Severity:** low
**Came from:** the ttt-packages shared-standards Phase 3 repair session (ttt-prod scope)

- **Package and version:** `@ttt-productions/auth-core` 1.6.18.
- **Release:** `./scripts/release-multiple.sh audit-core auth-core chat-react chat-schemas consent-core dev-standards edge-protocol-core file-input firebase-helpers media-processing-core media-schemas media-viewer mobile-core moderation-core monitoring-core notification-core query-core rate-limit-core realtime-core repo-guards report-core ttt-core ui-core upload-core upload-ui patch`.
- **What changed:**
  - `AuthContext` (`./react`) is `Context<AuthContextValue<unknown> | null>`, no longer `any`: code reading `useContext(AuthContext).claims` directly gets `unknown`; `useAuth<TClaims>()` is unchanged.
  - Internal typing and empty-catch cleanups; no behaviour change.
- **What the app must change:** Install. Narrow any direct `useContext(AuthContext)` read, or switch it to `useAuth<TClaims>()`.
- **Done when:** The lockfiles name `@ttt-productions/auth-core` 1.6.18 or later, and the gate is green.
