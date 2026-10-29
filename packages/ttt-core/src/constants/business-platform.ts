export const SHORT_LINK_LENGTH = 6;

export const MAX_SEARCH_QUERY_LENGTH = 100;

export const SHORT_LINK_MAX_ATTEMPTS = 5;

export const SHORT_LINK_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';

export const FIRESTORE_BATCH_LIMIT = 500;

export const FIRESTORE_DOCUMENT_ID_MAX_BYTES = 1500;

// A longer value is truncated in the index, so an equality query on it is not exact.
export const FIRESTORE_INDEXED_VALUE_MAX_BYTES = 1500;

export const NOTIFICATION_FANOUT_PRIORITIES = [0, 1, 2] as const;
export type NotificationFanoutPriority = (typeof NOTIFICATION_FANOUT_PRIORITIES)[number];

// Stripe's own card-charge floor is 50 cents.
export const MIN_PLEDGE_PAYMENT_AMOUNT_CENTS = 250;

// Stays below Stripe's per-charge ceiling.
export const MAX_PLEDGE_PAYMENT_AMOUNT_CENTS = 50_000_000;

export const PLEDGE_REFUND_REQUEST_WINDOW_MS = 60 * 24 * 60 * 60 * 1000;

export const MAX_STRIPE_CHECKOUT_SESSION_ID_LENGTH = 256;
