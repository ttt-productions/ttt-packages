# @ttt-productions/media-schemas

Generic media schema and helper package. This replaces the old `media-contracts` package name.

## Owns

- Generic media data types such as upload phase/state, media kind/category, processing status, job status, and media error codes
- Generic helpers such as `getSimplifiedMediaType` and `ensureFileWithContentType`
- Neutral media-origin spec shape (`MediaOriginSpec`)
- Generic media constraints and processing spec types
- `createPendingMediaSchemas(...)` factory for composing app-specific pending-media schemas

## Boundary

`media-schemas` does not know TTT origins, TTT target-info schemas, TTT domain events, TTT atoms, or TTT media registry values. The concrete TTT pending-media schema is composed in `ttt-core` from this package's generic factory.

## Moved out

- `FileOrigin`
- `TTT_MEDIA_SPECS`
- `StartUploadRequestSchema` and response schema
- `parseTargetInfo` and target-info schemas
- `DomainEvent` variants and schema
- TTT atoms such as `ShortProject`, `Mention`, and `MentionType`
