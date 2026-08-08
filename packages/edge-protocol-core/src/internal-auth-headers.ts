// Internal-auth transport headers — the wire names that carry an
// `signInternalRequest` signature from the Cloud Functions tree that MINTS it to
// the Worker/DO tree that VERIFIES it. `internal-auth.ts` owns the signature
// SCHEME (what is covered by the MAC); this file owns the header names that
// scheme rides on. ONE definition, imported by both sides.
//
// Names only, deliberately — same posture as `provenance-headers.ts`: each side
// keeps its own trust logic (the minting side builds the request, the verifying
// side reads the headers into `verifyInternalRequest` and fails closed). What
// must never drift is the strings. A one-sided rename fails no build in either
// tree; it fails at runtime as `bad-version` / `bad-signature`, which reads as an
// outage rather than as the config break it is.
//
// Runtime-neutral: plain string constants, no dependency on any runtime's
// Headers implementation.
//
// ARCH-201 NAMED EXCEPTION — see the block at the top of `provenance-headers.ts`.
// Its scope statement covers every `x-ttt-*` wire name this package owns, these
// seven included; the rationale is not repeated here.
//
// TWO PROFILES exist because the two adopting endpoint families derive the
// signed `operationId` differently. They are deliberately NOT unified: the names
// are already deployed on both sides of two independent trust boundaries, so
// collapsing them would be a protocol break, not a refactor. This package stays
// domain-neutral, so the profiles are named for the mechanism (whether the
// operation id rides the wire), never for the consumer that uses them.

// ---------------------------------------------------------------------------
// Compact profile — signature, timestamp, version. The verifying side RECOMPUTES
// the signed `operationId` from the request body, so it is not a header.
// ---------------------------------------------------------------------------

/** base64url HMAC signature (`InternalSignature.signature`). */
export const INTERNAL_AUTH_SIGNATURE_HEADER = 'x-ttt-sig';
/** Signed timestamp in SECONDS, decimal (`InternalSignature.timestampSec`). */
export const INTERNAL_AUTH_TIMESTAMP_HEADER = 'x-ttt-sig-ts';
/** Signing-scheme version (`InternalSignature.version`, currently `v1`). */
export const INTERNAL_AUTH_VERSION_HEADER = 'x-ttt-sig-v';

// ---------------------------------------------------------------------------
// Operation-id profile — the signed `operationId` travels as its own header
// because the verifying side cannot derive it from the body. Its three signature
// headers use DIFFERENT names from the compact profile above; that divergence is
// what is deployed, so it is pinned here rather than smoothed over.
// ---------------------------------------------------------------------------

/** Deterministic per-operation id (idempotency key) bound into the MAC. */
export const INTERNAL_AUTH_OPERATION_ID_HEADER = 'x-ttt-operation';
/** Signed timestamp in SECONDS, decimal (`InternalSignature.timestampSec`). */
export const INTERNAL_AUTH_OPERATION_TIMESTAMP_HEADER = 'x-ttt-timestamp';
/** Signing-scheme version (`InternalSignature.version`, currently `v1`). */
export const INTERNAL_AUTH_OPERATION_VERSION_HEADER = 'x-ttt-sig-version';
/** base64url HMAC signature (`InternalSignature.signature`). */
export const INTERNAL_AUTH_OPERATION_SIGNATURE_HEADER = 'x-ttt-signature';
