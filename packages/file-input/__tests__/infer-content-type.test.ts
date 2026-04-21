import { describe, it, expect } from 'vitest';
import { inferContentType, ensureFileWithContentType } from '../src/lib/infer-content-type';

function makeFile(name: string, type: string): File {
  return new File([new Uint8Array([0])], name, { type });
}

describe('inferContentType', () => {
  it('returns file.type when valid', () => {
    expect(inferContentType(makeFile('x.jpg', 'image/jpeg'))).toBe('image/jpeg');
    expect(inferContentType(makeFile('x.mp4', 'video/mp4'))).toBe('video/mp4');
    expect(inferContentType(makeFile('x.webm', 'audio/webm'))).toBe('audio/webm');
  });

  it('lowercases file.type when valid', () => {
    expect(inferContentType(makeFile('x.jpg', 'IMAGE/JPEG'))).toBe('image/jpeg');
  });

  it('ignores application/octet-stream and falls back to extension', () => {
    expect(inferContentType(makeFile('x.png', 'application/octet-stream'))).toBe('image/png');
  });

  it('infers from extension when type is empty', () => {
    expect(inferContentType(makeFile('x.jpg', ''))).toBe('image/jpeg');
    expect(inferContentType(makeFile('x.jpeg', ''))).toBe('image/jpeg');
    expect(inferContentType(makeFile('x.png', ''))).toBe('image/png');
    expect(inferContentType(makeFile('x.webp', ''))).toBe('image/webp');
    expect(inferContentType(makeFile('x.mp4', ''))).toBe('video/mp4');
    expect(inferContentType(makeFile('x.mov', ''))).toBe('video/quicktime');
    expect(inferContentType(makeFile('x.webm', ''))).toBe('video/webm');
    expect(inferContentType(makeFile('x.mp3', ''))).toBe('audio/mpeg');
    expect(inferContentType(makeFile('x.wav', ''))).toBe('audio/wav');
  });

  it('infers from extension case-insensitively', () => {
    expect(inferContentType(makeFile('x.JPG', ''))).toBe('image/jpeg');
    expect(inferContentType(makeFile('photo.PNG', ''))).toBe('image/png');
  });

  it('falls back to kind default when extension is unknown', () => {
    expect(inferContentType(makeFile('noext', ''), 'image')).toBe('image/jpeg');
    expect(inferContentType(makeFile('noext', ''), 'video')).toBe('video/webm');
    expect(inferContentType(makeFile('noext', ''), 'audio')).toBe('audio/webm');
  });

  it('falls back to image/jpeg when no fallbackKind and no extension', () => {
    expect(inferContentType(makeFile('noext', ''))).toBe('image/jpeg');
  });

  it('handles files with no extension at all', () => {
    expect(inferContentType(makeFile('recording', ''), 'audio')).toBe('audio/webm');
  });
});

describe('ensureFileWithContentType', () => {
  it('returns the same File when type is already valid', () => {
    const f = makeFile('x.jpg', 'image/jpeg');
    expect(ensureFileWithContentType(f)).toBe(f);
  });

  it('wraps the file when type is empty', () => {
    const f = makeFile('x.jpg', '');
    const wrapped = ensureFileWithContentType(f);
    expect(wrapped).not.toBe(f);
    expect(wrapped.type).toBe('image/jpeg');
    expect(wrapped.name).toBe('x.jpg');
  });

  it('wraps the file when type is application/octet-stream', () => {
    const f = makeFile('x.mp4', 'application/octet-stream');
    const wrapped = ensureFileWithContentType(f);
    expect(wrapped.type).toBe('video/mp4');
  });

  it('preserves lastModified when wrapping', () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const f = new File([bytes], 'x.png', { type: '', lastModified: 12345 });
    const wrapped = ensureFileWithContentType(f);
    expect(wrapped.lastModified).toBe(12345);
  });

  it('uses fallbackKind when extension is unknown', () => {
    const f = makeFile('mystery', '');
    const wrapped = ensureFileWithContentType(f, 'video');
    expect(wrapped.type).toBe('video/webm');
  });
});
