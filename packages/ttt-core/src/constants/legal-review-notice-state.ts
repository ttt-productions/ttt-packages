// ============================================================================
// FOUNDER LEGAL-REVIEW NOTICE — the switch. Code-controlled, exactly like APP_MODE:
// change the constant → publish ttt-core → install → deploy. It is NOT an Admin
// switch, and it is independent of APP_MODE and of any release's "require
// acceptance" choice — none of the three implies a value for another.
//
// Off: the notice renders nowhere and no notice acknowledgment is required.
// Receipts already recorded (registration, pledge, Hall submission) remain.
//
// The copy lives beside it in ./legal-review-notice.ts. The REVISION names that
// exact copy and is immutable: any wording change ships under a NEW revision id,
// so every recorded receipt keeps pointing at the words the person actually saw
// (the package test pins each revision's copy).
// ============================================================================

/** Whether the founder notice is shown and its acknowledgment required. */
export const LEGAL_REVIEW_NOTICE_ACTIVE: boolean = true;

/** Identifies the exact notice copy in force. Recorded with every acceptance and receipt. */
export const LEGAL_REVIEW_NOTICE_REVISION = 'founder-note-v1';
