# Display Identity Invariant: uid-only references in cross-boundary types

For TTT Productions package contracts, display identity (display names, profile images, handles) is **not** denormalized into shared cross-boundary document shapes. Shared types reference users by uid only. Apps resolve display identity from their own identity source.

## Rule

Shared cross-boundary types — anything defined in `@ttt-productions/*` packages and consumed by both producer and consumer apps — store user references as one of:

- `{ uid: string }`
- `userId: string`
- `senderId: string`
- `createdBy: { uid: string }`
- schema-specific ownership references such as `ownedBy: { uid: string }` only where that domain still owns such a field

Display name, profile image URL, handle, and any other user-presentation fields are **NOT** included in the shared type.

Apps resolve display identity from their own identity source:
- ttt-prod uses backend-mirrored `publicUsers/{uid}` documents.
- Q-Sports uses its own user records.

This applies to: public content, chat messages, report payloads, admin-task queue entries, commission postings, audition listings, work documents, library entries.

## Why

- **One source of truth.** When a user changes their display name, exactly one document needs to update (`publicUsers/{uid}` in ttt-prod). Every consumer reading from that source automatically reflects the change.
- **No fan-out write storm.** Denormalizing display name into chat messages, report payloads, and work documents means a name change requires updating thousands of documents. We had this bug shape pre-launch and the fix is "don't store the name."
- **No drift between producer and consumer.** A snapshot stored at write time goes stale. A live read from the identity source is always current. Snapshots are acceptable only for audit/historical records where the point IS to capture the state at the time of action.
- **Cross-app reusability.** Q-Sports doesn't have `publicUsers/`. By keeping shared types uid-only, the same `chat-core` / `notification-core` / `report-core` packages work in both apps with each app providing its own resolver.

## Where it applies

- Every type defined in `@ttt-productions/*` that crosses the package/app boundary. If a type lives in a package and an app consumes it, the type follows this rule.
- Chat messages (`@ttt-productions/chat-core`): `senderId` only.
- Notifications (`@ttt-productions/notification-core`): `targetUserId` (recipient) and `latestActorIds` (a capped array of actor uids), never names.
- Reports (`@ttt-productions/report-core`): the reporter's identity comes from the authenticated caller, never a client-supplied field; `reportedUserId` is an optional, non-authoritative hint the server always re-derives — never display info.
- Admin task queue entries: uid references for actor and subject (`userId`, `adminUserId`).
- TTT-specific types in `@ttt-productions/ttt-core`: uid references. Work stewardship uses two aligned uid-only signals: the authoritative `StewardOwner` guild standing on a guildmate document (what report routing trusts), and a cached `workStewardUid` field on `PublicWorkProject` (what search filters, ownership checks, and UI attribution read) — never a work `ownedBy` field.
- Mentions (`@ttt-productions/ttt-core`'s `Mention` type, embedded in Square Streetz posts/comments): `{ type, id, placeholder }` with `text` always written empty; display surfaces resolve the current name by id at render time.

## What it forbids

- `senderName: string` on a chat message type.
- `reporterDisplayName: string` on a report payload.
- `createdBy: { uid: string; displayName: string }` — pick uid OR a denormalized snapshot, not both. Cross-boundary types pick uid.
- "Computed" fields that pre-fill display info "for performance." App-side resolvers with a cache (TanStack Query, Firestore client cache) are the performant path.
- Shared types that include profile image URLs. Profile image lookups go through the same uid-based resolver.

## What it allows

- **Audit/historical records** could keep a frozen display-name snapshot in principle — a record whose whole purpose is to preserve who-did-what at the time of action, even if names change later, would be a legitimate audit-only exception (and would NOT be a shared cross-boundary type). In practice, ttt-prod's `auditEvents` collection does not do this today: `TTTAuditActor` (`@ttt-productions/ttt-core`) is uid-only (`{ uid, isAdmin, actorMode, systemRole }`); display names are resolved at read time from `publicUsers` like everywhere else. See `docs/design/audit-events-and-actor-context.md` for the actor shape.
- **App-internal denormalization** where the app has decided to denormalize for its own reasons. ttt-prod's `publicUsers` mirror IS denormalization — but it's the resolver source, not the consumer. The rule is that shared types don't carry the denormalized data; apps can structure their own internal storage however they want.

## When to revisit

- If we ever build a third app on `@ttt-productions/*` packages and discover the resolver pattern is broken (high read costs, latency, etc.). At that point, the answer is probably to add a shared `IdentityResolver` interface to `auth-core`, not to denormalize names into shared types.
- If a future shared type genuinely needs a frozen snapshot for non-audit reasons. Bring it as a design discussion before adding the field.

## Checking compliance

When a new field on a shared type includes any user-presentation data (`displayName`, `displayImage`, `handle`, `profileImageUrl`, etc.), reject it. The reviewer should ask: "Why isn't this resolved from the app's identity source at read time?" If the answer is "performance," the answer is wrong — caching at the resolver layer solves performance without coupling shared types to display identity.
