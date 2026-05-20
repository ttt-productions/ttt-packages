import { describe, it, expect } from 'vitest';
import {
  PendingMediaSchema,
  PendingMediaPendingSchema,
  PendingMediaCompletedSchema,
  PendingMediaFailedSchema,
  PendingMediaRejectedSchema,
  ArchivedPendingMediaSchema,
  parsePendingMedia,
  parseArchivedPendingMedia,
} from '../src/media/pending-media.js';

const base = {
  id: 'pm_1',
  userId: 'u_1',
  fileOrigin: 'profile-picture' as const,
  originalFileName: 'avatar.jpg',
  pendingStoragePath: 'uploads/profile-picture/u_1/pm_1',
  clientContext: { surface: 'profile' },
  createdAt: 1_700_000_000_000,
  updatedAt: 1_700_000_001_000,
};

describe('PendingMediaPendingSchema', () => {
  it('parses a pending doc', () => {
    const doc = { ...base, status: 'pending' };
    const result = PendingMediaPendingSchema.parse(doc);
    expect(result.status).toBe('pending');
    expect(result.fileOrigin).toBe('profile-picture');
  });

  it('rejects invalid fileOrigin', () => {
    expect(() => PendingMediaPendingSchema.parse({ ...base, status: 'pending', fileOrigin: 'unknown-origin' })).toThrow();
  });
});

describe('PendingMediaCompletedSchema', () => {
  it('parses a completed doc with a TTT domain event', () => {
    const doc = {
      ...base,
      status: 'completed',
      completedAt: 1_700_000_002_000,
      terminalAt: 1_700_000_002_000,
      result: {
        events: [
          { type: 'profile.pictureUpdated', ids: { userId: 'u_1' } },
        ],
      },
    };
    const result = PendingMediaCompletedSchema.parse(doc);
    expect(result.status).toBe('completed');
    expect(result.result.events[0].type).toBe('profile.pictureUpdated');
  });

  it('rejects a completed doc with an unknown domain event', () => {
    const doc = {
      ...base,
      status: 'completed',
      completedAt: 1_700_000_002_000,
      terminalAt: 1_700_000_002_000,
      result: {
        events: [{ type: 'unknown.event', ids: {} }],
      },
    };
    expect(() => PendingMediaCompletedSchema.parse(doc)).toThrow();
  });
});

describe('PendingMediaFailedSchema', () => {
  it('parses a failed doc', () => {
    const doc = {
      ...base,
      fileOrigin: 'streetz',
      status: 'failed',
      failedAt: 1_700_000_003_000,
      terminalAt: 1_700_000_003_000,
      errorCategory: 'storage',
      errorMessage: 'Storage write failed',
    };
    const result = PendingMediaFailedSchema.parse(doc);
    expect(result.errorCategory).toBe('storage');
  });
});

describe('PendingMediaRejectedSchema', () => {
  it('parses a rejected doc', () => {
    const doc = {
      ...base,
      fileOrigin: 'skill-media',
      status: 'rejected',
      rejectedAt: 1_700_000_004_000,
      terminalAt: 1_700_000_004_000,
      rejectionType: 'media',
      errorMessage: 'Moderation failed',
    };
    const result = PendingMediaRejectedSchema.parse(doc);
    expect(result.rejectionType).toBe('media');
  });
});

describe('PendingMediaSchema (discriminated union)', () => {
  it('selects the correct branch for chat-attachment', () => {
    const doc = {
      ...base,
      fileOrigin: 'chat-attachment',
      status: 'processing',
      processingStartedAt: 1_700_000_001_500,
    };
    const result = PendingMediaSchema.parse(doc);
    expect(result.status).toBe('processing');
  });
});

describe('parsePendingMedia', () => {
  it('throws on invalid input', () => {
    expect(() => parsePendingMedia({ invalid: true })).toThrow();
  });

  it('parses valid doc', () => {
    const result = parsePendingMedia({ ...base, status: 'pending' });
    expect(result.id).toBe('pm_1');
  });
});

describe('ArchivedPendingMediaSchema', () => {
  it('parses archived completed doc', () => {
    const doc = {
      ...base,
      status: 'completed',
      completedAt: 1_700_000_002_000,
      terminalAt: 1_700_000_002_000,
      archivedAt: 1_700_000_010_000,
      result: {
        events: [{ type: 'profile.pictureUpdated', ids: { userId: 'u_1' } }],
      },
    };
    const result = ArchivedPendingMediaSchema.parse(doc);
    expect(result.status).toBe('completed');
  });

  it('rejects non-terminal pending status in archive', () => {
    const doc = { ...base, status: 'pending', archivedAt: 1_700_000_010_000 };
    expect(() => ArchivedPendingMediaSchema.parse(doc)).toThrow();
  });
});

describe('parseArchivedPendingMedia', () => {
  it('parses archived failed doc', () => {
    const doc = {
      ...base,
      status: 'failed',
      failedAt: 1_700_000_003_000,
      terminalAt: 1_700_000_003_000,
      archivedAt: 1_700_000_010_000,
      errorCategory: 'validation',
      errorMessage: 'Bad input',
    };
    const result = parseArchivedPendingMedia(doc);
    expect(result.errorCategory).toBe('validation');
  });
});
