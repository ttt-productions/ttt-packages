// Single source of truth for Firebase Storage download URL construction.
//
// Emulator awareness: when `FIREBASE_STORAGE_EMULATOR_HOST` is set (the
// Firebase Admin SDK auto-sets this when the Storage emulator is running),
// constructed URLs target the local emulator. Otherwise they target the
// production Firebase Storage CDN. This is critical for E2E tests — without
// it, browsers running against the emulator fetch production URLs and 404.
//
// Every download URL produced anywhere in the system MUST come from this
// function. Inline construction (`https://firebasestorage.googleapis.com/...`)
// is forbidden — it bypasses the emulator branch and breaks E2E tests.

export function buildFirebaseDownloadUrl(
  bucketName: string,
  storagePath: string,
  downloadToken: string
): string {
  const encodedPath = encodeURIComponent(storagePath);
  const emulatorHost = process.env.FIREBASE_STORAGE_EMULATOR_HOST;
  const baseUrl = emulatorHost
    ? `http://${emulatorHost}`
    : "https://firebasestorage.googleapis.com";
  return `${baseUrl}/v0/b/${bucketName}/o/${encodedPath}?alt=media&token=${downloadToken}`;
}
