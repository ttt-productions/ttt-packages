import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readMediaMeta } from '../src/lib/read-media-meta';

function stubImage(width: number, height: number, shouldError = false) {
  class FakeImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    naturalWidth = width;
    naturalHeight = height;
    _src = '';
    set src(v: string) {
      this._src = v;
      queueMicrotask(() => {
        if (shouldError) this.onerror?.();
        else this.onload?.();
      });
    }
    get src() {
      return this._src;
    }
  }
  vi.stubGlobal('Image', FakeImage);
}

function stubMediaElement(opts: {
  duration?: number;
  videoWidth?: number;
  videoHeight?: number;
  shouldError?: boolean;
}) {
  const createSpy = vi.spyOn(document, 'createElement').mockImplementation((_tag: string) => {
    const el: any = {
      preload: '',
      onloadedmetadata: null,
      onerror: null,
      duration: opts.duration ?? NaN,
      videoWidth: opts.videoWidth,
      videoHeight: opts.videoHeight,
      _src: '',
    };
    Object.defineProperty(el, 'src', {
      set(v: string) {
        el._src = v;
        queueMicrotask(() => {
          if (opts.shouldError) el.onerror?.();
          else el.onloadedmetadata?.();
        });
      },
      get() {
        return el._src;
      },
    });
    return el;
  });
  return createSpy;
}

describe('readMediaMeta', () => {
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

  describe('images', () => {
    it('returns width, height, and aspectRatio for landscape image', async () => {
      stubImage(1600, 900);
      const file = new File([''], 'p.jpg', { type: 'image/jpeg' });
      const meta = await readMediaMeta(file);
      expect(meta.kind).toBe('image');
      expect(meta.width).toBe(1600);
      expect(meta.height).toBe(900);
      expect(meta.aspectRatio).toBeCloseTo(1600 / 900);
      expect(meta.orientation).toBe('horizontal');
    });

    it('returns orientation "vertical" for portrait image', async () => {
      stubImage(600, 900);
      const file = new File([''], 'p.jpg', { type: 'image/jpeg' });
      const meta = await readMediaMeta(file);
      expect(meta.orientation).toBe('vertical');
    });

    it('returns orientation "any" for square image', async () => {
      stubImage(500, 500);
      const file = new File([''], 'p.jpg', { type: 'image/jpeg' });
      const meta = await readMediaMeta(file);
      expect(meta.orientation).toBe('any');
    });

    it('returns aspectRatio undefined when height is 0', async () => {
      stubImage(800, 0);
      const file = new File([''], 'p.jpg', { type: 'image/jpeg' });
      const meta = await readMediaMeta(file);
      expect(meta.aspectRatio).toBeUndefined();
    });

    it('returns base meta only when image fails to load', async () => {
      stubImage(0, 0, true);
      const file = new File([''], 'p.jpg', { type: 'image/jpeg' });
      const meta = await readMediaMeta(file);
      expect(meta.kind).toBe('image');
      expect(meta.width).toBeUndefined();
      expect(meta.height).toBeUndefined();
    });

    it('includes mime and sizeBytes from the file', async () => {
      stubImage(100, 100);
      const file = new File(['abc'], 'p.jpg', { type: 'image/jpeg' });
      const meta = await readMediaMeta(file);
      expect(meta.mime).toBe('image/jpeg');
      expect(meta.sizeBytes).toBe(3);
    });
  });

  describe('videos', () => {
    it('returns width, height, durationSec, aspectRatio, and orientation', async () => {
      stubMediaElement({ duration: 12.5, videoWidth: 1920, videoHeight: 1080 });
      const file = new File([''], 'v.mp4', { type: 'video/mp4' });
      const meta = await readMediaMeta(file);
      expect(meta.kind).toBe('video');
      expect(meta.durationSec).toBe(12.5);
      expect(meta.width).toBe(1920);
      expect(meta.height).toBe(1080);
      expect(meta.orientation).toBe('horizontal');
      expect(meta.aspectRatio).toBeCloseTo(1920 / 1080);
    });

    it('returns base meta only when video fails to load', async () => {
      stubMediaElement({ shouldError: true });
      const file = new File([''], 'v.mp4', { type: 'video/mp4' });
      const meta = await readMediaMeta(file);
      expect(meta.kind).toBe('video');
      expect(meta.durationSec).toBeUndefined();
      expect(meta.width).toBeUndefined();
    });
  });

  describe('audio', () => {
    it('returns only durationSec with no dimensions or orientation', async () => {
      stubMediaElement({ duration: 45 });
      const file = new File([''], 'a.mp3', { type: 'audio/mpeg' });
      const meta = await readMediaMeta(file);
      expect(meta.kind).toBe('audio');
      expect(meta.durationSec).toBe(45);
      expect(meta.width).toBeUndefined();
      expect(meta.height).toBeUndefined();
      expect(meta.orientation).toBeUndefined();
    });
  });

  describe('non-media files', () => {
    it('returns kind "file" and base meta only for unknown type', async () => {
      const file = new File(['hello'], 'doc.pdf', { type: 'application/pdf' });
      const meta = await readMediaMeta(file);
      expect(meta.kind).toBe('file');
      expect(meta.mime).toBe('application/pdf');
      expect(meta.sizeBytes).toBe(5);
      expect(meta.width).toBeUndefined();
      expect(meta.durationSec).toBeUndefined();
    });
  });
});
