import { describe, it, expect } from 'vitest';
import {
  RejectCommissionProposalInputSchema,
  SetCommissionProposalSavedInputSchema,
} from '../src/schemas/commissions.js';

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
