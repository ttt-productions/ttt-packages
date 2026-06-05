/**
 * Shape of the `_config/app` Firestore doc.
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
 * In this initial implementation, only `appVersion` is read by code (by
 * VersionGate). The other fields are reserved — they're present in the doc
 * and type so future features have a home, but no UI wires them up yet.
 */
// Shape is defined as a Zod schema in ../doc-schemas/system.ts; type inferred there.
export type { AppConfig } from '../doc-schemas/system.js';
