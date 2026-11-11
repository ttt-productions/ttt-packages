# @ttt-productions/app-config-core

Generic app config document: one live settings document that must exist and hold every setting
with a valid value.

- `.` — pure: `defineAppConfig({ path, schema })`, whose definition holds the strict `read`, the
  list of `settings`, and the `merge` that finds the settings an update really changes; and
  `AppConfigInvalidError`.
- `./server` — `writeAppConfig`, which writes only the changed settings on the caller's transaction.

The app supplies the document path and the schema of its settings.
