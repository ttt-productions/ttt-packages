// Waiver templates: the wording an admin authors for a league's players to sign.
//
// The wording is versioned. Every save that changes it publishes a new version, and each published
// version is its own immutable document — so the exact wording in force when any signature was
// captured still exists however the template has changed since. A signature also keeps its own
// copy of what the signer saw (`SignedWaiverSchema`).

import { z } from 'zod';
import { documentIdSegmentSchema, epochMsSchema, userIdSchema } from './atoms.js';

export const waiverTemplateIdSchema = documentIdSegmentSchema;
export const waiverTemplateVersionNumberSchema = z.number().int().min(1);

// `waiverTemplates/{waiverTemplateId}` — the template as it reads now: its latest published
// version's wording and number.
export const WaiverTemplateSchema = z.object({
  title: z.string(),
  waiverText: z.string(),
  version: waiverTemplateVersionNumberSchema,
  createdAt: epochMsSchema,
  updatedAt: epochMsSchema,
  // Set when an admin deletes a template a signature or a closed league still names, or one with
  // more versions than a delete removes: it is kept for them and offered to no league again. A
  // template nothing names is deleted outright instead.
  retiredAt: epochMsSchema.optional(),
  // When a league last came to require the template. The league save that chooses it writes this in
  // its own transaction so a delete's read of this document conflicts with that save; it is its own
  // field so `updatedAt` keeps meaning the template itself changed.
  lastChosenAt: epochMsSchema.optional(),
});
export type WaiverTemplate = z.infer<typeof WaiverTemplateSchema>;

// `waiverTemplates/{waiverTemplateId}/waiverTemplateVersions/{versionId}` — one published version,
// created once and never changed.
export const WaiverTemplateVersionSchema = z.object({
  version: waiverTemplateVersionNumberSchema,
  title: z.string(),
  waiverText: z.string(),
  // Absent on a version whose author was never recorded.
  publishedByUserId: userIdSchema.optional(),
  publishedAt: epochMsSchema,
});
export type WaiverTemplateVersion = z.infer<typeof WaiverTemplateVersionSchema>;
