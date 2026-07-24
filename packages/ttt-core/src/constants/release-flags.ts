// Charter-season release flags — one boolean per flip deliverable, default
// false. Flipped ONLY in code: change the constant → publish ttt-core →
// install (root + functions) → deploy IS the release, exactly like APP_MODE.
// Never a console toggle. Server-side gating in callables is
// `flag || caller is admin` so admins can live-test a hidden feature in prod
// before its release moment; UI hiding alone is never the gate.
//
// The admin Ready-for-Launch tab renders a READ-ONLY panel of these values,
// and the public phase page renders live/coming per deliverable from the same
// constants — the flags that gate the features ARE the display data source,
// so neither surface can drift. See ttt-prod docs/charter-season/README.md.

/** Theme Studio save & share (ttt-prod docs/charter-season/theme-sharing.md). */
export const THEME_SHARING_LIVE = false;

/** Bouquet stage 1 — buy, give, see (ttt-prod docs/charter-season/bouquet-staging.md). */
export const BOUQUET_STAGE_1_LIVE = false;

/** Bouquet stage 2 — artisan earnings views. */
export const BOUQUET_STAGE_2_LIVE = false;

/** Bouquet stage 3 — payouts (counsel-gated). */
export const BOUQUET_STAGE_3_LIVE = false;

/** Bouquet stage 4 — Garden + Greenhouse display surfaces. */
export const BOUQUET_STAGE_4_LIVE = false;

/** Bill the Understudy's flip upgrade (new lines / visual refresh). Display-only
 * flag — nothing server-side to gate; exists so the phase page stays honest. */
export const BILL_UPGRADE_LIVE = false;
