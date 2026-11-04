import { z } from 'zod';
import { SHORT_LINK_ID_ALPHABET, SHORT_LINK_ID_LENGTH } from './short-link-id.js';

export const shortLinkIdSchema = z
  .string()
  .regex(new RegExp(`^[${SHORT_LINK_ID_ALPHABET}]{${SHORT_LINK_ID_LENGTH}}$`), 'Invalid link id');

export function createShortLinkSchema<Type extends z.ZodType, Metadata extends z.ZodType>(target: {
  type: Type;
  metadata: Metadata;
}) {
  return z.object({
    shortId: shortLinkIdSchema,
    destinationUrl: z.string().min(1),
    type: target.type,
    metadata: target.metadata,
    createdAt: z.number(),
    createdBy: z.string().min(1),
    clicks: z.number().int().nonnegative(),
  });
}

export type ShortLinkDocument<Type, Metadata> = {
  shortId: string;
  destinationUrl: string;
  type: Type;
  metadata: Metadata;
  createdAt: number;
  createdBy: string;
  clicks: number;
};

// A second leading slash makes a protocol-relative URL, which leaves the app.
export function isInAppDestination(destinationUrl: string): boolean {
  return destinationUrl.startsWith('/') && !destinationUrl.startsWith('//');
}
