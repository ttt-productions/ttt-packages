import { describe, it, expect, vi } from 'vitest';
import { validateAndNormalizeUploadFile } from '../src/lib/validate-upload-kind.js';

function makeFile(name: string, type: string, sizeBytes = 1024): File {
  const blob = new Blob([new Uint8Array(sizeBytes)], { type });
  return new File([blob], name, { type });
}

describe('validateAndNormalizeUploadFile', () => {
  it('returns a file when kind is detectable and matches expected', () => {
    const f = makeFile('a.jpg', 'image/jpeg');
    const result = validateAndNormalizeUploadFile(f, 'test-origin', 'image');
    expect(result).toBeInstanceOf(File);
    expect(result.type.startsWith('image/')).toBe(true);
  });

  it('accepts expected: "any" for any detectable kind', () => {
    const f = makeFile('a.mp4', 'video/mp4');
    const result = validateAndNormalizeUploadFile(f, 'test-origin', 'any');
    expect(result.type.startsWith('video/')).toBe(true);
  });

  it('accepts expected: readonly array of kinds', () => {
    const f = makeFile('a.mp3', 'audio/mpeg');
    const result = validateAndNormalizeUploadFile(f, 'test-origin', ['audio', 'video'] as const);
    expect(result.type.startsWith('audio/')).toBe(true);
  });

  it('throws on undetectable kind and fires onError with upload_kind_indeterminate', () => {
    const f = makeFile('a.bin', 'application/octet-stream');
    const onError = vi.fn();
    expect(() =>
      validateAndNormalizeUploadFile(f, 'test-origin', 'image', { onError })
    ).toThrow(/Could not determine the file type/);
    expect(onError).toHaveBeenCalledWith(
      'upload_kind_indeterminate',
      expect.objectContaining({
        fileOrigin: 'test-origin',
        detectedKind: 'other',
        fileName: 'a.bin',
      })
    );
  });

  it('throws on kind mismatch and fires onError with upload_kind_mismatch', () => {
    const f = makeFile('a.mp4', 'video/mp4');
    const onError = vi.fn();
    expect(() =>
      validateAndNormalizeUploadFile(f, 'test-origin', 'image', { onError })
    ).toThrow(/This slot only accepts image files/);
    expect(onError).toHaveBeenCalledWith(
      'upload_kind_mismatch',
      expect.objectContaining({
        fileOrigin: 'test-origin',
        expectedKind: 'image',
        detectedKind: 'video',
      })
    );
  });

  it('does not throw when onError is undefined and validation passes', () => {
    const f = makeFile('a.jpg', 'image/jpeg');
    expect(() => validateAndNormalizeUploadFile(f, 'test-origin', 'image')).not.toThrow();
  });
});
