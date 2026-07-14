// Pure / universal root. Safe for backend (Admin SDK), browser, and React
// consumers alike — nothing here imports the Firebase *client* SDK at runtime.
//
// Client-SDK runtime lives behind subpaths:
//   - "@ttt-productions/firebase-helpers/client"          — Firebase app/auth/firestore/storage/functions init
//   - "@ttt-productions/firebase-helpers/firestore-client" — writeBatch/pagination + Timestamp/serverTimestamp helpers
//   - "@ttt-productions/firebase-helpers/server"           — Admin SDK helpers
//   - "@ttt-productions/firebase-helpers/react"            — React hook primitives

export * from "./firestore/types.js";
export * from "./firestore/paths.js";
export * from "./firestore/timestamps-universal.js"; // pure timestamp normalization (toMillis, toDate, now, formatDate, …)
export * from "./utils/chunk.js";
export * from "./utils/expected-callable-answers.js"; // the ONE expected-callable-answer code set (Sentry noise filter)
export * from "./firestore/date-formatting.js";
export * from "./utils/file-url.js";
