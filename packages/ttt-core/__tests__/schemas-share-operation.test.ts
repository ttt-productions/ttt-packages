import { describe, it, expect } from 'vitest';
import {
  ShareOperationSchema,
  ManageProjectSharesInputSchema,
} from '../src/schemas/share-operation';

describe('ShareOperationSchema', () => {
  describe('add-pending branch', () => {
    it('accepts a valid add-pending operation with sourceId+sourceType', () => {
      const op = {
        type: 'add-pending',
        amount: 10,
        sourceId: 'invite-1',
        sourceType: 'invite',
      };
      expect(ShareOperationSchema.parse(op)).toEqual(op);
    });
    it('accepts a valid add-pending with user only', () => {
      const op = {
        type: 'add-pending',
        amount: 5,
        user: { uid: 'user-1' },
      };
      expect(ShareOperationSchema.parse(op)).toEqual(op);
    });
    it('rejects amount of 0 or negative', () => {
      expect(() =>
        ShareOperationSchema.parse({ type: 'add-pending', amount: 0 }),
      ).toThrow();
      expect(() =>
        ShareOperationSchema.parse({ type: 'add-pending', amount: -1 }),
      ).toThrow();
    });
    it('rejects unknown sourceType', () => {
      expect(() =>
        ShareOperationSchema.parse({
          type: 'add-pending',
          sourceId: 'x',
          sourceType: 'unknown',
        }),
      ).toThrow();
    });
    it('rejects unknown keys (.strict)', () => {
      expect(() =>
        ShareOperationSchema.parse({
          type: 'add-pending',
          amount: 5,
          extraField: 'nope',
        }),
      ).toThrow();
    });
  });

  describe('remove-pending branch', () => {
    it('accepts a remove-pending with just sourceId', () => {
      const op = { type: 'remove-pending', sourceId: 'job-1' };
      expect(ShareOperationSchema.parse(op)).toEqual(op);
    });
  });

  describe('add-active branch', () => {
    it('accepts a valid add-active with user', () => {
      const op = {
        type: 'add-active',
        amount: 25,
        user: { uid: 'applicant-uid' },
      };
      expect(ShareOperationSchema.parse(op)).toEqual(op);
    });
  });

  describe('create-project branch', () => {
    it('accepts the canonical create-project shape', () => {
      const op = {
        type: 'create-project',
        amount: 1,
        user: { uid: 'creator-uid' },
      };
      expect(ShareOperationSchema.parse(op)).toEqual(op);
    });
  });

  describe('convert-invite branch', () => {
    it('accepts a convert-invite operation', () => {
      const op = {
        type: 'convert-invite',
        amount: 50,
        user: { uid: 'invitee-uid' },
        sourceId: 'invite-1',
        sourceType: 'invite',
      };
      expect(ShareOperationSchema.parse(op)).toEqual(op);
    });
  });

  describe('discriminator', () => {
    it('rejects unknown operation type', () => {
      expect(() =>
        ShareOperationSchema.parse({ type: 'delete-everything' }),
      ).toThrow();
    });
    it('rejects missing type field', () => {
      expect(() =>
        ShareOperationSchema.parse({ amount: 5 }),
      ).toThrow();
    });
  });

  describe('projectData field rejection (dead-code removed)', () => {
    it('rejects payloads that include projectData (was previously optional, now removed)', () => {
      expect(() =>
        ShareOperationSchema.parse({
          type: 'create-project',
          amount: 1,
          user: { uid: 'u' },
          projectData: { projectId: 'p', anything: 'here' },
        }),
      ).toThrow();
    });
  });
});

describe('ManageProjectSharesInputSchema', () => {
  it('accepts a valid input', () => {
    const input = {
      projectId: 'project-1',
      operation: { type: 'add-pending', amount: 10, sourceId: 'i-1', sourceType: 'invite' },
    };
    expect(ManageProjectSharesInputSchema.parse(input)).toEqual(input);
  });
  it('rejects empty projectId', () => {
    expect(() =>
      ManageProjectSharesInputSchema.parse({
        projectId: '',
        operation: { type: 'add-pending' },
      }),
    ).toThrow();
  });
  it('rejects unknown top-level keys (.strict)', () => {
    expect(() =>
      ManageProjectSharesInputSchema.parse({
        projectId: 'p-1',
        operation: { type: 'add-pending' },
        actorIsAdmin: true,
      }),
    ).toThrow();
  });
});
