# @ttt-productions/ttt-core

TTT Productions application-data package.

## Owns

- TTT-specific types, schemas, constants, paths, and business rules
- Concrete `FileOrigin` and `TTT_MEDIA_SPECS`
- Upload wire schemas, target-info schemas, and `parseTargetInfo`
- Concrete TTT pending-media schemas composed from `media-schemas`
- TTT domain-event union/schema/catalog
- TTT atoms such as `ShortProject`, `Mention`, and `MentionType`
- TTT moderation constants
- TTT upload-variable schemas
- TTT mention kinds/schemas/validation rules
- TTT admin task type union
- Project invite source schemas/types (`InviteSource`, `InviteSourceType`) for standalone, skill, job, and opportunity invite origins
- Project share-operation schemas/types, including the invite-only pending-share reservation contract
- Project role IDs, action IDs, action grants, and role-assignment policy
- Job application lifecycle schemas/types (`open`, `invited`, `accepted`, `rejected`)
- `AuditEventType` catalog, `TTTAuditActor`, `TTTAuditTarget`, and `TTTAuditEvent` specialization of the `@ttt-productions/audit-core` generic

## Boundary

`ttt-core` may depend on generic packages. Generic packages must not depend on `ttt-core`.

Generic admin/report shapes live in `report-core`. Pure chat schemas live in `chat-schemas`. Generic media shapes/factories live in `media-schemas`.


## Project invite and share-contract ownership

`ttt-core` owns the shared wire/data contracts for project invite creation and share operations. The app must consume these contracts instead of redefining local interfaces.

Current membership invariant:

- `InviteUserToProjectInputSchema` requires an `InviteSource` discriminated union.
- `PendingShares` is keyed by invite conversation ID and stores only reservation amount/timestamp.
- Share operations do not carry a pending-share `sourceType`; pending reservations are invite reservations.
- Job/opportunity source variants carry compact context plus the posting share floor. They do not carry old application/reply message or media payloads.
- Job application status is modeled as `open -> invited -> accepted` or `open -> rejected`; project membership still comes only from invite finalization.

When adding a new invite source or application lifecycle state, update the schema here first and then publish/consume it in `ttt-prod`. Do not add parallel frontend/backend interfaces in the app.


## Project role and action ownership

`ttt-core` owns the project-role contract consumed by both `ttt-prod` frontend code and Cloud Functions code. The durable source files are:

- `src/permissions/project-permissions.ts` — `PROJECT_ROLES`, `PROJECT_ACTIONS`, role/action type guards, and helpers.
- `src/permissions/role-assignment-policy.ts` — who may assign or remove each role.
- `src/schemas/project-management.ts` — role/profession update callable input schemas.

Consumers should not duplicate role option maps or action matrices locally. UI affordances may read the package catalog, but backend project-action checks remain authoritative in the consuming app.

The launch-era owner model is role-based: `Owner` is the first `ProjectRoleId`, appears in every `PROJECT_ACTIONS[action].grantedTo` list, and is stored on the consuming app's `allProjects/{projectId}/members/{uid}.roles` member document. `Owner` is still non-assignable through the normal role-management policy; project creation seeds it, and future owner-transfer/co-owner work must design a dedicated flow instead of bypassing `canAssignProjectRole`.
