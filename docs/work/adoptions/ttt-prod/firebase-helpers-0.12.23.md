# Adopt @ttt-productions/firebase-helpers 0.12.23

**What:** The App Check debug token is honoured only under the emulators, Analytics has an availability gate and an error seam, and the auth boot purge sentinel is shared.
**Severity:** medium
**Came from:** the ttt-packages shared-package session (Q-Sports scope, ttt-parity Foundations)

- **Package and version:** `@ttt-productions/firebase-helpers` 0.12.23.
- **Release:** `./scripts/release-multiple.sh firebase-helpers monitoring-core query-core patch`.
- **What changed:**
  - BEHAVIOR: `initFirebaseClient`'s `appCheck.debugToken` is honoured only with `useEmulators`; a deployed build attests through reCAPTCHA whatever it is passed.
  - BEHAVIOR: the Analytics handle never starts without a `measurementId` in the config, under the emulators, or with the new `analyticsEnabled: false`. A failed start or collection switch goes to the new `onAnalyticsError(error, 'enable' | 'collection')`, and to a console warning only when the app passes none.
  - New: `peekPersistedAuthUser()` on `./client` and `AuthBootPurgeSentinel({ loading, signedIn, onPurged, peek? })` on `./react` — ttt-prod's own sentinel, monitoring-agnostic: `onPurged({ persistedUid, failureClass })` is called once when a persisted session resolves signed out at the first resolution.
  - Design: ttt-packages `docs/packages/firebase-helpers.md` § The Firebase client setup.
- **What the app must change:**
  - Install.
  - `src/lib/firebase.ts`: pass `analyticsEnabled: process.env.NODE_ENV !== 'test'` and `onAnalyticsError: (error, action) => captureException(error, { tags: { area: 'analytics', action } })`.  - `src/app/ttt-auth-provider.tsx`: delete `peekPersistedAuthUser` and the local `AuthBootPurgeSentinel`; mount the package's with `loading` and `signedIn={user !== null}` from `useAuth()` and an `onPurged` that captures the same `captureMessage('firebase-auth: persisted session purged during boot init reload', 'warning', { persistedUid: persistedUid ?? 'unknown', failureClass: failureClass ?? 'unobserved' })`. `src/__tests__/components/auth-boot-purge-sentinel.test.tsx` keeps only the wiring (the capture it makes); the package tests the rest.
- **Done when:** The lockfiles name `@ttt-productions/firebase-helpers` 0.12.23 or later, ttt-prod holds no copy of the sentinel or the IndexedDB peek, Analytics failures reach monitoring, and the gate is green.
