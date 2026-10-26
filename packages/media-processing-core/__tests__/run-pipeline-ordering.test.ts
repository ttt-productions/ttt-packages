import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { MediaProcessingSpec } from '@ttt-productions/media-schemas';
import type { MediaIO } from '../src/io/types.js';
import type { ModerationAdapter } from '../src/moderation/types.js';
import type { processMedia } from '../src/process-media.js';

const processMediaMock = vi.fn<typeof processMedia>();
vi.mock('../src/process-media.js', async (importOriginal) => {
  const { passThroughModule } = await import('../../../test/typed-mock.js');
  return passThroughModule<typeof import('../src/process-media.js')>(importOriginal, {
    processMedia: (...args) => processMediaMock(...args),
  });
});

const { runMediaPipeline } = await import('../src/run-pipeline.js');

const spec: MediaProcessingSpec = {
  kind: 'image',
  image: { variants: [{ key: 'main' }] },
};

async function makeLocalOutput(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'pipeline-'));
  const p = path.join(dir, 'main.jpg');
  await writeFile(p, 'processed-bytes');
  return p;
}

function makeIO(events: string[]): MediaIO {
  return {
    input: { readToFile: async () => undefined },
    output: {
      writeFromFile: async (_localPath: string, key: string) => {
        events.push(`persist:${key}`);
        return { path: `mediaAssets/a1/${key}` };
      },
    },
  };
}

beforeEach(() => {
  processMediaMock.mockReset();
});

describe('runMediaPipeline ordering', () => {
  it('runs output moderation on local paths BEFORE persisting', async () => {
    const events: string[] = [];
    const localOut = await makeLocalOutput();
    processMediaMock.mockResolvedValue({
      ok: true,
      mediaType: 'image',
      outputs: [{ key: 'main', path: localOut }],
    });
    const moderation: ModerationAdapter = {
      provider: 'test',
      moderateOutput: async ({ outputs }) => {
        events.push(`moderate:${outputs.map((o) => o.localPath).join(',')}`);
        return { status: 'passed' };
      },
    };

    const result = await runMediaPipeline({ spec, io: makeIO(events), moderation });

    expect(result.ok).toBe(true);
    expect(events[0]).toBe(`moderate:${localOut}`);
    expect(events[1]).toBe('persist:main');
  });

  it('input moderation "error" (incomplete check) fails closed — nothing transcodes or persists', async () => {
    const events: string[] = [];
    processMediaMock.mockImplementation(() => {
      events.push('transcode');
      return Promise.resolve({ ok: true, mediaType: 'image', outputs: [] });
    });
    const moderation: ModerationAdapter = {
      provider: 'test',
      moderateInput: async () => ({ status: 'error', reasons: ['quota'] }),
    };

    const result = await runMediaPipeline({ spec, io: makeIO(events), moderation });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error?.code).toBe('processing_failed');
    expect(result.moderation?.status).toBe('error');
    expect(events).not.toContain('transcode');
    expect(events.filter((e) => e.startsWith('persist:'))).toHaveLength(0);
  });

  it('output moderation "error" fails closed — nothing is persisted', async () => {
    const events: string[] = [];
    const localOut = await makeLocalOutput();
    processMediaMock.mockResolvedValue({
      ok: true,
      mediaType: 'image',
      outputs: [{ key: 'main', path: localOut }],
    });
    const moderation: ModerationAdapter = {
      provider: 'test',
      moderateOutput: async () => ({ status: 'error', reasons: ['outage'] }),
    };

    const result = await runMediaPipeline({ spec, io: makeIO(events), moderation });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error?.code).toBe('processing_failed');
    expect(result.moderation?.status).toBe('error');
    expect(events.filter((e) => e.startsWith('persist:'))).toHaveLength(0);
  });

  it('rejected output moderation means NOTHING is persisted', async () => {
    const events: string[] = [];
    const localOut = await makeLocalOutput();
    processMediaMock.mockResolvedValue({
      ok: true,
      mediaType: 'image',
      outputs: [{ key: 'main', path: localOut }],
    });
    const moderation: ModerationAdapter = {
      provider: 'test',
      moderateOutput: async () => ({ status: 'rejected', reasons: ['adult'] }),
    };

    const result = await runMediaPipeline({ spec, io: makeIO(events), moderation });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error?.code).toBe('rejected');
    expect(events.filter((e) => e.startsWith('persist:'))).toHaveLength(0);
  });
});
