import { describe, it, expect } from 'vitest';
import {
  GetTakeItDownRequestDetailResultSchema,
  SafetyCaseConsoleUrgentEntrySchema,
  TakeItDownReviewPacketSchema,
  takeItDownReviewPacketExposedFieldCodes,
  type TakeItDownReviewPacket,
} from '../src/schemas/safety.js';
import { takeItDownRequestCanBeRuledValid } from '../src/doc-schemas/ncii/requests.js';

const packet: TakeItDownReviewPacket = {
  requesterName: 'Requester Name',
  contactEmail: 'requester@example.com',
  electronicSignature: {
    signedName: 'Requester Name',
    signedAt: 1,
    signatureMethod: 'typedName',
  },
  nonconsentStatement: 'I did not consent to this image being shared.',
  supportingFacts: 'It was posted last week.',
  goodFaithCertification: true,
  accuracyCertification: true,
  targetLocator: { kind: 'url', url: 'https://ttt.productions/square/post-1' },
  firstSubmission: { receivedAt: 5, suppliedFieldCodes: ['requesterName', 'targetLocator'] },
  evidenceCount: 0,
};

const root = {
  requestId: 'req1',
  requesterRole: 'depictedPerson',
  targetLocatorSummary: { kind: 'url', surfaceLabel: 'External link', hasResolvedTarget: false },
  completenessStatus: 'complete',
  validityStatus: 'pending',
  publicStatus: 'received',
} as const;

describe('the TAKE IT DOWN review packet', () => {
  it('carries every statutory element the requester submitted', () => {
    expect(TakeItDownReviewPacketSchema.parse(packet)).toEqual(packet);
    for (const field of [
      'requesterName',
      'contactEmail',
      'electronicSignature',
      'nonconsentStatement',
      'supportingFacts',
      'goodFaithCertification',
    ] as const) {
      const { [field]: _omitted, ...missing } = packet;
      expect(TakeItDownReviewPacketSchema.safeParse(missing).success, field).toBe(false);
    }
  });

  it("carries an authorized representative's represented person, basis, and certification", () => {
    expect(
      TakeItDownReviewPacketSchema.safeParse({
        ...packet,
        authorizedRepresentative: {
          representedPersonName: 'Represented Person',
          authorityBasis: 'Parent',
          authorityCertification: true,
          hasAuthorityEvidence: true,
          authorityProofScanStatus: 'clean',
        },
      }).success,
    ).toBe(true);
  });

  it('the detail answer holds the packet, or null when the request has no requester record', () => {
    expect(
      GetTakeItDownRequestDetailResultSchema.safeParse({ ...root, packet: null }).success,
    ).toBe(true);
    expect(GetTakeItDownRequestDetailResultSchema.safeParse({ ...root, packet }).success).toBe(
      true,
    );
    expect(GetTakeItDownRequestDetailResultSchema.safeParse(root).success).toBe(false);
  });
});

describe('takeItDownReviewPacketExposedFieldCodes — what the privileged read showed', () => {
  it('names each element returned with a value', () => {
    expect(takeItDownReviewPacketExposedFieldCodes(packet)).toEqual([
      'requesterName',
      'contactEmail',
      'electronicSignature',
      'nonconsentStatement',
      'supportingFacts',
      'goodFaithCertification',
      'targetLocator',
    ]);
  });

  it('leaves out blank elements and an absent locator', () => {
    const codes = takeItDownReviewPacketExposedFieldCodes({
      ...packet,
      supportingFacts: '   ',
      targetLocator: undefined,
      contactPhone: '555-0100',
    });
    expect(codes).not.toContain('supportingFacts');
    expect(codes).not.toContain('targetLocator');
    expect(codes).toContain('contactPhone');
  });

  it("adds an authorized representative's basis, certification, and attached proof", () => {
    const codes = takeItDownReviewPacketExposedFieldCodes({
      ...packet,
      authorizedRepresentative: {
        representedPersonName: 'Represented Person',
        authorityBasis: 'Parent',
        authorityCertification: true,
        hasAuthorityEvidence: true,
      },
    });
    expect(codes).toEqual(
      expect.arrayContaining(['authorityBasis', 'authorityCertification', 'authorityEvidence']),
    );
  });
});

describe('takeItDownRequestCanBeRuledValid', () => {
  it('holds only for a complete request with its locator stored', () => {
    expect(
      takeItDownRequestCanBeRuledValid({ completenessStatus: 'complete', hasStoredLocator: true }),
    ).toBe(true);
    expect(
      takeItDownRequestCanBeRuledValid({ completenessStatus: 'complete', hasStoredLocator: false }),
    ).toBe(false);
    expect(
      takeItDownRequestCanBeRuledValid({
        completenessStatus: 'incomplete',
        hasStoredLocator: true,
      }),
    ).toBe(false);
  });
});

describe('the urgent projection holds request clocks', () => {
  it('a request clock is its own entry, keyed by its request — never a case', () => {
    const entry = { scope: 'request' as const, requestId: 'req1', monitors: [] };
    expect(SafetyCaseConsoleUrgentEntrySchema.parse(entry)).toEqual(entry);
    expect(SafetyCaseConsoleUrgentEntrySchema.safeParse({ ...entry, caseId: 'c1' }).success).toBe(
      false,
    );
    expect(
      SafetyCaseConsoleUrgentEntrySchema.safeParse({ scope: 'request', monitors: [] }).success,
    ).toBe(false);
  });
});
