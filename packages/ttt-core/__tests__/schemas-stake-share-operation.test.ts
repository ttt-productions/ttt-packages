import { describe, it, expect } from 'vitest';
import {
  StakeShareOperationSchema,
  ManageWorkProjectStakeSharesInputSchema,
} from '../src/schemas/stake-share-operation';

describe('StakeShareOperationSchema', () => {
  describe('add-pending branch', () => {
    it('accepts a valid add-pending operation with sourceId', () => {
      const op = { type: 'add-pending', amount: 10, sourceId: 'invite-1' };
      expect(StakeShareOperationSchema.parse(op)).toEqual(op);
    });
    it('accepts a valid add-pending with user only', () => {
      const op = { type: 'add-pending', amount: 5, user: { uid: 'user-1' } };
      expect(StakeShareOperationSchema.parse(op)).toEqual(op);
    });
    it('rejects amount of 0 or negative', () => {
      expect(() =>
        StakeShareOperationSchema.parse({ type: 'add-pending', amount: 0 }),
      ).toThrow();
      expect(() =>
        StakeShareOperationSchema.parse({ type: 'add-pending', amount: -1 }),
      ).toThrow();
    });
    it('rejects sourceType as an unknown key (.strict)', () => {
      expect(() =>
        StakeShareOperationSchema.parse({
          type: 'add-pending',
          sourceId: 'invite-1',
          sourceType: 'invite',
        }),
      ).toThrow();
    });
    it('rejects other unknown keys (.strict)', () => {
      expect(() =>
        StakeShareOperationSchema.parse({
          type: 'add-pending',
          amount: 5,
          extraField: 'nope',
        }),
      ).toThrow();
    });
  });

  describe('remove-pending branch', () => {
    it('accepts a remove-pending with just sourceId', () => {
      const op = { type: 'remove-pending', sourceId: 'invite-1' };
      expect(StakeShareOperationSchema.parse(op)).toEqual(op);
    });
  });

  describe('add-active branch', () => {
    it('accepts a valid add-active with user', () => {
      const op = { type: 'add-active', amount: 25, user: { uid: 'proposalArtisan-uid' } };
      expect(StakeShareOperationSchema.parse(op)).toEqual(op);
    });
  });

  describe('create-workProject branch', () => {
    it('accepts the canonical create-workProject shape', () => {
      const op = { type: 'create-workProject', amount: 1, user: { uid: 'artisanCreator-uid' } };
      expect(StakeShareOperationSchema.parse(op)).toEqual(op);
    });
  });

  describe('convert-invite branch', () => {
    it('accepts a convert-invite operation', () => {
      const op = {
        type: 'convert-invite',
        amount: 50,
        user: { uid: 'invitee-uid' },
        sourceId: 'invite-1',
      };
      expect(StakeShareOperationSchema.parse(op)).toEqual(op);
    });
    it('rejects sourceType as an unknown key (.strict)', () => {
      expect(() =>
        StakeShareOperationSchema.parse({
          type: 'convert-invite',
          amount: 50,
          user: { uid: 'invitee-uid' },
          sourceId: 'invite-1',
          sourceType: 'invite',
        }),
      ).toThrow();
    });
  });

  describe('discriminator', () => {
    it('rejects unknown operation type', () => {
      expect(() =>
        StakeShareOperationSchema.parse({ type: 'delete-everything' }),
      ).toThrow();
    });
    it('rejects accept-proposalArtisan (removed operation)', () => {
      expect(() =>
        StakeShareOperationSchema.parse({
          type: 'accept-proposalArtisan',
          user: { uid: 'uid' },
          sourceId: 'commission-1',
          amount: 50,
        }),
      ).toThrow();
    });
    it('rejects missing type field', () => {
      expect(() =>
        StakeShareOperationSchema.parse({ amount: 5 }),
      ).toThrow();
    });
  });

  describe('legacy workProjectData field rejection (dead-code removed)', () => {
    it('rejects payloads that include legacy workProjectData/projectData', () => {
      expect(() =>
        StakeShareOperationSchema.parse({
          type: 'create-workProject',
          amount: 1,
          user: { uid: 'u' },
          workProjectData: { workProjectId: 'p', anything: 'here' },
        }),
      ).toThrow();
      expect(() =>
        StakeShareOperationSchema.parse({
          type: 'create-workProject',
          amount: 1,
          user: { uid: 'u' },
          projectData: { workProjectId: 'p', anything: 'here' },
        }),
      ).toThrow();
    });
  });
});

describe('ManageWorkProjectStakeSharesInputSchema', () => {
  it('accepts a valid input', () => {
    const input = {
      workProjectId: 'workProject-1',
      operation: { type: 'add-pending', amount: 10, sourceId: 'i-1' },
    };
    expect(ManageWorkProjectStakeSharesInputSchema.parse(input)).toEqual(input);
  });
  it('rejects empty workProjectId', () => {
    expect(() =>
      ManageWorkProjectStakeSharesInputSchema.parse({
        workProjectId: '',
        operation: { type: 'add-pending' },
      }),
    ).toThrow();
  });
  it('rejects unknown top-level keys (.strict)', () => {
    expect(() =>
      ManageWorkProjectStakeSharesInputSchema.parse({
        workProjectId: 'p-1',
        operation: { type: 'add-pending' },
        actorIsAdmin: true,
      }),
    ).toThrow();
  });
});


