import { describe, it, expect } from 'vitest';
import {
  ArchivedPendingMediaSchema,
  parseArchivedPendingMedia,
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
  terminalAt: 1_700_000_002_000,
};

describe('ArchivedPendingMediaSchema — completed branch', () => {
  const completedDoc = {
    ...baseFields,
    status: 'completed' as const,
    completedAt: 1_700_000_001_000,
    result: {
      events: [{ type: 'profile.pictureUpdated', ids: { userId: 'user_abc' } }],
    },
    archivedAt: 1_700_000_003_000,
  };

  it('accepts a valid completed archive doc', () => {
    expect(() => ArchivedPendingMediaSchema.parse(completedDoc)).not.toThrow();
  });

  it('rejects missing archivedAt', () => {
    const { archivedAt, ...rest } = completedDoc;
    expect(() => ArchivedPendingMediaSchema.parse(rest)).toThrow();
  });

  it('rejects missing terminalAt', () => {
    const { terminalAt, ...rest } = completedDoc;
    expect(() => ArchivedPendingMediaSchema.parse(rest)).toThrow();
  });

  it('rejects unknown fields (.strict)', () => {
    expect(() => ArchivedPendingMediaSchema.parse({ ...completedDoc, extra: true })).toThrow();
  });
});

describe('ArchivedPendingMediaSchema — failed branch', () => {
  const failedDoc = {
    ...baseFields,
    status: 'failed' as const,
    failedAt: 1_700_000_001_000,
    errorCategory: 'system' as const,
    errorMessage: 'Internal error',
    archivedAt: 1_700_000_003_000,
  };

  it('accepts a valid failed archive doc', () => {
    expect(() => ArchivedPendingMediaSchema.parse(failedDoc)).not.toThrow();
  });

  it('rejects missing archivedAt', () => {
    const { archivedAt, ...rest } = failedDoc;
    expect(() => ArchivedPendingMediaSchema.parse(rest)).toThrow();
  });

  it('rejects missing terminalAt', () => {
    const { terminalAt, ...rest } = failedDoc;
    expect(() => ArchivedPendingMediaSchema.parse(rest)).toThrow();
  });
});

describe('ArchivedPendingMediaSchema — rejected branch', () => {
  const rejectedDoc = {
    ...baseFields,
    status: 'rejected' as const,
    rejectedAt: 1_700_000_001_000,
    rejectionType: 'text' as const,
    errorMessage: 'Content rejected',
    archivedAt: 1_700_000_003_000,
  };

  it('accepts a valid text-rejected archive doc', () => {
    expect(() => ArchivedPendingMediaSchema.parse(rejectedDoc)).not.toThrow();
  });

  it('accepts a media-rejected archive doc with violationId', () => {
    const doc = {
      ...rejectedDoc,
      rejectionType: 'media' as const,
      violationId: 'vio_xyz',
    };
    expect(() => ArchivedPendingMediaSchema.parse(doc)).not.toThrow();
  });

  it('rejects missing archivedAt', () => {
    const { archivedAt, ...rest } = rejectedDoc;
    expect(() => ArchivedPendingMediaSchema.parse(rest)).toThrow();
  });

  it('rejects missing terminalAt', () => {
    const { terminalAt, ...rest } = rejectedDoc;
    expect(() => ArchivedPendingMediaSchema.parse(rest)).toThrow();
  });
});

describe('ArchivedPendingMediaSchema — discriminator', () => {
  const archivedBase = {
    ...baseFields,
    archivedAt: 1_700_000_003_000,
  };

  it('rejects status: "pending"', () => {
    const doc = { ...archivedBase, status: 'pending' };
    expect(() => ArchivedPendingMediaSchema.parse(doc)).toThrow();
  });

  it('rejects status: "processing"', () => {
    const doc = { ...archivedBase, status: 'processing' };
    expect(() => ArchivedPendingMediaSchema.parse(doc)).toThrow();
  });

  it('rejects an unknown status', () => {
    const doc = { ...archivedBase, status: 'unknown' };
    expect(() => ArchivedPendingMediaSchema.parse(doc)).toThrow();
  });
});

describe('parseArchivedPendingMedia', () => {
  it('round-trips a completed archive doc', () => {
    const doc = {
      ...baseFields,
      status: 'completed' as const,
      completedAt: 1_700_000_001_000,
      result: {
        events: [{ type: 'profile.pictureUpdated', ids: { userId: 'user_abc' } }],
      },
      archivedAt: 1_700_000_003_000,
    };
    const parsed = parseArchivedPendingMedia(doc);
    expect(parsed.status).toBe('completed');
    expect(parsed.terminalAt).toBe(1_700_000_002_000);
    expect(parsed.archivedAt).toBe(1_700_000_003_000);
  });
});
