import { z } from 'zod';
import { HARDWARE_CATALOG, HARDWARE_CATALOG_ITEM_IDS } from '../constants/business.js';
import { epochMsSchema, hardwareLoanContractIdSchema, userIdSchema } from '../doc-schemas/atoms.js';
import { stagingUploadPathSchema } from './uploads.js';

export const hardwareCatalogItemIdSchema = z.enum(HARDWARE_CATALOG_ITEM_IDS);

export const AdminCreateHardwareLoanContractInputSchema = z
  .object({
    refereeUserId: userIdSchema,
    hardwareItemIds: z.array(hardwareCatalogItemIdSchema).min(1).max(HARDWARE_CATALOG.length),
  })
  .strict()
  .refine((input) => new Set(input.hardwareItemIds).size === input.hardwareItemIds.length, {
    message: 'Name each item once.',
    path: ['hardwareItemIds'],
  });
export type AdminCreateHardwareLoanContractInput = z.infer<
  typeof AdminCreateHardwareLoanContractInputSchema
>;

export const AdminCreateHardwareLoanContractResultSchema = z
  .object({ contractId: hardwareLoanContractIdSchema })
  .strict();
export type AdminCreateHardwareLoanContractResult = z.infer<
  typeof AdminCreateHardwareLoanContractResultSchema
>;

export const SubmitHardwareLoanContractSignatureInputSchema = z
  .object({ contractId: hardwareLoanContractIdSchema, storagePath: stagingUploadPathSchema })
  .strict();
export type SubmitHardwareLoanContractSignatureInput = z.infer<
  typeof SubmitHardwareLoanContractSignatureInputSchema
>;

export const SubmitHardwareLoanContractSignatureResultSchema = z
  .object({
    contractId: hardwareLoanContractIdSchema,
    loanedAt: epochMsSchema,
    alreadySigned: z.boolean(),
  })
  .strict();
export type SubmitHardwareLoanContractSignatureResult = z.infer<
  typeof SubmitHardwareLoanContractSignatureResultSchema
>;

export const AdminReturnHardwareLoanContractInputSchema = z
  .object({ contractId: hardwareLoanContractIdSchema })
  .strict();
export type AdminReturnHardwareLoanContractInput = z.infer<
  typeof AdminReturnHardwareLoanContractInputSchema
>;

export const AdminReturnHardwareLoanContractResultSchema = z
  .object({
    contractId: hardwareLoanContractIdSchema,
    returnedAt: epochMsSchema,
    changed: z.boolean(),
  })
  .strict();
export type AdminReturnHardwareLoanContractResult = z.infer<
  typeof AdminReturnHardwareLoanContractResultSchema
>;

export const AdminDeleteHardwareLoanContractInputSchema = z
  .object({ contractId: hardwareLoanContractIdSchema })
  .strict();
export type AdminDeleteHardwareLoanContractInput = z.infer<
  typeof AdminDeleteHardwareLoanContractInputSchema
>;

export const AdminDeleteHardwareLoanContractResultSchema = z
  .object({ contractId: hardwareLoanContractIdSchema, deleted: z.boolean() })
  .strict();
export type AdminDeleteHardwareLoanContractResult = z.infer<
  typeof AdminDeleteHardwareLoanContractResultSchema
>;

export const GetHardwareLoanContractSignatureFileInputSchema = z
  .object({ contractId: hardwareLoanContractIdSchema })
  .strict();
export type GetHardwareLoanContractSignatureFileInput = z.infer<
  typeof GetHardwareLoanContractSignatureFileInputSchema
>;
