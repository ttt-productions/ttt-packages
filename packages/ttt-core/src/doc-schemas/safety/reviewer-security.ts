// Trust & Safety — PER-USER privileged-reviewer security state (Appendix A §A11 [M-6] / [H-17]).
//
// This cluster owns the two BACKEND-ONLY, per-operator documents that back the WebAuthn passkey
// two-step reauth and the per-user reviewer-capability grants. They are the per-user COUNTERPART to
// the global `_config/privilegedReviewerSecurity` POLICY singleton (PrivilegedReviewerSecurityProfileV1
// in ./../ncii/config.ts — what "fresh reauth" MEANS): these hold, per operator, WHICH passkeys are
// enrolled, the in-flight ceremony challenge, the open reauth grant window, and which reviewer
// capabilities the operator actually holds. Distinct concepts, distinct docs — never merged with the
// policy singleton.
//
//   - `privilegedReviewerPasskeyProfiles/{uid}` = PrivilegedReviewerPasskeyProfileV1 — registered
//     WebAuthn credentials + pending ceremony challenge + the active reauth grant window.
//   - `privilegedReviewerCapabilityGrants/{uid}` = PrivilegedReviewerCapabilityGrantV1 — the set of
//     SafetyReviewerCapability the operator is granted (the per-user grantable form of the §A11 [M4]
//     reviewer-capability matrix, which until now existed only as the SafetyReviewerCapability enum).
//
// Collection choice mirrors the existing backend-only per-operator security pattern (the app's
// `operatorStepUp/{uid}` TOTP doc): a top-level collection keyed by uid, Cloud-Functions-only
// (firestore.rules deny all client read/write — wired app-side). Credentials are an INLINE array
// (an operator enrolls a handful of authenticators, never enough to overflow a doc) rather than a
// subcollection — matches the small-bounded-set inline modeling used elsewhere in this layer.
//
// SHARED enums come from ./foundation.js (the single source for every cross-cluster enum); the
// SafetyReviewerCapability matrix is IMPORTED, never redefined.

import { z } from 'zod';
import { SafetyReviewerCapabilitySchema } from './foundation.js';

// ===========================================================================
// §A11 [M-6] — WebAuthn credential + ceremony challenge (embedded shapes)
// ===========================================================================

/** WebAuthn authenticator transport hints (as reported by the client at registration). Advisory
 * only — the server never trusts them for authorization; used to steer the client `get()` UI. */
export const WebAuthnTransportSchema = z.enum(['usb', 'nfc', 'ble', 'internal', 'hybrid', 'smart-card']);
export type WebAuthnTransport = z.infer<typeof WebAuthnTransportSchema>;

/** In-flight WebAuthn ceremony kind — a registration (`navigator.credentials.create`) or an
 * authentication/assertion (`navigator.credentials.get`) challenge. */
export const PrivilegedReviewerChallengeTypeSchema = z.enum(['registration', 'authentication']);
export type PrivilegedReviewerChallengeType = z.infer<typeof PrivilegedReviewerChallengeTypeSchema>;

/** One registered WebAuthn passkey credential (standard WebAuthn credential record). `publicKey` is
 * the COSE-encoded public key (base64url); `signCount` is the authenticator signature counter used
 * for clone detection (a non-monotonic count on assertion is a signal). Never stores any private
 * key material — WebAuthn's private key never leaves the authenticator. */
export const PrivilegedReviewerPasskeyCredentialV1Schema = z.object({
  credentialId: z.string().min(1), // base64url WebAuthn credential id (the assertion lookup key)
  publicKey: z.string().min(1), // base64url COSE public key
  signCount: z.number(), // authenticator signature counter (clone-detection); may legitimately be 0
  transports: z.array(WebAuthnTransportSchema).optional(), // advisory client-reported transports
  aaguid: z.string().min(1).optional(), // authenticator model identifier (AAGUID)
  label: z.string().min(1), // operator-facing label ("YubiKey 5C", "MacBook Touch ID")
  createdAt: z.number(), // epoch ms; enrollment time
  lastUsedAt: z.number().optional(), // epoch ms; updated on each successful assertion
}).strict();
export type PrivilegedReviewerPasskeyCredentialV1 = z.infer<typeof PrivilegedReviewerPasskeyCredentialV1Schema>;

/** The single in-flight WebAuthn ceremony challenge for this operator (registration or assertion).
 * The raw challenge is server-generated random bytes (base64url); it is single-use and expires at
 * `expiresAt` — a stale/absent challenge fails the ceremony closed. Replaced on each new ceremony. */
export const PrivilegedReviewerReauthChallengeV1Schema = z.object({
  challenge: z.string().min(1), // base64url server-generated random challenge
  type: PrivilegedReviewerChallengeTypeSchema,
  createdAt: z.number(), // epoch ms; challenge issue time
  expiresAt: z.number(), // epoch ms; single-use TTL — a passed/absent challenge fails closed
}).strict();
export type PrivilegedReviewerReauthChallengeV1 = z.infer<typeof PrivilegedReviewerReauthChallengeV1Schema>;

// ===========================================================================
// §A11 [M-6] / [H-17] — privilegedReviewerPasskeyProfiles/{uid}
// = PrivilegedReviewerPasskeyProfileV1
// ===========================================================================

/** `privilegedReviewerPasskeyProfiles/{uid}` — per-operator WebAuthn passkey enrollment + the open
 * two-step reauth grant window. BACKEND-ONLY (Cloud-Functions-only; client read/write denied in
 * firestore.rules). The per-user counterpart to the `_config/privilegedReviewerSecurity` policy
 * singleton: the policy says what fresh reauth MEANS, this says what THIS operator has enrolled and
 * whether a grant is currently open.
 *
 * A successful passkey assertion opens the grant: `grantExpiresAt` is set to now + the policy's
 * `privilegedReauthTtlSeconds`, and `twoStepReauthCapabilities` records which reviewer capabilities
 * that grant covers. A privileged capability invocation is allowed only while `grantExpiresAt` is in
 * the future AND the capability is in `twoStepReauthCapabilities` AND the operator is granted it (see
 * PrivilegedReviewerCapabilityGrantV1). An empty `twoStepReauthCapabilities` + absent `grantExpiresAt`
 * = no open grant. */
export const PrivilegedReviewerPasskeyProfileV1Schema = z.object({
  schemaVersion: z.literal(1),
  uid: z.string().min(1), // the operator this profile belongs to (= doc id)
  // Enrolled WebAuthn credentials (inline; a handful per operator). Empty until first enrollment.
  credentials: z.array(PrivilegedReviewerPasskeyCredentialV1Schema),
  // The single in-flight registration/authentication ceremony challenge (absent between ceremonies).
  pendingChallenge: PrivilegedReviewerReauthChallengeV1Schema.optional(),
  // Active reauth grant window (epoch ms). Absent/past = no open grant → privileged actions re-prompt.
  grantExpiresAt: z.number().optional(),
  // Which reviewer capabilities the current open grant covers (empty when no grant is open).
  twoStepReauthCapabilities: z.array(SafetyReviewerCapabilitySchema),
  createdAt: z.number(), // epoch ms
  updatedAt: z.number(), // epoch ms
}).strict();
export type PrivilegedReviewerPasskeyProfileV1 = z.infer<typeof PrivilegedReviewerPasskeyProfileV1Schema>;

// ===========================================================================
// §A11 [M-6] / [M4] — privilegedReviewerCapabilityGrants/{uid}
// = PrivilegedReviewerCapabilityGrantV1
// ===========================================================================

/** `privilegedReviewerCapabilityGrants/{uid}` — the reviewer capabilities THIS operator is granted
 * (the per-user grantable form of the §A11 [M4] reviewer-capability matrix). BACKEND-ONLY. Every
 * privileged safety command checks the SPECIFIC required SafetyReviewerCapability against this doc
 * (in addition to a fresh passkey grant). One solo operator holds all capabilities at launch; the
 * grant is an explicit authorization record so authority is data, not a hard-coded `isAdmin`. */
export const PrivilegedReviewerCapabilityGrantV1Schema = z.object({
  schemaVersion: z.literal(1),
  uid: z.string().min(1), // the operator this grant belongs to (= doc id)
  grantedCapabilities: z.array(SafetyReviewerCapabilitySchema),
  grantedByUid: z.string().min(1).optional(), // the operator who last modified this grant (authority trail)
  createdAt: z.number(), // epoch ms
  updatedAt: z.number(), // epoch ms
}).strict();
export type PrivilegedReviewerCapabilityGrantV1 = z.infer<typeof PrivilegedReviewerCapabilityGrantV1Schema>;
