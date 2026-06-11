// Locked ordering: output moderation runs on LOCAL processed paths BEFORE any
// final persistence, so rejected output never reaches the final store.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { MediaProcessingSpec } from '@ttt-productions/media-schemas';
import type { MediaIO } from '../src/io/types.js';
import type { ModerationAdapter } from '../src/moderation/types.js';

const processMediaMock = vi.fn();
vi.mock('../src/process-media.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/process-media.js')>();
  return { ...actual, processMedia: (...args: unknown[]) => processMediaMock(...args) };
});

const { runMediaPipeline } = await import('../src/run-pipeline.js');

const spec = { kind: 'image', image: { variants: [{ key: 'main' }] } } as unknown as MediaProcessingSpec;

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
    // Moderation saw the LOCAL path and ran before any persistence.
    expect(events[0]).toBe(`moderate:${localOut}`);
    expect(events[1]).toBe('persist:main');
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
