# Post package-rework audit — 2026-05-21

## Verdict

The package architecture rework mostly landed. The implemented graph is cleaner than the pre-rework design and the new `chat-schemas` split is a good adjustment: it keeps chat validation server-safe without requiring `ttt-core` to import the React-heavy `chat-core` package.

## Confirmed good

- `media-contracts` was replaced by `media-schemas`.
- `upload-form` was replaced by `upload-ui`.
- `chat-schemas` was added as a pure schema package.
- `report-core` no longer imports `ttt-core` for generic report/admin task shapes.
- `chat-core` no longer imports `ttt-core`, no longer hardcodes TTT upload origins, and uses `upload-ui` for guarded uploads.
- `query-core` no longer exposes TTT/Q-Sports-branded query client/search preset names.
- Backend packages exist for rate limiting, audit writing, and moderation primitives.

## Follow-up code work found

These items were intentionally not changed in this docs-only patch:

1. Regenerate lockfiles. `ttt-packages/package-lock.json` still contains old workspace entries for `packages/media-contracts` and `packages/upload-form`; `ttt-prod/functions/package-lock.json` still contains registry entries that depend on `@ttt-productions/media-contracts`.
2. Update `ttt-prod/next.config.ts`; it still transpiles `@ttt-productions/media-contracts` and misses the new package names.
3. Update `ttt-prod/firestore.rules` comment that still points `FileOrigin` at `media-contracts`.
4. Adopt `query-core`'s domain-event invalidator mechanism inside `ttt-prod/src/lib/domain-events.ts` instead of maintaining duplicate invalidation helper code.
5. Make `ttt-prod/src/hooks/use-functions.tsx` delegate to `firebase-helpers/react` callable primitives.
6. Move or intentionally document `AuditEventType`; it still lives in `functions/src/audit/types.ts` even though the design says the TTT audit event catalog belongs in `ttt-core`.
7. Replace the duplicate `getFileNameFromUrl` implementation in `functions/src/shared/utils.ts` with the `firebase-helpers/server` export.
8. Finish migrating app-local generic shared components/helpers to package exports where the package implementation is equivalent.
9. Wire `chat-core` mention providers into app chat surfaces if the new generic mention system is expected to be live now.
10. Review unused package dependencies such as `upload-ui`'s `query-core` dependency and `upload-core`'s React peer dependency.
