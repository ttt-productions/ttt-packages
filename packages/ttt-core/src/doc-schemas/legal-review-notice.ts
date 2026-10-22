import { z } from 'zod';

export const LegalReviewNoticeRevisionSchema = z.string().min(1);

export const LegalReviewNoticeReceiptSchema = z
  .object({
    revision: LegalReviewNoticeRevisionSchema,
    acknowledgedAt: z.number(),
  })
  .strict();
export type LegalReviewNoticeReceipt = z.infer<typeof LegalReviewNoticeReceiptSchema>;
