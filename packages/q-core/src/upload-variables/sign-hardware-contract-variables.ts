import { z } from 'zod';
import { hardwareLoanContractIdSchema } from '../doc-schemas/atoms.js';

// Variables for the hardware-contract signing mutation hook (RULE-STD-MEDIA-005). The signature is the
// drawing as the canvas exported it.
export const SignHardwareContractVariablesSchema = z
  .object({
    contractId: hardwareLoanContractIdSchema,
    signature: z.instanceof(Blob),
  })
  .strict();
export type SignHardwareContractVariables = z.infer<typeof SignHardwareContractVariablesSchema>;
