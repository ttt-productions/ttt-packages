// Firestore *client* SDK helpers. These import firebase/firestore at runtime
// (writeBatch, query/getDocs, Timestamp, serverTimestamp), so they live behind
// this subpath rather than on the pure root.
export * from './batch.js';
export * from './pagination.js';
export * from './timestamps.js'; // serverNow, dateToTs, msToTs, tsToDate
export * from './types.js';
export * from './date-formatting.js';
