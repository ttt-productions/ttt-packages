// Callable contracts for waiver templates: create, save new wording, and delete. Admin only.

import { z } from 'zod';
import { textFieldSchema } from '../doc-schemas/atoms.js';
import {
  waiverTemplateIdSchema,
  waiverTemplateVersionNumberSchema,
} from '../doc-schemas/waiver-template.js';
import { WAIVER_TEMPLATE_DELETE_OUTCOME_KEYS } from '../types/unions.js';
import {
  WAIVER_TEMPLATE_TEXT_INPUT_FORMAT,
  WAIVER_TEMPLATE_TITLE_INPUT_FORMAT,
} from '../input-formats/input-formats.js';

export const waiverTemplateTitleSchema = textFieldSchema(WAIVER_TEMPLATE_TITLE_INPUT_FORMAT);
export const waiverTemplateTextSchema = textFieldSchema(WAIVER_TEMPLATE_TEXT_INPUT_FORMAT);

export const AdminCreateWaiverTemplateInputSchema = z
  .object({ title: waiverTemplateTitleSchema, waiverText: waiverTemplateTextSchema })
  .strict();
export type AdminCreateWaiverTemplateInput = z.infer<typeof AdminCreateWaiverTemplateInputSchema>;
export const AdminCreateWaiverTemplateResultSchema = z
  .object({ waiverTemplateId: waiverTemplateIdSchema, version: waiverTemplateVersionNumberSchema })
  .strict();
export type AdminCreateWaiverTemplateResult = z.infer<typeof AdminCreateWaiverTemplateResultSchema>;

// The template's whole wording as the admin wants it to read. Wording that differs from the current
// version publishes the next version; the same wording changes nothing. `expectedVersion` is the
// version the editor loaded: a save whose base is no longer current is refused, so a publication
// never brings back wording another admin has since replaced.
export const AdminUpdateWaiverTemplateInputSchema = z
  .object({
    waiverTemplateId: waiverTemplateIdSchema,
    expectedVersion: waiverTemplateVersionNumberSchema,
    title: waiverTemplateTitleSchema,
    waiverText: waiverTemplateTextSchema,
  })
  .strict();
export type AdminUpdateWaiverTemplateInput = z.infer<typeof AdminUpdateWaiverTemplateInputSchema>;
export const AdminUpdateWaiverTemplateResultSchema = z
  .object({
    waiverTemplateId: waiverTemplateIdSchema,
    // The template's current version after the save.
    version: waiverTemplateVersionNumberSchema,
    // False when the wording matched the current version and nothing was written.
    published: z.boolean(),
  })
  .strict();
export type AdminUpdateWaiverTemplateResult = z.infer<typeof AdminUpdateWaiverTemplateResultSchema>;

export const AdminDeleteWaiverTemplateInputSchema = z
  .object({ waiverTemplateId: waiverTemplateIdSchema })
  .strict();
export type AdminDeleteWaiverTemplateInput = z.infer<typeof AdminDeleteWaiverTemplateInputSchema>;
export const AdminDeleteWaiverTemplateResultSchema = z
  .object({
    waiverTemplateId: waiverTemplateIdSchema,
    outcome: z.enum(WAIVER_TEMPLATE_DELETE_OUTCOME_KEYS),
  })
  .strict();
export type AdminDeleteWaiverTemplateResult = z.infer<typeof AdminDeleteWaiverTemplateResultSchema>;
