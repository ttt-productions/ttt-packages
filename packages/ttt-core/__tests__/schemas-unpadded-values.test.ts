import { describe, it, expect } from 'vitest';
import type { z } from 'zod';
import {
  MarkNcmecPortalCompleteInputSchema,
  RecordNcmecPortalCorrectionInputSchema,
  RecordNcmecPortalReceiptArtifactInputSchema,
  ncmecReportNumberSchema,
  evidenceVaultKeySchema,
} from '../src/schemas/safety.js';
import { PublicTakeItDownLocatorSchema, nciiLocatorUrlSchema } from '../src/schemas/ncii.js';
import {
  FuturePlanGroupInputSchema,
  FuturePlanItemInputSchema,
  PlatformRuleInputSchema,
  AgreementPointInputSchema,
  ContentPageSectionInputSchema,
  DmcaPolicyContentInputSchema,
} from '../src/schemas/admin.js';
import {
  CreateNotificationBroadcastInputSchema,
  EnqueueArchiveAllInputSchema,
  ArchiveNotificationObservedInputSchema,
} from '../src/schemas/notification.js';
import { GetMyPledgeByCheckoutSessionInputSchema } from '../src/schemas/payments.js';
import {
  MAX_NCMEC_REPORT_NUMBER_LENGTH,
  MAX_EVIDENCE_VAULT_KEY_LENGTH,
  MAX_NCII_LOCATOR_URL_LENGTH,
} from '../src/constants/business-admin.js';

const PADDED = [' ', '   ', ' abc', 'abc ', '\tabc', 'abc\n'];

function refusesBlankAndPadding(name: string, schema: z.ZodType, plain: string) {
  it(`${name} refuses a blank, space-only, or space-padded value and accepts a plain one`, () => {
    expect(schema.safeParse('').success).toBe(false);
    for (const value of PADDED) expect(schema.safeParse(value).success).toBe(false);
    expect(schema.safeParse(plain).success).toBe(true);
  });
}

describe('the NCMEC report number is one declared rule, used by both wire contracts', () => {
  refusesBlankAndPadding('the report-number rule', ncmecReportNumberSchema, '183746592');
  refusesBlankAndPadding('the completion report id', MarkNcmecPortalCompleteInputSchema.shape.ncmecReportId, '183746592');
  refusesBlankAndPadding('the correction report id', RecordNcmecPortalCorrectionInputSchema.shape.ncmecReportId, '183746592');

  it('is bounded by its declared length', () => {
    expect(ncmecReportNumberSchema.safeParse('1'.repeat(MAX_NCMEC_REPORT_NUMBER_LENGTH)).success).toBe(true);
    expect(ncmecReportNumberSchema.safeParse('1'.repeat(MAX_NCMEC_REPORT_NUMBER_LENGTH + 1)).success).toBe(false);
  });
});

describe('the evidence vault key is one declared rule', () => {
  refusesBlankAndPadding('the vault-key rule', evidenceVaultKeySchema, 'cases/case-1/receipt.png');
  refusesBlankAndPadding(
    'the receipt artifact key',
    RecordNcmecPortalReceiptArtifactInputSchema.shape.evidenceVaultKey,
    'cases/case-1/receipt.png',
  );

  it('admits a storage path with "/" and is bounded by its declared length', () => {
    expect(evidenceVaultKeySchema.safeParse('a/b/c').success).toBe(true);
    expect(evidenceVaultKeySchema.safeParse('k'.repeat(MAX_EVIDENCE_VAULT_KEY_LENGTH + 1)).success).toBe(false);
  });
});

describe('the TAKE IT DOWN link is one URL rule', () => {
  refusesBlankAndPadding('the locator URL rule', nciiLocatorUrlSchema, 'https://example.com/a');
  refusesBlankAndPadding('the public locator url', PublicTakeItDownLocatorSchema.shape.url, 'https://example.com/a');

  it('accepts an http or https address only', () => {
    expect(nciiLocatorUrlSchema.safeParse('http://example.com/a').success).toBe(true);
    expect(nciiLocatorUrlSchema.safeParse('https://example.com/a?b=c').success).toBe(true);
    for (const value of ['example.com/a', 'ftp://example.com/a', 'javascript:alert(1)', 'data:text/html,x', 'not a url']) {
      expect(nciiLocatorUrlSchema.safeParse(value).success).toBe(false);
    }
  });

  it('is bounded by MAX_NCII_LOCATOR_URL_LENGTH', () => {
    const prefix = 'https://example.com/';
    expect(nciiLocatorUrlSchema.safeParse(prefix + 'a'.repeat(MAX_NCII_LOCATOR_URL_LENGTH - prefix.length)).success).toBe(true);
    expect(nciiLocatorUrlSchema.safeParse(prefix + 'a'.repeat(MAX_NCII_LOCATOR_URL_LENGTH - prefix.length + 1)).success).toBe(false);
  });
});

describe('every public-document item key refuses padding', () => {
  const dmcaBlock = DmcaPolicyContentInputSchema.shape.contactBlocks.element;
  const keys: Array<[string, z.ZodType]> = [
    ['FuturePlanGroupInputSchema.id', FuturePlanGroupInputSchema.shape.id],
    ['FuturePlanItemInputSchema.id', FuturePlanItemInputSchema.shape.id],
    ['FuturePlanItemInputSchema.groupId', FuturePlanItemInputSchema.shape.groupId],
    ['PlatformRuleInputSchema.id', PlatformRuleInputSchema.shape.id],
    ['AgreementPointInputSchema.id', AgreementPointInputSchema.shape.id],
    ['ContentPageSectionInputSchema.id', ContentPageSectionInputSchema.shape.id],
    ['DmcaPolicyContentInputSchema.contactBlocks.id', dmcaBlock.shape.id],
    ['DmcaPolicyContentInputSchema.contactBlocks.rows.id', dmcaBlock.shape.rows.element.shape.id],
  ];
  for (const [name, schema] of keys) refusesBlankAndPadding(name, schema, 'item-1');
});

describe('every client request id refuses padding', () => {
  const uuid = '2f1c8e8a-5b8e-4a55-9a3e-6a1f0c3d9b21';
  refusesBlankAndPadding('the broadcast request id', CreateNotificationBroadcastInputSchema.shape.requestId, uuid);
  refusesBlankAndPadding('the archive-all request id', EnqueueArchiveAllInputSchema.shape.requestId, uuid);
  refusesBlankAndPadding('the archive request id', ArchiveNotificationObservedInputSchema.shape.requestId, uuid);
});

describe('the Stripe Checkout session id refuses padding', () => {
  refusesBlankAndPadding('the session id', GetMyPledgeByCheckoutSessionInputSchema.shape.sessionId, 'cs_test_a1B2c3');
});
