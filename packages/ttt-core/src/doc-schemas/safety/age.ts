// Trust & Safety — age attestation, registration nonce, and account age-fields
// (Appendix A §A7 — "Age (full contract)" + the §A11 [H6] concrete AgePolicyConfigV1
// default block).
//
// This cluster owns:
//   - `ageAttestationNonces/{nonceHash}` (AgeAttestationNonceV1) — the one-time,
//     256-bit server-generated registration nonce. Only the SHA-256 of the nonce is
//     the doc id; the raw nonce appears only inside the signed token.
//   - The pinned `ageBracketAttestation` JWS payload-claims shape [M-09] — the DECODED
//     claims of the compact JWS (JWT, RFC 7519, alg=HS256) issued at /api/age/attest
//     and verified at /api/register/complete.
//   - The `__Secure-ttt_age_session` cookie spec [F13] (an exported const, NOT a doc).
//   - `AgePolicyConfigV1` (the `_config/agePolicy` singleton) + its pinned literal
//     default const (§A11 [H6]).
//   - The teen→adult `ageUpgradeAttestation` token shape.
//   - `UserPrivateDataAgeFieldsSchema` — the STANDALONE age-fields shape that the
//     orchestrator merges into `UserPrivateDataSchema` (privateData/{uid}). This file
//     does NOT edit user.ts.
//
// Every field/enum/optionality/bound is transcribed verbatim from the frozen Trust &
// Safety spec (Appendix A); the durable design owners are ttt-prod
// docs/design/age-gating-and-account-types.md and
// docs/design/age-data-handling-profile.md — no invented values, no placeholders.
//
// `RegistrationCompletionOutcome` is the DOMAIN outcome that feeds the orphan-Auth
// deletion policy; it is the SINGLE SOURCE in ./foundation.js and is IMPORTED here
// (never redefined).
//
// Timestamp convention: epoch-MILLISECONDS via z.number() — EXCEPT the JWS token
// claims `iat`/`exp`, which are epoch-SECONDS per JWT (RFC 7519); those are commented
// at the claim.

import { z } from 'zod';
import { RegistrationCompletionOutcomeSchema } from './foundation.js';

// ===========================================================================
// A7 — ageAttestationNonces/{nonceHash} (AgeAttestationNonceV1)
// One-time, 256-bit server-generated nonce. Only the nonce's SHA-256 is the doc id;
// the raw nonce appears only inside the signed token. 10-minute TTL; one successful
// consume, transactionally bound to the new Auth uid AND the requestSessionHash;
// expired/used/unknown fails closed. Spent records auto-delete ~24h after consume/expiry
// via a Firestore native-TTL policy on `ttlExpireAt` (F-018) — no scheduled reaper.
// ===========================================================================

/** Server-derived audience bracket — NEVER client-derived. */
export const AgeBracketSchema = z.enum(['teen', 'adult']);
export type AgeBracket = z.infer<typeof AgeBracketSchema>;

/** Nonce lifecycle status. `expired`/`consumed`/unknown all fail closed at consume. */
export const AgeAttestationNonceStatusSchema = z.enum(['issued', 'consumed', 'expired']);
export type AgeAttestationNonceStatus = z.infer<typeof AgeAttestationNonceStatusSchema>;

/** `ageAttestationNonces/{nonceHash}` — the registration attestation nonce record.
 * Doc id is the SHA-256 hex of the 256-bit server nonce (deterministic; the raw
 * nonce lives only in the signed token, never in Firestore). */
export const AgeAttestationNonceV1Schema = z.object({
  schemaVersion: z.literal(1),
  bracket: AgeBracketSchema, // SERVER-derived audience bracket
  policyVersion: z.string().min(1), // the agePolicyVersion in force when issued
  signingKeyVersion: z.string().min(1), // the versioned KMS/Secret-Manager key that signs the token (= JWS `kid`)
  requestSessionHash: z.string().min(1), // SHA-256 of the registering session/request marker — the binding (High-6 §D)
  issuedAt: z.number(), // epoch ms
  expiresAt: z.number(), // epoch ms; issuedAt + 10-min TTL
  consumedAt: z.number().optional(), // epoch ms; set on the one successful consume
  consumedByUid: z.string().min(1).optional(), // the new Auth uid this nonce was transactionally bound to
  status: AgeAttestationNonceStatusSchema,
  // [Q21.5 REVISED — DJ 2026-07-06] The nonce carries NO date of birth for ANY bracket.
  // Registration never persists a DOB (adult or teen — only the derived bracket survives);
  // the previous adult-bracket `dateOfBirth` carry field was removed. The ONLY place a DOB
  // is ever persisted is becomeArtisanCreator ('artisanOnboarding') — see
  // UserPrivateDataAgeFieldsSchema below. Raw DOBs remain no-log everywhere.
  // [F-018] Firestore NATIVE-TTL field. Set to a real Firestore `Timestamp` of (consume/expire time +
  // ~24h) at the moment the nonce becomes spent; a TTL policy on `ageAttestationNonces.ttlExpireAt`
  // then auto-deletes the spent single-use record (no scheduled reaper). DOCUMENTED EXCEPTION to this
  // file's epoch-ms-number convention: native TTL requires a real Timestamp, and this field is
  // WRITE-ONLY (never read by app code), so it is typed opaquely here (`z.unknown`) to avoid pulling a
  // firebase `Timestamp` type into the environment-agnostic ttt-core schema layer (the app writes it via
  // `admin.firestore.Timestamp.fromMillis`, mirroring notification-core's `expireAt`). Absent until spent.
  ttlExpireAt: z.unknown().optional(),
}).strict();
export type AgeAttestationNonceV1 = z.infer<typeof AgeAttestationNonceV1Schema>;

// ===========================================================================
// A7 [M-09] — ageBracketAttestation JWS payload claims (the ONE pinned wire format)
//
// The token is a COMPACT JWS (JWT, RFC 7519) with alg=HS256, signed by the versioned
// KMS/Secret-Manager key. The schema below validates the DECODED PAYLOAD CLAIMS only.
//
// JOSE header (NOT part of this schema — documented for the verifier):
//   { "alg": "HS256", "typ": "JWT", "kid": <signingKeyVersion> }   // kid = the exact signingKeyVersion
//
// Serialization: standard JWS compact form
//   base64url(header) '.' base64url(payload) '.' base64url(sig)
// the signature is base64url (no padding); claim names + types are EXACTLY as below
// (no extra claims).
//
// Verification REQUIRES (fail-closed on any miss): valid HS256 signature under the key
// named by `kid`; aud == "ttt-register-complete"; iss == "ttt-age-attest"; exp not
// passed; sub matches the ageAttestationNonces doc being consumed; rsh matches the
// request's requestSessionHash.
//
// `iat`/`exp` are epoch-SECONDS (per JWT), NOT epoch-millis like the rest of this file.
// ===========================================================================

export const AgeBracketAttestationClaimsV1Schema = z.object({
  iss: z.literal('ttt-age-attest'), // issuer
  aud: z.literal('ttt-register-complete'), // AUDIENCE/purpose binding — /api/register/complete MUST verify aud
  sub: z.string().min(1), // the SHA-256 nonce hash (also the ageAttestationNonces doc id)
  iat: z.number().int(), // epoch SECONDS (per JWT)
  exp: z.number().int(), // epoch SECONDS (per JWT); exp = iat + 600 (10-min TTL)
  bkt: AgeBracketSchema, // the SERVER-derived bracket (never client-derived)
  pv: z.string().min(1), // agePolicyVersion string
  rsh: z.string().min(1), // sha256(cookieValue) — the session binding
}).strict();
export type AgeBracketAttestationClaimsV1 = z.infer<typeof AgeBracketAttestationClaimsV1Schema>;

// ===========================================================================
// A7 [F13] — Age-session cookie spec (`__Secure-ttt_age_session`)
//
// Pinned cookie attributes. The cookie VALUE is a cryptographically-random value
// generated per registration attempt; only requestSessionHash = sha256(cookieValue)
// is stored (with the nonce) — the raw cookie value is NEVER persisted. A separate
// non-unique UX marker may exist for display, but is NEVER the security binding.
//
// `Domain` is omitted (host-only) — represented here by `hostOnly: true`.
// ===========================================================================

export const AGE_SESSION_COOKIE_SPEC = {
  name: '__Secure-ttt_age_session',
  hostOnly: true, // Domain attribute omitted → host-only cookie
  path: '/api',
  secure: true,
  httpOnly: true,
  sameSite: 'Strict',
  maxAgeSeconds: 600, // 10 min
} as const;

// ===========================================================================
// A7 / A11 [H6] — AgePolicyConfigV1 (the `_config/agePolicy` singleton)
//
// The generic gRPC retryable/terminal code lists are REMOVED — deletion is driven
// ONLY by the RegistrationCompletionOutcome domain enum (§A7). No raw gRPC code ever
// deletes an account. noDeleteOutcomes / terminalDeletableOutcomes are typed against
// the imported RegistrationCompletionOutcome enum so the two arrays can never drift
// from the domain outcome set.
// ===========================================================================

export const AgePolicyConfigV1Schema = z.object({
  agePolicyVersion: z.string().min(1),
  registrationGracePeriodMinutes: z.number().int(),
  cleanupSchedule: z.string().min(1), // cron expression for the orphan-Auth cleanup worker
  ageTokenTtlSeconds: z.number().int(), // [M-09] token TTL
  keyRetirementVerificationMinutes: z.number().int(), // [M-09] retired-signingKeyVersion verification window (> TTL so no live token is orphaned by a rotation)
  noDeleteOutcomes: z.array(RegistrationCompletionOutcomeSchema),
  terminalDeletableOutcomes: z.array(RegistrationCompletionOutcomeSchema),
}).strict();
export type AgePolicyConfigV1 = z.infer<typeof AgePolicyConfigV1Schema>;

/** The pinned literal default for `_config/agePolicy` (§A11 [H6] concrete config
 * values). Build defaults — transcribed verbatim from the frozen spec. */
export const DEFAULT_AGE_POLICY_CONFIG_V1: AgePolicyConfigV1 = {
  agePolicyVersion: '2026-06-19.general-audience.v1',
  registrationGracePeriodMinutes: 30,
  cleanupSchedule: '*/15 * * * *',
  ageTokenTtlSeconds: 600,
  keyRetirementVerificationMinutes: 15,
  noDeleteOutcomes: [
    'completed',
    'alreadyCompletedSameUid',
    'retryableInfrastructureFailure',
    'reauthenticationRequired',
    'appCheckRetryRequired',
    'privateDataConflict',
  ],
  terminalDeletableOutcomes: [
    'nonceExpired',
    'nonceUnknown',
    'nonceConsumedDifferentUid',
    'sessionHashMismatch',
    'attestationSignatureInvalid',
    'policyVersionRejected',
  ],
};

// ===========================================================================
// A7 — teen→adult ageUpgradeAttestation token
//
// A SEPARATE token (not the registration nonce) issued to an authenticated,
// recently-reauthenticated session. Binds uid + accountCapabilityVersion +
// policyVersion + issued/expiry + nonce; consumed ONLY for that uid+version; never
// the registration nonce, never cross-account.
//
// This is a token claims shape (decoded payload), NOT a stored Firestore doc.
// ===========================================================================

export const AgeUpgradeAttestationV1Schema = z.object({
  uid: z.string().min(1), // the authenticated, recently-reauthenticated account
  accountCapabilityVersion: z.number().int(), // the capability version this upgrade is bound to
  policyVersion: z.string().min(1), // agePolicyVersion in force
  issuedAt: z.number(), // epoch ms
  expiresAt: z.number(), // epoch ms
  nonce: z.string().min(1), // single-use upgrade nonce (never the registration nonce; never cross-account)
}).strict();
export type AgeUpgradeAttestationV1 = z.infer<typeof AgeUpgradeAttestationV1Schema>;

// ===========================================================================
// A7 — UserPrivateData age fields (STANDALONE shape for the orchestrator)
//
// These fields live on `privateData/{uid}` (server-write-only). They are exported as
// a STANDALONE object shape so the orchestrator can merge them into
// `UserPrivateDataSchema` in user.ts WITHOUT this file editing user.ts.
// ===========================================================================

/** Manual age-correction audit stub (who corrected, when, why) — embedded on the
 * private user data when a reviewer hand-corrects the recorded age state. */
export const UserPrivateDataAgeManualCorrectionSchema = z.object({
  at: z.number(), // epoch ms
  actorId: z.string().min(1),
  reason: z.string().min(1),
}).strict();
export type UserPrivateDataAgeManualCorrection = z.infer<typeof UserPrivateDataAgeManualCorrectionSchema>;

/** STANDALONE age-fields shape — the orchestrator merges these into
 * `UserPrivateDataSchema` (privateData/{uid}, server-write-only). Exported as a raw
 * object shape (NOT a z.object) so it can be spread into the canonical schema. */
export const UserPrivateDataAgeFieldsSchema = z.object({
  accountType: AgeBracketSchema, // 'teen' | 'adult'
  is18Plus: z.boolean(),
  agePolicyVersion: z.string().min(1),
  accountCapabilityVersion: z.number().int(),
  ageAttestedAt: z.number(), // epoch ms
  adultUpgradedAt: z.number().optional(), // epoch ms; set on a successful teen→adult upgrade
  ageManualCorrection: UserPrivateDataAgeManualCorrectionSchema.optional(),
  // [Q21.5 REVISED — DJ 2026-07-06, counsel review pending in the lawyer packet] The DOB is
  // persisted at EXACTLY ONE point: becomeArtisanCreator ('artisanOnboarding'). Registration
  // and the teen→adult upgrade derive the bracket server-side and persist NO DOB for anyone
  // (the register screen's "It is not stored" notice is literally true). Rationale: the
  // payout-KYC cross-check (compare to Stripe KYC DOB before paying out) only ever applies to
  // artisans — the money boundary — so collection happens there, with UI copy warning the
  // DOB must match the user's future payout identity. Server re-derives 18+ from the entered
  // DOB; an under-18 derivation rejects with a failure audit and stores nothing. PII —
  // privateData only (BACKEND-105); same no-log posture as the raw DOB (scrubber + canary).
  attestedDateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), // 'YYYY-MM-DD'
  attestedDobRecordedAt: z.number().optional(), // epoch ms
  attestedDobSource: z.enum(['artisanOnboarding']).optional(),
}).strict();
export type UserPrivateDataAgeFields = z.infer<typeof UserPrivateDataAgeFieldsSchema>;

/** The raw shape (for the orchestrator to `.extend(...)` / spread into
 * `UserPrivateDataSchema` without re-wrapping). */
export const userPrivateDataAgeFieldsShape = {
  accountType: AgeBracketSchema,
  is18Plus: z.boolean(),
  agePolicyVersion: z.string().min(1),
  accountCapabilityVersion: z.number().int(),
  ageAttestedAt: z.number(),
  adultUpgradedAt: z.number().optional(),
  ageManualCorrection: UserPrivateDataAgeManualCorrectionSchema.optional(),
  attestedDateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  attestedDobRecordedAt: z.number().optional(),
  attestedDobSource: z.enum(['artisanOnboarding']).optional(),
} as const;

// ===========================================================================
// A7 — Registration-completion RESULT (uses the IMPORTED domain enum)
//
// `completeRegistration.ts` returns exactly one RegistrationCompletionOutcome. The
// enum itself is the SINGLE SOURCE in ./foundation.js — re-exported here for cluster
// convenience, NEVER redefined.
// ===========================================================================

export { RegistrationCompletionOutcomeSchema } from './foundation.js';
export type { RegistrationCompletionOutcome } from './foundation.js';

/** The result envelope `completeRegistration.ts` returns. `outcome` is the imported
 * domain enum (never a raw gRPC code); only this domain outcome feeds the orphan-Auth
 * deletion policy. */
export const RegistrationCompletionResultV1Schema = z.object({
  outcome: RegistrationCompletionOutcomeSchema,
  uid: z.string().min(1).optional(), // present on 'completed' / 'alreadyCompletedSameUid'
}).strict();
export type RegistrationCompletionResultV1 = z.infer<typeof RegistrationCompletionResultV1Schema>;
