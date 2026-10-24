import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from 'vitest';
import { validateMediaDuration } from '../src/lib/validate-media-duration.js';

function makeFakeMediaEl(
  duration: number,
  shouldError = false,
  opts: { seekRevealsDuration?: number } = {},
) {
  const el = document.createElement('video');
  let currentDuration = duration;
  let currentTime = 0;
  let src = '';
  Object.defineProperties(el, {
    duration: { configurable: true, get: () => currentDuration },
    currentTime: {
      configurable: true,
      get: () => currentTime,
      set(v: number) {
        currentTime = v;
        if (v > 0 && opts.seekRevealsDuration !== undefined) {
          currentDuration = opts.seekRevealsDuration;
          queueMicrotask(() => {
            el.dispatchEvent(new Event('durationchange'));
          });
        }
      },
    },
    src: {
      configurable: true,
      get: () => src,
      set(v: string) {
        src = v;
        queueMicrotask(() => {
          el.dispatchEvent(new Event(shouldError ? 'error' : 'loadedmetadata'));
        });
      },
    },
  });
  return el;
}

describe('validateMediaDuration', () => {
  let createElementSpy: MockInstance;
  let lastCreatedEl: HTMLVideoElement;

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

  function stubCreateElement(
    duration: number,
    shouldError = false,
    opts: { seekRevealsDuration?: number } = {},
  ) {
    lastCreatedEl = makeFakeMediaEl(duration, shouldError, opts);
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
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fake');
  });

  it('accepts a recording whose Infinity metadata resolves to a short real duration', async () => {
    stubCreateElement(Infinity, false, { seekRevealsDuration: 5 });
    const file = new File([''], 'rec.webm', { type: 'audio/webm' });
    await expect(validateMediaDuration(file, 60)).resolves.toBe(true);
  });

  it('still rejects a recording whose Infinity metadata resolves OVER the cap', async () => {
    stubCreateElement(Infinity, false, { seekRevealsDuration: 90 });
    const file = new File([''], 'rec.webm', { type: 'video/webm' });
    await expect(validateMediaDuration(file, 60)).resolves.toBe(false);
  });

  it('fails open when the duration stays unresolvable after the workaround', async () => {
    vi.useFakeTimers();
    try {
      stubCreateElement(Infinity);
      const file = new File([''], 'rec.webm', { type: 'audio/webm' });
      const resultPromise = validateMediaDuration(file, 60);
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(3_000);
      await expect(resultPromise).resolves.toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
