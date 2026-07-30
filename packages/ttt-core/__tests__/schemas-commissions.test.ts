import { describe, it, expect } from 'vitest';
import * as commissionSchemas from '../src/schemas/commissions.js';
import {
  CloseCommissionInputSchema,
  RejectCommissionProposalInputSchema,
  SetCommissionProposalSavedInputSchema,
} from '../src/schemas/commissions.js';

describe('Commission lifecycle input schemas', () => {
  it('accepts CloseCommissionInput with only the listing id', () => {
    const input = { commissionListingId: 'commission-1' };
    expect(CloseCommissionInputSchema.parse(input)).toEqual(input);
  });

  it('exposes no delete-commission input schema (commission deletion does not exist)', () => {
    expect(commissionSchemas).not.toHaveProperty('DeleteCommissionInputSchema');
  });
});

describe('Commission proposal input schemas', () => {
  it('accepts RejectCommissionProposalInput with commissionProposalId', () => {
    const input = {
      commissionListingId: 'commission-1',
      commissionProposalId: 'proposal-1',
    };
    expect(RejectCommissionProposalInputSchema.parse(input)).toEqual(input);
  });

  it('rejects RejectCommissionProposalInput with legacy auditionEntryId', () => {
    expect(() =>
      RejectCommissionProposalInputSchema.parse({
        commissionListingId: 'commission-1',
        auditionEntryId: 'entry-1',
      }),
    ).toThrow();
  });

  it('accepts SetCommissionProposalSavedInput with commissionProposalId', () => {
    const input = {
      commissionListingId: 'commission-1',
      commissionProposalId: 'proposal-1',
      saved: true,
    };
    expect(SetCommissionProposalSavedInputSchema.parse(input)).toEqual(input);
  });

  it('rejects SetCommissionProposalSavedInput with legacy auditionEntryId', () => {
    expect(() =>
      SetCommissionProposalSavedInputSchema.parse({
        commissionListingId: 'commission-1',
        auditionEntryId: 'entry-1',
        saved: true,
      }),
    ).toThrow();
  });
});
