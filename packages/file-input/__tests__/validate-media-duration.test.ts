import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from 'vitest';
import { validateMediaDuration } from '../src/lib/validate-media-duration';

function makeFakeMediaEl(duration: number, shouldError = false) {
  const el: any = {
    preload: '',
    src: '',
    duration,
    onloadedmetadata: null,
    onerror: null,
  };
  Object.defineProperty(el, 'src', {
    set(v: string) {
      Object.defineProperty(el, '_src', { value: v, writable: true, configurable: true });
      queueMicrotask(() => {
        if (shouldError) {
          el.onerror?.();
        } else {
          el.onloadedmetadata?.();
        }
      });
    },
    get() {
      return el._src;
    },
  });
  return el;
}

describe('validateMediaDuration', () => {
  let createElementSpy: MockInstance;
  let lastCreatedEl: any;

  beforeEach(() => {
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:fake'),
      revokeObjectURL: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function stubCreateElement(duration: number, shouldError = false) {
    lastCreatedEl = makeFakeMediaEl(duration, shouldError);
    createElementSpy = vi.spyOn(document, 'createElement').mockImplementation(() => lastCreatedEl);
  }

  it('returns true when video duration is under max', async () => {
    stubCreateElement(30);
    const file = new File([''], 'v.mp4', { type: 'video/mp4' });
    await expect(validateMediaDuration(file, 60)).resolves.toBe(true);
    expect(createElementSpy).toHaveBeenCalledWith('video');
  });

  it('returns false when video duration exceeds max', async () => {
    stubCreateElement(90);
    const file = new File([''], 'v.mp4', { type: 'video/mp4' });
    await expect(validateMediaDuration(file, 60)).resolves.toBe(false);
  });

  it('returns true when video duration equals max (inclusive boundary)', async () => {
    stubCreateElement(60);
    const file = new File([''], 'v.mp4', { type: 'video/mp4' });
    await expect(validateMediaDuration(file, 60)).resolves.toBe(true);
  });

  it('returns true when audio duration is under max', async () => {
    stubCreateElement(10);
    const file = new File([''], 'a.mp3', { type: 'audio/mpeg' });
    await expect(validateMediaDuration(file, 30)).resolves.toBe(true);
    expect(createElementSpy).toHaveBeenCalledWith('audio');
  });

  it('returns false when audio duration exceeds max', async () => {
    stubCreateElement(40);
    const file = new File([''], 'a.mp3', { type: 'audio/mpeg' });
    await expect(validateMediaDuration(file, 30)).resolves.toBe(false);
  });

  it('fails open (returns true) when metadata fails to load', async () => {
    stubCreateElement(0, true);
    const file = new File([''], 'broken.mp4', { type: 'video/mp4' });
    await expect(validateMediaDuration(file, 30)).resolves.toBe(true);
  });

  it('revokes the object URL after loading metadata', async () => {
    stubCreateElement(20);
    const file = new File([''], 'v.mp4', { type: 'video/mp4' });
    await validateMediaDuration(file, 60);
    expect((globalThis as any).URL.revokeObjectURL).toHaveBeenCalledWith('blob:fake');
  });
});
