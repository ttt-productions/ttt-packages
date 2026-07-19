import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from 'vitest';
import { validateMediaDuration } from '../src/lib/validate-media-duration';

function makeFakeMediaEl(
  duration: number,
  shouldError = false,
  opts: { seekRevealsDuration?: number } = {},
) {
  const listeners = new Map<string, Set<() => void>>();
  const el: any = {
    preload: '',
    src: '',
    duration,
    currentTime: 0,
    onloadedmetadata: null,
    onerror: null,
    addEventListener: (type: string, fn: () => void) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(fn);
    },
    removeEventListener: (type: string, fn: () => void) => {
      listeners.get(type)?.delete(fn);
    },
  };
  // The Chromium MediaRecorder-blob workaround seeks far past the end; a fake
  // configured with `seekRevealsDuration` then learns the real duration and
  // fires durationchange (mirroring real engine behavior).
  Object.defineProperty(el, 'currentTime', {
    set(v: number) {
      el._currentTime = v;
      if (v > 0 && opts.seekRevealsDuration !== undefined) {
        el.duration = opts.seekRevealsDuration;
        queueMicrotask(() => {
          for (const fn of listeners.get('durationchange') ?? []) fn();
        });
      }
    },
    get() {
      return el._currentTime ?? 0;
    },
  });
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
    expect((globalThis as any).URL.revokeObjectURL).toHaveBeenCalledWith('blob:fake');
  });

  // Chromium MediaRecorder blobs report duration Infinity at loadedmetadata —
  // the regression that falsely rejected a 5s recording as "over 60s"
  // (live 2026-07-19). The seek workaround must learn the REAL duration.
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
      stubCreateElement(Infinity); // no seekRevealsDuration — durationchange never fires
      const file = new File([''], 'rec.webm', { type: 'audio/webm' });
      const resultPromise = validateMediaDuration(file, 60);
      // Flush the microtask that fires onloadedmetadata, then the workaround timeout.
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(3_000);
      await expect(resultPromise).resolves.toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
