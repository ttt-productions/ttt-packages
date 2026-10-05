// The two system-slot singletons, split by audience (BACKEND-108): the video slots in the
// signed-in `_systemData` bucket, the account slots in the public `_appConfig` bucket. A missing
// doc, or a slot missing from one, is an empty slot.

import { z } from 'zod';
import { mediaAssetIdSchema, pendingMediaIdSchema, userIdSchema } from '../schemas/atoms.js';
import { MAX_SYSTEM_UID_LIST } from '../constants/business-admin.js';
import {
  SystemAccountSlotIdSchema,
  SystemVideoSlotIdSchema,
  SystemUidListSlotIdSchema,
} from '../system-slots/system-slots.js';

/**
 * One video slot. `uploadPendingMediaId` names the slot's most recent upload; the slot takes no
 * other upload or clear while that upload is still pending or processing. A writer always stores
 * the whole entry.
 */
export const SystemVideoSlotEntrySchema = z
  .object({
    assetId: mediaAssetIdSchema.nullable(),
    uploadPendingMediaId: pendingMediaIdSchema.nullable(),
    updatedAt: z.number(),
  })
  .strict();
export type SystemVideoSlotEntry = z.infer<typeof SystemVideoSlotEntrySchema>;

/** `_systemData/systemVideoSlots`. `version` counts the doc's writes. */
export const SystemVideoSlotsDocumentSchema = z
  .object({
    slots: z.partialRecord(SystemVideoSlotIdSchema, SystemVideoSlotEntrySchema),
    version: z.number().int().nonnegative(),
  })
  .strict();
export type SystemVideoSlotsDocument = z.infer<typeof SystemVideoSlotsDocumentSchema>;

/** The doc a reader or writer starts from when `_systemData/systemVideoSlots` does not exist. */
export const EMPTY_SYSTEM_VIDEO_SLOTS_DOCUMENT: Readonly<SystemVideoSlotsDocument> = Object.freeze({
  slots: Object.freeze({}),
  version: 0,
});

/**
 * `_appConfig/systemUidSlots`: a `uid` slot holds one account id, a `uidList` slot an ordered list
 * of them. Each value's shape must match its slot's kind.
 */
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
