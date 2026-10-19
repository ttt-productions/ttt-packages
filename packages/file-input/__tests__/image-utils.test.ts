import { describe, it, expect, afterEach, vi } from 'vitest';
import { getCroppedImg } from '../src/lib/image-utils.js';

function stubImage(width: number, height: number, shouldError = false) {
  class FakeImage {
    _listeners: Record<string, Array<() => void>> = {};
    width = width;
    height = height;
    _src = '';
    addEventListener(type: string, fn: () => void) {
      (this._listeners[type] ||= []).push(fn);
    }
    setAttribute() {}
    set src(v: string) {
      this._src = v;
      queueMicrotask(() => {
        const fns = shouldError ? this._listeners['error'] : this._listeners['load'];
        fns?.forEach((fn) => fn());
      });
    }
    get src() {
      return this._src;
    }
  }
  vi.stubGlobal('Image', FakeImage);
}

type FakeCtx = {
  translate: ReturnType<typeof vi.fn>;
  rotate: ReturnType<typeof vi.fn>;
  scale: ReturnType<typeof vi.fn>;
  drawImage: ReturnType<typeof vi.fn>;
};

function makeFakeCtx(): FakeCtx {
  return {
    translate: vi.fn(),
    rotate: vi.fn(),
    scale: vi.fn(),
    drawImage: vi.fn(),
  };
}

function stubCanvas(opts: { contextReturns?: Array<FakeCtx | null>; blob?: Blob | null }) {
  let callIndex = 0;
  const canvases: any[] = [];
  const createSpy = vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    if (tag !== 'canvas') throw new Error(`unexpected createElement(${tag})`);
    const hasExplicit = opts.contextReturns !== undefined && callIndex < opts.contextReturns.length;
    const ctx = hasExplicit ? opts.contextReturns![callIndex] : makeFakeCtx();
    const canvas: any = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => ctx),
      toBlob: vi.fn((cb: (b: Blob | null) => void) => {
        cb(opts.blob === undefined ? new Blob(['x'], { type: 'image/jpeg' }) : opts.blob);
      }),
    };
    canvases.push(canvas);
    callIndex++;
    return canvas;
  });
  return { createSpy, canvases };
}

describe('getCroppedImg', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns a Blob on success', async () => {
    stubImage(1000, 1000);
    stubCanvas({});
    const blob = await getCroppedImg('blob:x', { x: 0, y: 0, width: 100, height: 100 });
    expect(blob).toBeInstanceOf(Blob);
  });

  it('returns null when the first canvas 2D context is unavailable', async () => {
    stubImage(1000, 1000);
    stubCanvas({ contextReturns: [null] });
    const blob = await getCroppedImg('blob:x', { x: 0, y: 0, width: 100, height: 100 });
    expect(blob).toBeNull();
  });

  it('returns null when the second (cropped) canvas 2D context is unavailable', async () => {
    stubImage(1000, 1000);
    stubCanvas({ contextReturns: [makeFakeCtx(), null] });
    const blob = await getCroppedImg('blob:x', { x: 0, y: 0, width: 100, height: 100 });
    expect(blob).toBeNull();
  });

  it('uses outputWidth and outputHeight overrides when provided', async () => {
    stubImage(1000, 1000);
    const { canvases } = stubCanvas({});
    await getCroppedImg(
      'blob:x',
      { x: 0, y: 0, width: 100, height: 100 },
      0,
      { horizontal: false, vertical: false },
      400,
      300,
    );
    expect(canvases[1].width).toBe(400);
    expect(canvases[1].height).toBe(300);
  });

  it('falls back to pixelCrop dimensions when no output size is provided', async () => {
    stubImage(1000, 1000);
    const { canvases } = stubCanvas({});
    await getCroppedImg('blob:x', { x: 0, y: 0, width: 250, height: 150 });
    expect(canvases[1].width).toBe(250);
    expect(canvases[1].height).toBe(150);
  });

  it('rejects when toBlob returns null', async () => {
    stubImage(1000, 1000);
    stubCanvas({ blob: null });
    await expect(getCroppedImg('blob:x', { x: 0, y: 0, width: 100, height: 100 })).rejects.toThrow(
      /Canvas to Blob conversion failed/,
    );
  });

  it('encodes at the format and quality the crop spec declares', async () => {
    stubImage(1000, 1000);
    const { canvases } = stubCanvas({});
    await getCroppedImg('blob:x', { x: 0, y: 0, width: 100, height: 100 }, 0, undefined, 512, 512, {
      format: 'jpeg',
      quality: 85,
    });
    const [, type, quality] = canvases[1].toBlob.mock.calls[0];
    expect(type).toBe('image/jpeg');
    expect(quality).toBeCloseTo(0.85);
  });

  it('encodes a declared lossless format as that format, not JPEG', async () => {
    stubImage(1000, 1000);
    const { canvases } = stubCanvas({});
    await getCroppedImg('blob:x', { x: 0, y: 0, width: 100, height: 100 }, 0, undefined, 256, 256, {
      format: 'png',
    });
    expect(canvases[1].toBlob.mock.calls[0][1]).toBe('image/png');
  });

  it('encodes JPEG at quality 80 when the spec declares no format or quality', async () => {
    stubImage(1000, 1000);
    const { canvases } = stubCanvas({});
    await getCroppedImg('blob:x', { x: 0, y: 0, width: 100, height: 100 });
    const [, type, quality] = canvases[1].toBlob.mock.calls[0];
    expect(type).toBe('image/jpeg');
    expect(quality).toBeCloseTo(0.8);
  });

  it('applies rotation to the working canvas', async () => {
    stubImage(1000, 1000);
    const ctx = makeFakeCtx();
    stubCanvas({ contextReturns: [ctx, makeFakeCtx()] });
    await getCroppedImg('blob:x', { x: 0, y: 0, width: 100, height: 100 }, 90);
    expect(ctx.rotate).toHaveBeenCalled();
    const calledWith = ctx.rotate.mock.calls[0][0];
    expect(calledWith).toBeCloseTo((90 * Math.PI) / 180);
  });

  it('applies horizontal flip via ctx.scale(-1, 1)', async () => {
    stubImage(1000, 1000);
    const ctx = makeFakeCtx();
    stubCanvas({ contextReturns: [ctx, makeFakeCtx()] });
    await getCroppedImg('blob:x', { x: 0, y: 0, width: 100, height: 100 }, 0, {
      horizontal: true,
      vertical: false,
    });
    expect(ctx.scale).toHaveBeenCalledWith(-1, 1);
  });

  it('applies vertical flip via ctx.scale(1, -1)', async () => {
    stubImage(1000, 1000);
    const ctx = makeFakeCtx();
    stubCanvas({ contextReturns: [ctx, makeFakeCtx()] });
    await getCroppedImg('blob:x', { x: 0, y: 0, width: 100, height: 100 }, 0, {
      horizontal: false,
      vertical: true,
    });
    expect(ctx.scale).toHaveBeenCalledWith(1, -1);
  });
});
