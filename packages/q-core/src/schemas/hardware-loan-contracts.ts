// Callable contracts for hardware loan contracts: an admin creates a loan for a referee, the referee
// signs the agreement, an admin records the equipment returned or deletes a contract never signed,
// and the signature is read back through a callable — never by URL.

import { z } from 'zod';
import { HARDWARE_CATALOG, HARDWARE_CATALOG_ITEM_IDS } from '../constants/business.js';
import { epochMsSchema, hardwareLoanContractIdSchema } from '../doc-schemas/atoms.js';
import { userIdSchema } from './atoms.js';
import { stagingUploadPathSchema } from './uploads.js';

export const hardwareCatalogItemIdSchema = z.enum(HARDWARE_CATALOG_ITEM_IDS);

// The referee must be on the referee roster; each item is a catalog item, named once.
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
export type AdminCreateHardwareLoanContractInput = z.infer<typeof AdminCreateHardwareLoanContractInputSchema>;

export const AdminCreateHardwareLoanContractResultSchema = z
  .object({ contractId: hardwareLoanContractIdSchema })
  .strict();
export type AdminCreateHardwareLoanContractResult = z.infer<typeof AdminCreateHardwareLoanContractResultSchema>;

// The contract's referee signs it: the drawn PNG staged at their own staging path. The signer is the
// caller — never named in the payload.
export const SubmitHardwareLoanContractSignatureInputSchema = z
  .object({ contractId: hardwareLoanContractIdSchema, storagePath: stagingUploadPathSchema })
  .strict();
export type SubmitHardwareLoanContractSignatureInput = z.infer<typeof SubmitHardwareLoanContractSignatureInputSchema>;

// `alreadySigned` when this very signing was recorded before: a retry, answered without copying again.
export const SubmitHardwareLoanContractSignatureResultSchema = z
  .object({ contractId: hardwareLoanContractIdSchema, loanedAt: epochMsSchema, alreadySigned: z.boolean() })
  .strict();
export type SubmitHardwareLoanContractSignatureResult = z.infer<typeof SubmitHardwareLoanContractSignatureResultSchema>;

// An admin records a loaned contract's equipment back. The signature is kept.
export const AdminReturnHardwareLoanContractInputSchema = z
  .object({ contractId: hardwareLoanContractIdSchema })
  .strict();
export type AdminReturnHardwareLoanContractInput = z.infer<typeof AdminReturnHardwareLoanContractInputSchema>;

// `changed` is false when the contract was already returned: nothing was written.
export const AdminReturnHardwareLoanContractResultSchema = z
  .object({ contractId: hardwareLoanContractIdSchema, returnedAt: epochMsSchema, changed: z.boolean() })
  .strict();
export type AdminReturnHardwareLoanContractResult = z.infer<typeof AdminReturnHardwareLoanContractResultSchema>;

// An admin deletes a contract the referee has not signed. A signed contract is a legal record and is
// never deleted.
export const AdminDeleteHardwareLoanContractInputSchema = z
  .object({ contractId: hardwareLoanContractIdSchema })
  .strict();
export type AdminDeleteHardwareLoanContractInput = z.infer<typeof AdminDeleteHardwareLoanContractInputSchema>;

export const AdminDeleteHardwareLoanContractResultSchema = z
  .object({ contractId: hardwareLoanContractIdSchema, deleted: z.boolean() })
  .strict();
export type AdminDeleteHardwareLoanContractResult = z.infer<typeof AdminDeleteHardwareLoanContractResultSchema>;

// A contract's signature, read by its referee (the member entry) or an admin (the admin entry). The
// answer is `SignatureFileResultSchema`, as a waiver's is.
export const GetHardwareLoanContractSignatureFileInputSchema = z
  .object({ contractId: hardwareLoanContractIdSchema })
  .strict();
export type GetHardwareLoanContractSignatureFileInput = z.infer<typeof GetHardwareLoanContractSignatureFileInputSchema>;
