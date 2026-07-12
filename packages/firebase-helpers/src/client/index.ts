// Firebase *client* SDK runtime. Importing this subpath pulls
// firebase/app|auth|firestore|storage|functions, so it is intentionally kept
// off the pure root.
export * from "./firebase-init.js";
export * from "./call-callable.js";
