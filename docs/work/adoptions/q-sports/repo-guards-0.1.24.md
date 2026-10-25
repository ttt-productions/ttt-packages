# Adopt @ttt-productions/repo-guards 0.1.24

**What:** The `textFieldDeclarations` guard's `fieldSchema` fact loads an object with a `schemaOf` method, so the app's own reader fits with no cast.
**Severity:** low
**Came from:** the ttt-prod shared-standards Phase 3 repair session (fifth package release)

- **Package and version:** `@ttt-productions/repo-guards` 0.1.24.
- **Release:** `./scripts/release-multiple.sh auth-core dev-standards monitoring-core repo-guards ttt-core patch`.
- **What changed:** `TextFieldDeclarationFacts.fieldSchema` is a loader of `{ schemaOf(declaration): FieldSchema }` instead of a loader of the bare function. Declared as a method, `schemaOf` takes a reader typed on the app's own declaration type as it is.
- **What the app must change:** Install. If the app's guard config wires `textFieldDeclarations`, its `fieldSchema` loader returns `{ schemaOf: <the app-data package's field-schema reader> }`, and any cast on that reader is deleted.
- **Done when:** The lockfiles name 0.1.24 or later, the guard config holds no cast there, and the guard suite passes `textFieldDeclarations`.
