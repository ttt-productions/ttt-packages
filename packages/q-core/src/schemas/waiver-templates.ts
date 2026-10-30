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
    version: waiverTemplateVersionNumberSchema,
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
