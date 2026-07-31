import { describe, it, expect, vi } from 'vitest';
import { uploadFileResumable } from '../src/storage/upload.js';
import { UploadError } from '../src/storage/upload-error.js';

// The byte transfer itself is not under test — reject at the ref step so each
// call exits immediately after the contentType gate (the subject).
vi.mock('firebase/storage', () => ({
  ref: () => {
    throw new Error('gate-passed');
  },
  uploadBytesResumable: vi.fn(),
}));

const base = {
  storage: {} as any,
  path: 'uploads/x/u/p',
  file: new File(['x'], 'f'),
};

async function outcome(metadata: { contentType: string }, allowNeutralContentType?: boolean) {
  try {
    await uploadFileResumable({ ...base, metadata, ...(allowNeutralContentType ? { allowNeutralContentType } : {}) } as any);
    return 'resolved';
  } catch (e) {
    if (e instanceof UploadError) return `upload-error:${e.code}`;
    return (e as Error).message; // 'gate-passed' = the contentType gate accepted it
  }
}

describe('uploadFileResumable neutral content-type opt-in (canonical-upload-content-classification)', () => {
  it('DEFAULT is unchanged: octet-stream rejects without the opt-in', async () => {
    expect(await outcome({ contentType: 'application/octet-stream' })).toBe('upload-error:invalid_content_type');
  });

  it('octet-stream passes the gate ONLY with the explicit opt-in', async () => {
    expect(await outcome({ contentType: 'application/octet-stream' }, true)).toBe('gate-passed');
  });

  it('the opt-in permits ONLY the one neutral value — arbitrary types still reject', async () => {
    expect(await outcome({ contentType: 'application/pdf' }, true)).toBe('upload-error:invalid_content_type');
    expect(await outcome({ contentType: 'text/html' }, true)).toBe('upload-error:invalid_content_type');
  });

  it('a concrete media MIME still passes with or without the opt-in', async () => {
    expect(await outcome({ contentType: 'audio/webm' })).toBe('gate-passed');
    expect(await outcome({ contentType: 'audio/webm' }, true)).toBe('gate-passed');
  });

  it('a missing contentType still rejects regardless of the opt-in', async () => {
    expect(await outcome({ contentType: '' }, true)).toBe('upload-error:missing_content_type');
  });
});
