import { z } from 'zod';
import { hardwareLoanContractIdSchema } from '../doc-schemas/atoms.js';

export const SignHardwareContractVariablesSchema = z
  .object({
    contractId: hardwareLoanContractIdSchema,
    signature: z.instanceof(Blob),
  })
  .strict();
export type SignHardwareContractVariables = z.infer<typeof SignHardwareContractVariablesSchema>;
