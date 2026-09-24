/**
 * Shape of the `_appConfig/app` Firestore doc.
 *
 * Single source of truth for app-wide runtime configuration. The doc is
 * subscribed to once by `AppConfigProvider` (in ttt-prod) and exposed to the
 * app via `useAppConfig()`.
 *
 * IMPORTANT: This doc is for runtime-mutable config only — things you might
 * want to change on a Saturday afternoon without a deploy. Compile-time
 * constants (field length limits, file size caps, pagination sizes, etc.)
 * belong in app-level constants, NOT here. Putting validation limits in
 * Firestore creates security risks (admin typos can't bypass client-side
 * guards) and doubles the surface area since server-side validation is still
 * required.
 *
 * The one exception to "operator-editable" is `publicDocumentVersions`: the
 * public-document version block, written only by the release publish, which
 * rides this doc so every session's existing live read sees a new release.
 */
// Shape is defined as a Zod schema in ../doc-schemas/system.ts; type inferred there.
export type { AppConfig } from '../doc-schemas/system.js';

// _systemData/reservedUsernames — curated reserved/impersonation usernames (UPPERCASE).
export type { ReservedUsernames } from '../doc-schemas/system.js';
