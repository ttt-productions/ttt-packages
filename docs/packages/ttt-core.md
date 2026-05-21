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

## Boundary

`ttt-core` may depend on generic packages. Generic packages must not depend on `ttt-core`.

Generic admin/report shapes live in `report-core`. Pure chat schemas live in `chat-schemas`. Generic media shapes/factories live in `media-schemas`.
