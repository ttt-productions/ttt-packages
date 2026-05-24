import { describe, it, expect, vi } from 'vitest';
import type { MediaProcessingResult, MediaProcessingSpec } from '@ttt-productions/media-schemas';
import {
  processMedia,
  defaultMediaProcessors,
} from '../src/process-media';
import { processImage } from '../src/image/image-processor.js';
import { processVideo } from '../src/video/video-processor.js';
import { processAudio } from '../src/audio/audio-processor.js';
import type {
  MediaProcessors,
  ProcessMediaContext,
  ProcessMediaOptions,
} from '../src/types';

const ctx: ProcessMediaContext = {
  inputPath: '/tmp/in',
  outputBasePath: '/tmp/out',
};

const imageResult: MediaProcessingResult = {
  ok: true,
  mediaType: 'image',
  outputs: [],
};
const videoResult: MediaProcessingResult = {
  ok: true,
  mediaType: 'video',
  outputs: [],
};
const audioResult: MediaProcessingResult = {
  ok: true,
  mediaType: 'audio',
  outputs: [],
};

interface RecordedCall {
  spec: MediaProcessingSpec;
  ctx: ProcessMediaContext;
  opts: ProcessMediaOptions | undefined;
}

function makeFakeProcessors(): {
  processors: MediaProcessors;
  calls: { image: RecordedCall[]; video: RecordedCall[]; audio: RecordedCall[] };
} {
  const calls = { image: [] as RecordedCall[], video: [] as RecordedCall[], audio: [] as RecordedCall[] };
  const processors: MediaProcessors = {
    image: async (spec, c, opts) => {
      calls.image.push({ spec, ctx: c, opts });
      return imageResult;
    },
    video: async (spec, c, opts) => {
      calls.video.push({ spec, ctx: c, opts });
      return videoResult;
    },
    audio: async (spec, c, opts) => {
      calls.audio.push({ spec, ctx: c, opts });
      return audioResult;
    },
  };
  return { processors, calls };
}

describe('processMedia — routing with injected processors', () => {
  it('routes kind="image" to the injected image processor and returns its result', async () => {
    const { processors, calls } = makeFakeProcessors();
    const spec = { kind: 'image' as const, outputs: [] } as unknown as MediaProcessingSpec;
    const result = await processMedia(spec, ctx, undefined, processors);
    expect(result).toBe(imageResult);
    expect(calls.image).toHaveLength(1);
    expect(calls.video).toHaveLength(0);
    expect(calls.audio).toHaveLength(0);
    expect(calls.image[0].spec).toBe(spec);
    expect(calls.image[0].ctx).toBe(ctx);
    expect(calls.image[0].opts).toBeUndefined();
  });

  it('routes kind="video" to the injected video processor and returns its result', async () => {
    const { processors, calls } = makeFakeProcessors();
    const spec = { kind: 'video' as const, outputs: [] } as unknown as MediaProcessingSpec;
    const result = await processMedia(spec, ctx, undefined, processors);
    expect(result).toBe(videoResult);
    expect(calls.video).toHaveLength(1);
    expect(calls.image).toHaveLength(0);
    expect(calls.audio).toHaveLength(0);
    expect(calls.video[0].spec).toBe(spec);
  });

  it('routes kind="audio" to the injected audio processor and returns its result', async () => {
    const { processors, calls } = makeFakeProcessors();
    const spec = { kind: 'audio' as const, outputs: [] } as unknown as MediaProcessingSpec;
    const result = await processMedia(spec, ctx, undefined, processors);
    expect(result).toBe(audioResult);
    expect(calls.audio).toHaveLength(1);
    expect(calls.image).toHaveLength(0);
    expect(calls.video).toHaveLength(0);
  });

  it('forwards opts to the chosen processor unchanged', async () => {
    const { processors, calls } = makeFakeProcessors();
    const opts: ProcessMediaOptions = { onProgress: vi.fn() };
    const spec = { kind: 'image' as const, outputs: [] } as unknown as MediaProcessingSpec;
    await processMedia(spec, ctx, opts, processors);
    expect(calls.image[0].opts).toBe(opts);
  });

  it('forwards ctx to the chosen processor unchanged', async () => {
    const { processors, calls } = makeFakeProcessors();
    const localCtx: ProcessMediaContext = { inputPath: '/x', outputBasePath: '/y', inputMime: 'image/png' };
    const spec = { kind: 'image' as const, outputs: [] } as unknown as MediaProcessingSpec;
    await processMedia(spec, localCtx, undefined, processors);
    expect(calls.image[0].ctx).toBe(localCtx);
  });

  it('propagates the processor\'s rejection when the processor throws', async () => {
    const boom = new Error('boom');
    const processors: MediaProcessors = {
      image: async () => {
        throw boom;
      },
      video: async () => videoResult,
      audio: async () => audioResult,
    };
    const spec = { kind: 'image' as const, outputs: [] } as unknown as MediaProcessingSpec;
    await expect(processMedia(spec, ctx, undefined, processors)).rejects.toBe(boom);
  });
});

describe('processMedia — generic branch', () => {
  it('returns a fully-shaped processing_failed error for kind="generic"', async () => {
    const { processors, calls } = makeFakeProcessors();
    const spec = { kind: 'generic' as const } as unknown as MediaProcessingSpec;
    const result = await processMedia(spec, ctx, undefined, processors);
    expect(result).toEqual({
      ok: false,
      mediaType: 'other',
      error: { code: 'processing_failed', message: 'Generic processing not implemented yet.' },
    });
    expect(calls.image).toHaveLength(0);
    expect(calls.video).toHaveLength(0);
    expect(calls.audio).toHaveLength(0);
  });

  it('returns the generic-branch error even when processors arg is omitted', async () => {
    const spec = { kind: 'generic' as const } as unknown as MediaProcessingSpec;
    const result = await processMedia(spec, ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.mediaType).toBe('other');
      expect(result.error!.code).toBe('processing_failed');
    }
  });
});

describe('defaultMediaProcessors', () => {
  it('exposes the real image processor as default', () => {
    expect(defaultMediaProcessors.image).toBe(processImage);
  });

  it('exposes the real video processor as default', () => {
    expect(defaultMediaProcessors.video).toBe(processVideo);
  });

  it('exposes the real audio processor as default', () => {
    expect(defaultMediaProcessors.audio).toBe(processAudio);
  });
});
