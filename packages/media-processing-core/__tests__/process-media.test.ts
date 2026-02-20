import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/image/image-processor.js', () => ({
  processImage: vi.fn(),
}));
vi.mock('../src/video/video-processor.js', () => ({
  processVideo: vi.fn(),
}));
vi.mock('../src/audio/audio-processor.js', () => ({
  processAudio: vi.fn(),
}));

import { processMedia } from '../src/process-media';
import { processImage } from '../src/image/image-processor.js';
import { processVideo } from '../src/video/video-processor.js';
import { processAudio } from '../src/audio/audio-processor.js';
import type { ProcessMediaContext } from '../src/types';

const mockContext: ProcessMediaContext = {
  io: {
    input: { readToFile: vi.fn() },
    output: { writeFromFile: vi.fn() },
  },
};

const imageResult = { ok: true as const, mediaType: 'image' as const, outputs: [] };
const videoResult = { ok: true as const, mediaType: 'video' as const, outputs: [] };
const audioResult = { ok: true as const, mediaType: 'audio' as const, outputs: [] };

describe('processMedia', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(processImage).mockResolvedValue(imageResult as any);
    vi.mocked(processVideo).mockResolvedValue(videoResult as any);
    vi.mocked(processAudio).mockResolvedValue(audioResult as any);
  });

  it('calls processImage for kind="image"', async () => {
    const spec = { kind: 'image' as const, outputs: [] } as any;
    await processMedia(spec, mockContext);
    expect(processImage).toHaveBeenCalledWith(spec, mockContext, undefined);
  });

  it('returns processImage result for kind="image"', async () => {
    const spec = { kind: 'image' as const, outputs: [] } as any;
    const result = await processMedia(spec, mockContext);
    expect(result).toBe(imageResult);
  });

  it('calls processVideo for kind="video"', async () => {
    const spec = { kind: 'video' as const, outputs: [] } as any;
    await processMedia(spec, mockContext);
    expect(processVideo).toHaveBeenCalledWith(spec, mockContext, undefined);
  });

  it('returns processVideo result for kind="video"', async () => {
    const spec = { kind: 'video' as const, outputs: [] } as any;
    const result = await processMedia(spec, mockContext);
    expect(result).toBe(videoResult);
  });

  it('calls processAudio for kind="audio"', async () => {
    const spec = { kind: 'audio' as const, outputs: [] } as any;
    await processMedia(spec, mockContext);
    expect(processAudio).toHaveBeenCalledWith(spec, mockContext, undefined);
  });

  it('returns processAudio result for kind="audio"', async () => {
    const spec = { kind: 'audio' as const, outputs: [] } as any;
    const result = await processMedia(spec, mockContext);
    expect(result).toBe(audioResult);
  });

  it('returns error result with code "processing_failed" for kind="generic"', async () => {
    const spec = { kind: 'generic' as const } as any;
    const result = await processMedia(spec, mockContext);
    expect(result.ok).toBe(false);
    expect((result as any).error.code).toBe('processing_failed');
  });

  it('does not call processImage/processVideo/processAudio for kind="generic"', async () => {
    const spec = { kind: 'generic' as const } as any;
    await processMedia(spec, mockContext);
    expect(processImage).not.toHaveBeenCalled();
    expect(processVideo).not.toHaveBeenCalled();
    expect(processAudio).not.toHaveBeenCalled();
  });

  it('passes opts through to the processor', async () => {
    const spec = { kind: 'image' as const, outputs: [] } as any;
    const opts = { onProgress: vi.fn() };
    await processMedia(spec, mockContext, opts as any);
    expect(processImage).toHaveBeenCalledWith(spec, mockContext, opts);
  });
});
