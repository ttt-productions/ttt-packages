import { z } from 'zod';
import { mediaAssetIdSchema, pendingMediaIdSchema, userIdSchema } from '../schemas/atoms.js';
import { MAX_SYSTEM_UID_LIST } from '../constants/business-admin.js';
import {
  SystemAccountSlotIdSchema,
  SystemVideoSlotIdSchema,
  SystemUidListSlotIdSchema,
} from '../system-slots/system-slots.js';

export const SystemVideoSlotEntrySchema = z
  .object({
    assetId: mediaAssetIdSchema.nullable(),
    uploadPendingMediaId: pendingMediaIdSchema.nullable(),
    updatedAt: z.number(),
  })
  .strict();
export type SystemVideoSlotEntry = z.infer<typeof SystemVideoSlotEntrySchema>;

export const SystemVideoSlotsDocumentSchema = z
  .object({
    slots: z.partialRecord(SystemVideoSlotIdSchema, SystemVideoSlotEntrySchema),
    version: z.number().int().nonnegative(),
  })
  .strict();
export type SystemVideoSlotsDocument = z.infer<typeof SystemVideoSlotsDocumentSchema>;

export const EMPTY_SYSTEM_VIDEO_SLOTS_DOCUMENT: Readonly<SystemVideoSlotsDocument> = Object.freeze({
  slots: Object.freeze({}),
  version: 0,
});

export const SystemUidSlotsDocumentSchema = z
  .object({
    slots: z.partialRecord(
      SystemAccountSlotIdSchema,
      z.union([userIdSchema, z.array(userIdSchema).max(MAX_SYSTEM_UID_LIST)]),
    ),
    version: z.number().int().nonnegative(),
    lastUpdated: z.number(),
  })
  .strict()
  .superRefine((doc, ctx) => {
    for (const [slotId, value] of Object.entries(doc.slots)) {
      const holdsList = SystemUidListSlotIdSchema.safeParse(slotId).success;
      const shapeMatches = holdsList ? Array.isArray(value) : typeof value === 'string';
      if (!shapeMatches) {
        ctx.addIssue({
          code: 'custom',
          message: `Slot ${slotId} holds a value of the wrong shape for its kind.`,
          path: ['slots', slotId],
        });
      }
    }
  });
export type SystemUidSlotsDocument = z.infer<typeof SystemUidSlotsDocumentSchema>;
