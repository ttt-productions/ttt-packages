// Server-safe entry. React-only code lives at `@ttt-productions/upload-ui/react`.
// This file is intentionally empty; the package's public surface is exposed via
// the `./react` subpath. Keeping main empty preserves the server-safe contract
// (no React imports leak through `import x from '@ttt-productions/upload-ui'`).
export {};
