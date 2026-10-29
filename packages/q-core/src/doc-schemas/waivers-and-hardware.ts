// Signed waivers and referee hardware contracts. Signatures are legal artifacts: a signed waiver
// carries the exact wording the signer saw, as named snapshots. The templates they are signed from
// are ./waiver-template.ts.

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

// `signedWaivers/{leagueId}_{userId}` — one signed waiver per player per league, never replaced,
// moved, or deleted: a ghost's stays under the ghost's id after the ghost is removed or linked.
export const SignedWaiverSchema = z
  .object({
    leagueId: leagueIdSchema,
    userId: userIdSchema,
    waiverTemplateId: waiverTemplateIdSchema,
    // The published version of the template the signature was captured under. A record that names
    // no version has its wording snapshot as its whole record.
    waiverTemplateVersion: waiverTemplateVersionNumberSchema.optional(),
    waiverTitleSnapshot: z.string(),
    waiverTextSnapshot: z.string(),
    // The kept signature image. Read only through the signature-read callable, never by URL.
    signatureFile: StorageObjectRefSchema,
    signedAt: epochMsSchema,
    // A ghost player's waiver is signed by a witness for the ghost's team: the witness's account,
    // the authority they signed under, and the ghost's name at signing — a named snapshot, so the
    // record still says whom it was for after the ghost's public identity is gone (RULE-STD-ARCH-103).
    teamId: teamIdSchema.optional(),
    witnessUserId: userIdSchema.optional(),
    witnessAuthority: waiverWitnessAuthoritySchema.optional(),
    subjectDisplayNameSnapshot: z.string().optional(),
    // A V1 witnessed waiver recorded the witness's name as it was at signing, and never the authority
    // or the ghost's name; the copy keeps that name as a named snapshot (RULE-STD-ARCH-103) and guesses neither.
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

// One loaned item, as the contract was created with it: its catalog id and name. A contract keeps
// what it loaned even if the catalog later changes.
export const HardwareItemSchema = z.strictObject({
  id: z.string().min(1),
  name: z.string().min(1),
});
export type HardwareItem = z.infer<typeof HardwareItemSchema>;

// `hardwareLoanContracts/{contractId}` — equipment loaned to a referee: who holds it, what they hold,
// and their signature on the loan agreement, a legal artifact. Names resolve from `publicUsers` at
// read time (RULE-STD-ARCH-103). `pending` until the referee signs; `loaned` from the signing, which keeps the
// signature for good; `returned` once an admin records the equipment back, the signature retained.
export const HardwareLoanContractSchema = z
  .strictObject({
    refereeUserId: userIdSchema,
    createdByUserId: userIdSchema,
    hardware: z.array(HardwareItemSchema).min(1),
    status: hardwareLoanContractStatusSchema,
    // The kept signature image. Read only through the signature-read callables, never by URL.
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
