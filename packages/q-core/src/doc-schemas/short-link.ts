import { z } from 'zod';
import { createShortLinkSchema } from '@ttt-productions/short-link-core';
import { SHORT_LINK_TARGET_TYPE_KEYS } from '../types/unions.js';
import { teamIdSchema, userIdSchema } from './atoms.js';

export const ShortLinkTargetTypeSchema = z.enum(SHORT_LINK_TARGET_TYPE_KEYS);

export const ShortLinkMetadataSchema = z.object({
  teamId: teamIdSchema,
  ghostUserId: userIdSchema,
});
export type ShortLinkMetadata = z.infer<typeof ShortLinkMetadataSchema>;

export const ShortLinkSchema = createShortLinkSchema({
  type: ShortLinkTargetTypeSchema,
  metadata: ShortLinkMetadataSchema,
});
export type ShortLink = z.infer<typeof ShortLinkSchema>;
