// The persisted receipt of a founder-notice acknowledgment: WHICH notice copy the person
// acknowledged (the immutable revision id) and WHEN (server time). Written server-side —
// never client-supplied — onto the private pledge evidence and the Hall threshold item.
// Built by `buildLegalReviewNoticeReceipt` (constants/legal-review-notice.ts), which returns
// null while the notice is off, so no receipt is recorded then.

import { z } from 'zod';

export const LegalReviewNoticeRevisionSchema = z.string().min(1);

export const LegalReviewNoticeReceiptSchema = z
  .object({
    revision: LegalReviewNoticeRevisionSchema,
    acknowledgedAt: z.number(),
  })
  .strict();
export type LegalReviewNoticeReceipt = z.infer<typeof LegalReviewNoticeReceiptSchema>;
