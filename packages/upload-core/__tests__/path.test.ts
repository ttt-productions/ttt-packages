import { describe, it, expect, vi } from 'vitest';

vi.mock('@ttt-productions/firebase-helpers', () => ({
  joinPath: (...args: (string | number | null | undefined)[]) =>
    args
      .filter((a) => a !== null && a !== undefined)
      .map((a) => String(a).replace(/^\/+|\/+$/g, ''))
      .join('/'),
}));

import { buildUploadPath } from '../src/utils/path';

describe('buildUploadPath', () => {
  it('builds a path with all segments', () => {
    const result = buildUploadPath({
      basePath: 'uploads',
      ownerId: 'user123',
      contentId: 'post456',
      filename: 'photo.jpg',
    });
    expect(result).toBe('uploads/user123/post456/photo.jpg');
  });

  it('builds a path with only basePath', () => {
    const result = buildUploadPath({ basePath: 'uploads' });
    expect(result).toBe('uploads/file');
  });

  it('builds a path without contentId', () => {
    const result = buildUploadPath({
      basePath: 'avatars',
      ownerId: 'uid-abc',
      filename: 'avatar.png',
    });
    expect(result).toBe('avatars/uid-abc/avatar.png');
  });

  it('uses "file" as default filename when not provided', () => {
    const result = buildUploadPath({ basePath: 'uploads', ownerId: 'user1' });
    expect(result).toContain('file');
    expect(result).toContain('uploads');
  });

  it('normalizes the filename', () => {
    const result = buildUploadPath({
      basePath: 'uploads',
      filename: 'My Photo.JPG',
    });
    expect(result).toBe('uploads/my-photo.jpg');
  });

  it('sanitizes path traversal attempts in ownerId', () => {
    const result = buildUploadPath({
      basePath: 'uploads',
      ownerId: '../../../etc',
      filename: 'test.jpg',
    });
    // The sanitizer converts '/' and '\' to '_' and collapses '..', preventing traversal
    expect(result).not.toContain('../');
    expect(result).not.toContain('/../../');
  });

  it('sanitizes path traversal attempts in contentId', () => {
    const result = buildUploadPath({
      basePath: 'uploads',
      ownerId: 'user1',
      contentId: '../../admin',
      filename: 'file.jpg',
    });
    expect(result).not.toContain('../');
  });

  it('sanitizes backslashes in segments', () => {
    const result = buildUploadPath({
      basePath: 'uploads',
      ownerId: 'user\\admin',
      filename: 'test.jpg',
    });
    expect(result).not.toContain('\\');
  });

  it('limits segment length to 80 chars', () => {
    const longId = 'a'.repeat(200);
    const result = buildUploadPath({
      basePath: 'uploads',
      ownerId: longId,
      filename: 'test.jpg',
    });
    const parts = result.split('/');
    for (const part of parts) {
      expect(part.length).toBeLessThanOrEqual(80);
    }
  });

  it('filters out empty optional segments', () => {
    const result = buildUploadPath({
      basePath: 'uploads',
      ownerId: '',
      contentId: '',
      filename: 'test.jpg',
    });
    expect(result).toBe('uploads/test.jpg');
  });
});
