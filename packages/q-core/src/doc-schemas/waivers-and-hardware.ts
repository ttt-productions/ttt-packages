import { z } from 'zod';
import {
  epochMsSchema,
  hardwareLoanContractStatusSchema,
  leagueIdSchema,
  teamIdSchema,
  userIdSchema,
  waiverWitnessAuthoritySchema,
} from './atoms.js';
import {
  PENDING_HARDWARE_LOAN_CONTRACT_STATUS,
  RETURNED_HARDWARE_LOAN_CONTRACT_STATUS,
} from '../types/unions.js';
import { StorageObjectRefSchema } from './pending-media.js';
import { waiverTemplateIdSchema, waiverTemplateVersionNumberSchema } from './waiver-template.js';

export const SignedWaiverSchema = z
  .object({
    leagueId: leagueIdSchema,
    userId: userIdSchema,
    waiverTemplateId: waiverTemplateIdSchema,
    waiverTemplateVersion: waiverTemplateVersionNumberSchema.optional(),
    waiverTitleSnapshot: z.string(),
    waiverTextSnapshot: z.string(),
    signatureFile: StorageObjectRefSchema,
    signedAt: epochMsSchema,
    teamId: teamIdSchema.optional(),
    witnessUserId: userIdSchema.optional(),
    witnessAuthority: waiverWitnessAuthoritySchema.optional(),
    subjectDisplayNameSnapshot: z.string().optional(),
    witnessDisplayNameSnapshot: z.string().optional(),
  })
  .refine(
    (waiver) => {
      const full = [
        waiver.teamId,
        waiver.witnessUserId,
        waiver.witnessAuthority,
        waiver.subjectDisplayNameSnapshot,
      ];
      const legacy = [waiver.teamId, waiver.witnessUserId, waiver.witnessDisplayNameSnapshot];
      const present = (fields: readonly unknown[]) =>
        fields.filter((field) => field !== undefined).length;
      if (present([...full, waiver.witnessDisplayNameSnapshot]) === 0) return true;
      if (present(full) === full.length) return waiver.witnessDisplayNameSnapshot === undefined;
      return (
        present(legacy) === legacy.length &&
        waiver.witnessAuthority === undefined &&
        waiver.subjectDisplayNameSnapshot === undefined
      );
    },
    {
      message:
        "A ghost's waiver carries its team, witness, authority, and name together; or, copied from V1, its team, witness, and the witness's recorded name; or none of them.",
      path: ['witnessUserId'],
    },
  );
export type SignedWaiver = z.infer<typeof SignedWaiverSchema>;

export const HardwareItemSchema = z.strictObject({
  id: z.string().min(1),
  name: z.string().min(1),
});
export type HardwareItem = z.infer<typeof HardwareItemSchema>;

export const HardwareLoanContractSchema = z
  .strictObject({
    refereeUserId: userIdSchema,
    createdByUserId: userIdSchema,
    hardware: z.array(HardwareItemSchema).min(1),
    status: hardwareLoanContractStatusSchema,
    signatureFile: StorageObjectRefSchema.optional(),
    createdAt: epochMsSchema,
    loanedAt: epochMsSchema.optional(),
    returnedAt: epochMsSchema.optional(),
  })
  .refine(
    (contract) =>
      contract.status === PENDING_HARDWARE_LOAN_CONTRACT_STATUS
        ? contract.signatureFile === undefined && contract.loanedAt === undefined
        : contract.signatureFile !== undefined && contract.loanedAt !== undefined,
    {
      message: 'A contract carries its signature and loan date exactly once it is signed.',
      path: ['signatureFile'],
    },
  )
  .refine(
    (contract) =>
      (contract.status === RETURNED_HARDWARE_LOAN_CONTRACT_STATUS) ===
      (contract.returnedAt !== undefined),
    {
      message: 'A contract carries its return date exactly while it is returned.',
      path: ['returnedAt'],
    },
  );
export type HardwareLoanContract = z.infer<typeof HardwareLoanContractSchema>;
