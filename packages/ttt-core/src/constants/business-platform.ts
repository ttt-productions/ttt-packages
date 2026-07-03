// Platform-infrastructure business-rule constants — short links, Firestore
// limits, and payment bounds.

// --- Short Links ---

/** The length of the generated ID for short links. */
export const SHORT_LINK_LENGTH = 6;

/** The maximum number of attempts to generate a unique short link ID before failing. */
export const SHORT_LINK_MAX_ATTEMPTS = 5;

/** Character set for short link IDs. Excludes ambiguous characters (0, O, l, 1, I). */
export const SHORT_LINK_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';

// --- Firestore Limits ---

/** Maximum operations in a single Firestore write batch. */
export const FIRESTORE_BATCH_LIMIT = 500;

// --- Payments ---

/**
 * Minimum pledgePayment amount accepted by the Stripe checkout flow, in cents
 * (USD). $2.50 is the platform's business floor (DJ, 2026-06-11) — above
 * Stripe's 50¢ technical card-charge floor. Promoted out of the Zod schema so
 * the webhook can re-assert it server-side against the Stripe-confirmed
 * amount, independent of the client input bound. Mode-invariant by design.
 */
export const MIN_PLEDGE_PAYMENT_AMOUNT_CENTS = 250;

/**
 * Maximum pledgePayment amount accepted by the Stripe checkout flow, in cents
 * (USD). $500,000.00. Well below Stripe's hard per-charge ceiling, but
 * high enough that legitimate large gifts pass without friction. Anything
 * above this is rejected by the schema before a Stripe session is created
 * or any rate-limit / audit-event side effects are incurred.
 */
export const MAX_PLEDGE_PAYMENT_AMOUNT_CENTS = 50_000_000;

/**
 * Eligibility window for a user-initiated pledge refund REQUEST: 60 days from the
 * pledge, in milliseconds. Cross-boundary — the UI shows/hides the "request refund"
 * button by comparing `Date.now() - pledge.createdAt` against this, and the
 * requestPledgeRefund callable re-enforces it server-side before creating the request.
 */
export const PLEDGE_REFUND_REQUEST_WINDOW_MS = 60 * 24 * 60 * 60 * 1000;
