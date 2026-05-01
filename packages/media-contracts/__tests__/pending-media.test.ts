import { describe, it, expect } from 'vitest';
import {
  PendingMediaSchema,
  StartUploadRequestSchema,
  StartUploadResponseSchema,
  parsePendingMedia,
} from '../src/schemas';

const baseFields = {
  id: 'pm_123',
  userId: 'user_abc',
  fileOrigin: 'profile-picture' as const,
  originalFileName: 'avatar.jpg',
  pendingStoragePath: 'uploads/profile-picture/user_abc/file_1.jpg',
  clientContext: { surface: 'profile-page' },
  createdAt: 1_700_000_000_000,
  updatedAt: 1_700_000_000_000,
};

describe('PendingMediaSchema — pending branch', () => {
  it('accepts a valid pending doc', () => {
    const doc = { ...baseFields, status: 'pending' as const };
    expect(() => PendingMediaSchema.parse(doc)).not.toThrow();
  });

  it('rejects unknown fields (.strict)', () => {
    const doc = { ...baseFields, status: 'pending' as const, somethingExtra: true };
    expect(() => PendingMediaSchema.parse(doc)).toThrow();
  });

  it('rejects missing required base field', () => {
    const { userId, ...rest } = baseFields;
    const doc = { ...rest, status: 'pending' as const };
    expect(() => PendingMediaSchema.parse(doc)).toThrow();
  });
});

describe('PendingMediaSchema — processing branch', () => {
  it('accepts a valid processing doc', () => {
    const doc = { ...baseFields, status: 'processing' as const };
    expect(() => PendingMediaSchema.parse(doc)).not.toThrow();
  });
});

describe('PendingMediaSchema — completed branch', () => {
  const completedDoc = {
    ...baseFields,
    status: 'completed' as const,
    completedAt: 1_700_000_001_000,
    result: {
      events: [{ type: 'profile.pictureUpdated', ids: { userId: 'user_abc' } }],
    },
  };

  it('accepts a valid completed doc with only events', () => {
    expect(() => PendingMediaSchema.parse(completedDoc)).not.toThrow();
  });

  it('accepts a completed doc with affected entries', () => {
    const doc = {
      ...completedDoc,
      result: {
        events: [{ type: 'streetz.postCreated', ids: { userId: 'user_abc', postId: 'post_1' } }],
        affected: [
          { collection: 'streetzPosts', docId: 'post_1', operation: 'create' as const },
        ],
      },
    };
    expect(() => PendingMediaSchema.parse(doc)).not.toThrow();
  });

  it('rejects a completed doc missing completedAt', () => {
    const { completedAt, ...rest } = completedDoc;
    expect(() => PendingMediaSchema.parse(rest)).toThrow();
  });

  it('rejects a completed doc missing result', () => {
    const { result, ...rest } = completedDoc;
    expect(() => PendingMediaSchema.parse(rest)).toThrow();
  });

  it('rejects an affected entry with an invalid operation', () => {
    const doc = {
      ...completedDoc,
      result: {
        events: [],
        affected: [
          { collection: 'streetzPosts', docId: 'post_1', operation: 'delete' as unknown as 'create' },
        ],
      },
    };
    expect(() => PendingMediaSchema.parse(doc)).toThrow();
  });
});

describe('PendingMediaSchema — failed branch', () => {
  const failedDoc = {
    ...baseFields,
    status: 'failed' as const,
    failedAt: 1_700_000_001_000,
    errorCategory: 'system' as const,
    errorMessage: 'Internal error',
  };

  it('accepts a valid failed doc', () => {
    expect(() => PendingMediaSchema.parse(failedDoc)).not.toThrow();
  });

  it('rejects an unknown errorCategory', () => {
    const doc = { ...failedDoc, errorCategory: 'totally-bogus' as unknown as 'system' };
    expect(() => PendingMediaSchema.parse(doc)).toThrow();
  });

  it('rejects a failed doc missing failedAt', () => {
    const { failedAt, ...rest } = failedDoc;
    expect(() => PendingMediaSchema.parse(rest)).toThrow();
  });

  it('rejects a failed doc with empty errorMessage', () => {
    const doc = { ...failedDoc, errorMessage: '' };
    expect(() => PendingMediaSchema.parse(doc)).toThrow();
  });
});

describe('PendingMediaSchema — rejected branch', () => {
  const rejectedDoc = {
    ...baseFields,
    status: 'rejected' as const,
    rejectedAt: 1_700_000_001_000,
    rejectionType: 'text' as const,
    errorMessage: 'Content rejected',
  };

  it('accepts a valid text-rejected doc', () => {
    expect(() => PendingMediaSchema.parse(rejectedDoc)).not.toThrow();
  });

  it('accepts a media-rejected doc with violationId', () => {
    const doc = {
      ...rejectedDoc,
      rejectionType: 'media' as const,
      violationId: 'vio_xyz',
    };
    expect(() => PendingMediaSchema.parse(doc)).not.toThrow();
  });

  it('rejects an invalid rejectionType', () => {
    const doc = { ...rejectedDoc, rejectionType: 'audio' as unknown as 'text' };
    expect(() => PendingMediaSchema.parse(doc)).toThrow();
  });

  it('rejects a rejected doc missing rejectedAt', () => {
    const { rejectedAt, ...rest } = rejectedDoc;
    expect(() => PendingMediaSchema.parse(rest)).toThrow();
  });
});

describe('PendingMediaSchema — discriminator', () => {
  it('rejects a doc with an unknown status', () => {
    const doc = { ...baseFields, status: 'archived' as unknown as 'pending' };
    expect(() => PendingMediaSchema.parse(doc)).toThrow();
  });

  it('parsePendingMedia round-trips a pending doc', () => {
    const doc = { ...baseFields, status: 'pending' as const };
    const parsed = parsePendingMedia(doc);
    expect(parsed.status).toBe('pending');
  });
});

describe('StartUploadRequestSchema', () => {
  const valid = {
    storagePath: 'uploads/profile-picture/user_abc/file_1.jpg',
    originalFileName: 'avatar.jpg',
    fileOrigin: 'profile-picture' as const,
    clientContext: { surface: 'profile-page' },
  };

  it('accepts a valid request', () => {
    expect(() => StartUploadRequestSchema.parse(valid)).not.toThrow();
  });

  it('accepts a request with optional targetInfo + textContent', () => {
    const req = { ...valid, targetInfo: { skillId: 'skill_1' }, textContent: 'My new skill' };
    expect(() => StartUploadRequestSchema.parse(req)).not.toThrow();
  });

  it('rejects unknown fields', () => {
    const req = { ...valid, extra: 'nope' };
    expect(() => StartUploadRequestSchema.parse(req)).toThrow();
  });

  it('rejects an unknown fileOrigin', () => {
    const req = { ...valid, fileOrigin: 'something-new' as unknown as 'profile-picture' };
    expect(() => StartUploadRequestSchema.parse(req)).toThrow();
  });
});

describe('StartUploadResponseSchema', () => {
  it('accepts a valid response', () => {
    expect(() => StartUploadResponseSchema.parse({ pendingMediaId: 'pm_123' })).not.toThrow();
  });

  it('rejects an empty pendingMediaId', () => {
    expect(() => StartUploadResponseSchema.parse({ pendingMediaId: '' })).toThrow();
  });

  it('rejects unknown fields', () => {
    expect(() => StartUploadResponseSchema.parse({ pendingMediaId: 'pm_1', extra: 1 })).toThrow();
  });
});
