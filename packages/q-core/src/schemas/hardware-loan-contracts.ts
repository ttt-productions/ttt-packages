import { z } from 'zod';
import { HARDWARE_CATALOG, HARDWARE_CATALOG_ITEM_IDS } from '../constants/business.js';
import { epochMsSchema, hardwareLoanContractIdSchema, userIdSchema } from '../doc-schemas/atoms.js';
import { stagingUploadPathSchema } from './uploads.js';

export const hardwareCatalogItemIdSchema = z.enum(HARDWARE_CATALOG_ITEM_IDS);

export const AdminCreateHardwareLoanContractInputSchema = z
  .object({
    refereeUserId: userIdSchema,
    hardwareItemIds: z.array(hardwareCatalogItemIdSchema).min(1).max(HARDWARE_CATALOG.length),
    requestId: z.uuid(),
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

export const UpdateHardwareLoanContractSignInputSchema = z
  .object({ contractId: hardwareLoanContractIdSchema, storagePath: stagingUploadPathSchema })
  .strict();
export type UpdateHardwareLoanContractSignInput = z.infer<
  typeof UpdateHardwareLoanContractSignInputSchema
>;

export const UpdateHardwareLoanContractSignResultSchema = z
  .object({
    contractId: hardwareLoanContractIdSchema,
    loanedAt: epochMsSchema,
    alreadySigned: z.boolean(),
  })
  .strict();
export type UpdateHardwareLoanContractSignResult = z.infer<
  typeof UpdateHardwareLoanContractSignResultSchema
>;

export const AdminUpdateHardwareLoanContractReturnInputSchema = z
  .object({ contractId: hardwareLoanContractIdSchema })
  .strict();
export type AdminUpdateHardwareLoanContractReturnInput = z.infer<
  typeof AdminUpdateHardwareLoanContractReturnInputSchema
>;

export const AdminUpdateHardwareLoanContractReturnResultSchema = z
  .object({
    contractId: hardwareLoanContractIdSchema,
    returnedAt: epochMsSchema,
    changed: z.boolean(),
  })
  .strict();
export type AdminUpdateHardwareLoanContractReturnResult = z.infer<
  typeof AdminUpdateHardwareLoanContractReturnResultSchema
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
