import { describe, expect, it } from 'vitest';
import type { ZodType } from 'zod';
import { SetReportDispositionCallableInputSchema } from '../src/doc-schemas/safety/case.js';
import { ReopenSafetyCaseInputSchema, SafetyCaseInputSchema } from '../src/schemas/admin.js';
import { DecideTakeItDownValidityInputSchema } from '../src/schemas/ncii.js';
import {
  CommandAccountActionInputSchema,
  MarkNcmecPortalCompleteInputSchema,
  RecordNcmecPortalCorrectionInputSchema,
  RecordNcmecPortalReceiptArtifactInputSchema,
  RevealCaseEvidenceInputSchema,
} from '../src/schemas/safety.js';

const PHRASES: ReadonlyArray<{
  schemaName: string;
  schema: ZodType;
  phrase: string;
  retiredPhrase: string;
}> = [
  {
    schemaName: 'SafetyCaseInputSchema',
    schema: SafetyCaseInputSchema,
    phrase: 'I confirm safety actions',
    retiredPhrase: 'I confirm these safety actions',
  },
  {
    schemaName: 'ReopenSafetyCaseInputSchema',
    schema: ReopenSafetyCaseInputSchema,
    phrase: 'I confirm reopen',
    retiredPhrase: 'I confirm reopening this safety case',
  },
  {
    schemaName: 'CommandAccountActionInputSchema',
    schema: CommandAccountActionInputSchema,
    phrase: 'I confirm account action',
    retiredPhrase: 'I confirm this account action',
  },
  {
    schemaName: 'RecordNcmecPortalReceiptArtifactInputSchema',
    schema: RecordNcmecPortalReceiptArtifactInputSchema,
    phrase: 'I confirm NCMEC receipt',
    retiredPhrase: 'I confirm this is the NCMEC portal receipt',
  },
  {
    schemaName: 'MarkNcmecPortalCompleteInputSchema',
    schema: MarkNcmecPortalCompleteInputSchema,
    phrase: 'I confirm NCMEC filed',
    retiredPhrase: 'I confirm this NCMEC report was filed via the manual portal',
  },
  {
    schemaName: 'RevealCaseEvidenceInputSchema',
    schema: RevealCaseEvidenceInputSchema,
    phrase: 'I confirm reveal',
    retiredPhrase: 'I confirm I am revealing case evidence under reauth',
  },
  {
    schemaName: 'RecordNcmecPortalCorrectionInputSchema',
    schema: RecordNcmecPortalCorrectionInputSchema,
    phrase: 'I confirm NCMEC correction',
    retiredPhrase: 'I confirm this NCMEC portal correction was filed',
  },
  {
    schemaName: 'DecideTakeItDownValidityInputSchema',
    schema: DecideTakeItDownValidityInputSchema,
    phrase: 'I confirm validity decision',
    retiredPhrase: 'I confirm this TAKE IT DOWN validity decision',
  },
  {
    schemaName: 'SetReportDispositionCallableInputSchema',
    schema: SetReportDispositionCallableInputSchema,
    phrase: 'I confirm legal disposition',
    retiredPhrase: 'I confirm this legal reporting disposition',
  },
];

function confirmationRejected(schema: ZodType, confirmation: string): boolean {
  const result = schema.safeParse({ confirmation });
  if (result.success) return false;
  return result.error.issues.some((issue) => issue.path[0] === 'confirmation');
}

describe('safety confirmation phrases are "I confirm" plus the action', () => {
  it.each(PHRASES)('$schemaName accepts "$phrase"', ({ schema, phrase }) => {
    expect(confirmationRejected(schema, phrase)).toBe(false);
  });

  it.each(PHRASES)(
    '$schemaName refuses the long phrase "$retiredPhrase"',
    ({ schema, retiredPhrase }) => {
      expect(confirmationRejected(schema, retiredPhrase)).toBe(true);
    },
  );
});
