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
export type AppConfig = {
  /**
   * Version string for force-refresh.
   * Bump manually in Firebase Console after a successful App Hosting deploy
   * to force all connected clients to hard-refresh onto the new build.
   */
  appVersion: string;

  /**
   * Emergency maintenance mode. When `true`, the app should display
   * `maintenanceMessage` and prevent writes. Read by a future
   * MaintenanceGate component (not yet implemented).
   */
  maintenanceMode: boolean;

  /**
   * Message shown to users when `maintenanceMode` is `true`.
   * Omitted when maintenance mode is off.
   */
  maintenanceMessage?: string;

  /**
   * Kill switch for new user signups. When `false`, the registration
   * page should display a "signups temporarily closed" message.
   * Read by a future check in the registration flow (not yet implemented).
   */
  registrationEnabled: boolean;
};
