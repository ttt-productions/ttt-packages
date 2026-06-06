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
 * (USD). 50¢ is Stripe's hard floor for a card charge. Promoted out of the Zod
 * schema so the webhook can re-assert it server-side against the Stripe-confirmed
 * amount, independent of the client input bound.
 */
export const MIN_PLEDGE_PAYMENT_AMOUNT_CENTS = 50;

/**
 * Maximum pledgePayment amount accepted by the Stripe checkout flow, in cents
 * (USD). $500,000.00. Well below Stripe's hard per-charge ceiling, but
 * high enough that legitimate large gifts pass without friction. Anything
 * above this is rejected by the schema before a Stripe session is created
 * or any rate-limit / audit-event side effects are incurred.
 */
export const MAX_PLEDGE_PAYMENT_AMOUNT_CENTS = 50_000_000;
