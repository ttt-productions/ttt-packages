import { describe, it, expect } from 'vitest';
import {
  TEMP_UPLOAD_PREFIX,
  buildTempUploadPath,
  isTempUploadPath,
  extractFileIdFromTempPath,
} from '../src/paths/storage-paths';

describe('TEMP_UPLOAD_PREFIX', () => {
  it('equals "uploads/"', () => {
    expect(TEMP_UPLOAD_PREFIX).toBe('uploads/');
  });
});

describe('buildTempUploadPath', () => {
  it('builds path for profile-picture', () => {
    expect(buildTempUploadPath('profile-picture', 'user_abc', 'file_1')).toBe(
      'uploads/profile-picture/user_abc/file_1'
    );
  });

  it('builds path for streetz', () => {
    expect(buildTempUploadPath('streetz', 'user_xyz', 'file_2')).toBe(
      'uploads/streetz/user_xyz/file_2'
    );
  });

  it('builds path for chat-attachment', () => {
    expect(buildTempUploadPath('chat-attachment', 'user_123', 'file_3')).toBe(
      'uploads/chat-attachment/user_123/file_3'
    );
  });
});

describe('isTempUploadPath', () => {
  it('returns true for valid temp paths', () => {
    expect(isTempUploadPath('uploads/profile-picture/user_abc/file_1')).toBe(true);
    expect(isTempUploadPath('uploads/streetz/user_xyz/file_2')).toBe(true);
    expect(isTempUploadPath('uploads/chat-attachment/user_123/some-uuid')).toBe(true);
  });

  it('returns false for finalized storage paths', () => {
    expect(isTempUploadPath('userProfiles/userId/profile-picture/file.jpg')).toBe(false);
    expect(isTempUploadPath('streetzFeed/userId/postId/file.jpg')).toBe(false);
    expect(isTempUploadPath('allProjects/projectId/files/file.jpg')).toBe(false);
    expect(isTempUploadPath('jobListings/jobId/file.jpg')).toBe(false);
    expect(isTempUploadPath('opportunityBoard/oppId/video/file.mp4')).toBe(false);
    expect(isTempUploadPath('messageAttachments/userId/convoId/file.jpg')).toBe(false);
    expect(isTempUploadPath('rejected/userId/file.jpg')).toBe(false);
    expect(isTempUploadPath('__public__/file.jpg')).toBe(false);
    expect(isTempUploadPath('contentLibrary/libId/sub/file.jpg')).toBe(false);
    expect(isTempUploadPath('futurePlans/video/file.mp4')).toBe(false);
    expect(isTempUploadPath('rulesAndAgreements/videos/file.mp4')).toBe(false);
  });

  it('returns false for edge cases', () => {
    expect(isTempUploadPath('')).toBe(false);
    expect(isTempUploadPath('uploads/')).toBe(false);
    expect(isTempUploadPath('uploads/a/b')).toBe(false);
    expect(isTempUploadPath('uploads/a/b/c/d')).toBe(false);
    expect(isTempUploadPath('uploads//b/c')).toBe(false);
    expect(isTempUploadPath('foo/uploads/a/b/c')).toBe(false);
  });
});

describe('extractFileIdFromTempPath', () => {
  it('returns the file id for valid temp paths', () => {
    expect(extractFileIdFromTempPath('uploads/profile-picture/user_abc/file_1')).toBe('file_1');
    expect(extractFileIdFromTempPath('uploads/streetz/user_xyz/some-uuid')).toBe('some-uuid');
  });

  it('returns null for finalized storage paths', () => {
    expect(extractFileIdFromTempPath('userProfiles/userId/profile-picture/file.jpg')).toBeNull();
    expect(extractFileIdFromTempPath('streetzFeed/userId/postId/file.jpg')).toBeNull();
    expect(extractFileIdFromTempPath('allProjects/projectId/files/file.jpg')).toBeNull();
    expect(extractFileIdFromTempPath('jobListings/jobId/file.jpg')).toBeNull();
    expect(extractFileIdFromTempPath('opportunityBoard/oppId/video/file.mp4')).toBeNull();
    expect(extractFileIdFromTempPath('messageAttachments/userId/convoId/file.jpg')).toBeNull();
    expect(extractFileIdFromTempPath('rejected/userId/file.jpg')).toBeNull();
    expect(extractFileIdFromTempPath('__public__/file.jpg')).toBeNull();
    expect(extractFileIdFromTempPath('contentLibrary/libId/sub/file.jpg')).toBeNull();
    expect(extractFileIdFromTempPath('futurePlans/video/file.mp4')).toBeNull();
    expect(extractFileIdFromTempPath('rulesAndAgreements/videos/file.mp4')).toBeNull();
  });

  it('returns null for edge cases', () => {
    expect(extractFileIdFromTempPath('')).toBeNull();
    expect(extractFileIdFromTempPath('uploads/')).toBeNull();
    expect(extractFileIdFromTempPath('uploads/a/b')).toBeNull();
    expect(extractFileIdFromTempPath('uploads/a/b/c/d')).toBeNull();
    expect(extractFileIdFromTempPath('uploads//b/c')).toBeNull();
    expect(extractFileIdFromTempPath('foo/uploads/a/b/c')).toBeNull();
  });
});
