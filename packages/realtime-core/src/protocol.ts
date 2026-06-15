/**
 * Realtime wire protocol version + stable error codes (GENERIC).
 *
 * The protocol VERSION and the structured-error envelope are reused from
 * `@ttt-productions/edge-protocol-core` so the realtime layer and the internal
 * signed-call layer share one source of truth. This module adds the realtime
 * transport's stable, app-neutral error codes.
 */

export {
  EDGE_PROTOCOL_VERSION as REALTIME_PROTOCOL_VERSION,
  ProtocolVersionSchema,
  isProtocolSupported,
  StructuredErrorSchema,
} from '@ttt-productions/edge-protocol-core';
export type { StructuredError } from '@ttt-productions/edge-protocol-core';

/**
 * Stable realtime wire error codes — app-neutral. Apps map these to behavior
 * (e.g. resync, re-auth, surface a degraded indicator); the realtime layer
 * never invents domain-specific codes.
 */
export const REALTIME_ERROR_CODES = {
  /** Subprotocol/grant auth failed before accept. */
  UNAUTHORIZED: 'realtime/unauthorized',
  /** Origin not on the allowlist. */
  ORIGIN_NOT_ALLOWED: 'realtime/origin-not-allowed',
  /** The grant expired mid-session (≤ grant TTL hard bound). */
  GRANT_EXPIRED: 'realtime/grant-expired',
  /** Client protocol version outside the supported rolling window. */
  PROTOCOL_UNSUPPORTED: 'realtime/protocol-unsupported',
  /** Flood / slow-mode bucket exhausted. */
  RATE_LIMITED: 'realtime/rate-limited',
  /** Completion-first-tolerant: a flip/command arrived before its target exists; retry. */
  NOT_FOUND_YET: 'realtime/not-found-yet',
  /** A versioned apply hit a same-version different-hash conflict. */
  CONFLICT: 'realtime/conflict',
  /** Unexpected server-side failure. */
  INTERNAL: 'realtime/internal',
} as const;

export type RealtimeErrorCode = (typeof REALTIME_ERROR_CODES)[keyof typeof REALTIME_ERROR_CODES];
