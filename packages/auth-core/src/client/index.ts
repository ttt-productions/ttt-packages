// Firebase *client* auth runtime. Importing this subpath pulls firebase/auth
// at runtime (e.g. onAuthStateChanged), so it is intentionally kept off the
// pure root. The pure root exposes only contracts/config/errors.
export * from "./auth.js";
