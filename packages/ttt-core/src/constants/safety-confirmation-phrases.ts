// Trust & Safety typed-confirmation phrases — the interim explicit typed-confirmation
// attestations that gate the highest-risk operator/admin safety callables (standing in
// for the passkey two-step until [H-17]).
//
// ARCH-102: each phrase is ONE named declaration here, and every enforcement point DERIVES
// from it — the ttt-core callable input schema (`z.literal(PHRASE)`), the frontend typed-
// confirmation gate, and the frontend mutation payload all import the same const. The
// operator must type the exact string, and the backend `z.literal` rejects anything else,
// so the two sides can never drift only if they read from the same declaration. A raw
// re-quote of any of these phrases at an enforcement point is drift by definition and is
// caught by the definition-redeclaration guard (this file is each phrase's owner there).
//
// Declared as plain string consts (NOT widened to `string`), so `z.literal(PHRASE)` keeps
// the exact-literal schema and `z.infer` narrows to the precise wire value.

/** `commandSafetyCaseActions` / close-out — the batched safety-case staged actions. */
export const SAFETY_ACTIONS_CONFIRMATION = 'I confirm these safety actions';

/** `reopenSafetyCase` — reopen a terminal child-safety / NCII case. */
export const SAFETY_CASE_REOPEN_CONFIRMATION = 'I confirm reopening this safety case';

/** `commandAccountAction` — apply a per-account safety action on a child-safety case. */
export const SAFETY_ACCOUNT_ACTION_CONFIRMATION = 'I confirm this account action';

/** `recordNcmecPortalReceiptArtifact` — register the NCMEC manual-portal receipt artifact. */
export const NCMEC_PORTAL_RECEIPT_CONFIRMATION = 'I confirm this is the NCMEC portal receipt';

/** `markNcmecPortalComplete` — mark the NCMEC manual-portal report filed. */
export const NCMEC_MANUAL_PORTAL_FILED_CONFIRMATION =
  'I confirm this NCMEC report was filed via the manual portal';

/** `revealCaseEvidence` — metadata→evidence reveal under reauth. */
export const REVEAL_CASE_EVIDENCE_CONFIRMATION = 'I confirm I am revealing case evidence under reauth';

/** `recordNcmecPortalCorrection` — record an NCMEC manual-portal correction filing. */
export const NCMEC_PORTAL_CORRECTION_CONFIRMATION = 'I confirm this NCMEC portal correction was filed';

/** `decideTakeItDownValidity` — the operator validity ruling on a TAKE IT DOWN request. */
export const TAKE_IT_DOWN_VALIDITY_CONFIRMATION = 'I confirm this TAKE IT DOWN validity decision';

/** `setReportDisposition` — the legal reporting disposition on a protected case. */
export const LEGAL_REPORTING_DISPOSITION_CONFIRMATION = 'I confirm this legal reporting disposition';
