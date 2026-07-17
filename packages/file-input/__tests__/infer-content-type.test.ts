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

  it('strips codec parameters and returns the parameter-less base type', () => {
    // Chrome MediaRecorder's default audio container — the recorded-audio defect.
    expect(inferContentType(makeFile('recording.webm', 'audio/webm;codecs=opus'))).toBe('audio/webm');
    expect(inferContentType(makeFile('x.mp4', 'video/mp4;codecs=avc1.42e01e,mp4a.40.2'))).toBe('video/mp4');
    // Whitespace around the base or parameters is tolerated.
    expect(inferContentType(makeFile('recording.webm', 'audio/webm ; codecs=opus'))).toBe('audio/webm');
  });

  it('parameterized types still respect the fallbackKind match', () => {
    expect(inferContentType(makeFile('recording.webm', 'audio/webm;codecs=opus'), 'audio')).toBe('audio/webm');
    expect(inferContentType(makeFile('recording.m4a', 'audio/mp4;codecs=mp4a.40.2'), 'audio')).toBe('audio/mp4');
  });

  it('rejects a type whose base is not a media MIME even with parameters', () => {
    expect(inferContentType(makeFile('x.png', 'application/octet-stream;foo=bar'))).toBe('image/png');
    expect(inferContentType(makeFile('x.wav', 'text/plain;charset=utf-8'))).toBe('audio/wav');
  });

  it('empty type with chosen kind audio and a .webm name infers audio/webm (ambiguous container)', () => {
    expect(inferContentType(makeFile('recording.webm', ''), 'audio')).toBe('audio/webm');
  });

  it('resolves ambiguous containers (webm/ogg) by the chosen kind', () => {
    expect(inferContentType(makeFile('clip.webm', ''), 'video')).toBe('video/webm');
    expect(inferContentType(makeFile('clip.ogg', ''), 'video')).toBe('video/ogg');
    expect(inferContentType(makeFile('clip.ogg', ''), 'audio')).toBe('audio/ogg');
  });

  it('keeps the historical single-kind guess for ambiguous containers when no kind is supplied', () => {
    expect(inferContentType(makeFile('clip.webm', ''))).toBe('video/webm');
    expect(inferContentType(makeFile('clip.ogg', ''))).toBe('audio/ogg');
  });

  it('conflicting video/* type on a chosen-audio recording: chosen kind wins via the ambiguous container', () => {
    expect(inferContentType(makeFile('recording.webm', 'video/webm'), 'audio')).toBe('audio/webm');
    expect(inferContentType(makeFile('recording.ogg', 'video/ogg;codecs=theora'), 'audio')).toBe('audio/ogg');
  });

  it('a declared type that MATCHES the chosen kind wins over the extension (current behavior preserved)', () => {
    expect(inferContentType(makeFile('x.mp3', 'video/mp4'), 'video')).toBe('video/mp4');
  });

  it('conflicting type with an unambiguous extension: the extension supplies the in-kind resolution', () => {
    // Chosen kind audio distrusts the declared video/mp4; mp3 is audio-only.
    expect(inferContentType(makeFile('x.mp3', 'video/mp4'), 'audio')).toBe('audio/mpeg');
  });

  it('conflicting type with no usable extension falls back to the chosen-kind default', () => {
    expect(inferContentType(makeFile('recording', 'video/mp4'), 'audio')).toBe('audio/webm');
  });

  it('unambiguous extensions are unchanged when a matching or unrelated kind is supplied', () => {
    expect(inferContentType(makeFile('x.mp3', ''), 'audio')).toBe('audio/mpeg');
    expect(inferContentType(makeFile('x.mp4', ''), 'video')).toBe('video/mp4');
    expect(inferContentType(makeFile('x.mov', ''), 'video')).toBe('video/quicktime');
    expect(inferContentType(makeFile('x.m4a', ''), 'audio')).toBe('audio/mp4');
  });

  it('an audio recording misreported as video/mp4 but named .m4a resolves to audio/mp4', () => {
    // The mp4 container is audio-only-capable (.m4a). The RecordDialog names an
    // audio-only recording `.m4a`; a surprising video/mp4 mimeType is distrusted
    // (kind mismatch) and the .m4a extension supplies the in-kind audio/mp4. This
    // is the contract the recorder relies on for its video/mp4 defensive case.
    expect(inferContentType(makeFile('recording.m4a', 'video/mp4'), 'audio')).toBe('audio/mp4');
  });

  it('a user-picked .mp4 with no chosen kind is still trusted as video/mp4 (scope guard)', () => {
    // Only the recorder knows a stream is audio-only; an arbitrary .mp4 pick (no
    // fallbackKind) must NOT be reinterpreted as audio.
    expect(inferContentType(makeFile('clip.mp4', 'video/mp4'))).toBe('video/mp4');
    expect(inferContentType(makeFile('clip.mp4', ''))).toBe('video/mp4');
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

  it('wraps a parameterized recorded-audio type into the parameter-less base (audio/webm;codecs=opus → audio/webm)', () => {
    const f = makeFile('recording.webm', 'audio/webm;codecs=opus');
    const wrapped = ensureFileWithContentType(f, 'audio');
    expect(wrapped).not.toBe(f);
    expect(wrapped.type).toBe('audio/webm');
    expect(wrapped.name).toBe('recording.webm');
  });

  it('wraps a conflicting video/* type on a chosen-audio recording into audio/webm', () => {
    const f = makeFile('recording.webm', 'video/webm');
    const wrapped = ensureFileWithContentType(f, 'audio');
    expect(wrapped.type).toBe('audio/webm');
  });

  it('returns the same File when the type already equals the normalized base', () => {
    const f = makeFile('recording.webm', 'audio/webm');
    expect(ensureFileWithContentType(f, 'audio')).toBe(f);
  });

  it('wraps a conflicting video/mp4 type on a chosen-audio .m4a recording into audio/mp4', () => {
    const f = makeFile('recording.m4a', 'video/mp4');
    const wrapped = ensureFileWithContentType(f, 'audio');
    expect(wrapped).not.toBe(f);
    expect(wrapped.type).toBe('audio/mp4');
    expect(wrapped.name).toBe('recording.m4a');
  });
});
