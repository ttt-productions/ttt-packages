export const REALTIME_ERROR_CODES = {
  UNAUTHORIZED: 'realtime/unauthorized',
  ORIGIN_NOT_ALLOWED: 'realtime/origin-not-allowed',
  GRANT_EXPIRED: 'realtime/grant-expired',
  PROTOCOL_UNSUPPORTED: 'realtime/protocol-unsupported',
  RATE_LIMITED: 'realtime/rate-limited',
  NOT_FOUND_YET: 'realtime/not-found-yet',
  CONFLICT: 'realtime/conflict',
  INTERNAL: 'realtime/internal',
} as const;

export type RealtimeErrorCode = (typeof REALTIME_ERROR_CODES)[keyof typeof REALTIME_ERROR_CODES];
