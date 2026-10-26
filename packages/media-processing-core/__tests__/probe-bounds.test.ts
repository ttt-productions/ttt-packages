import { describe, it, expect, vi, afterEach } from 'vitest';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { probeVideo } from '../src/video/probe.js';
import { probeAudio } from '../src/audio/probe.js';
import { processVideo } from '../src/video/video-processor.js';
import { processAudio } from '../src/audio/audio-processor.js';
import { DEFAULT_PROBE_TIMEOUT_MS } from '../src/video/ffmpeg.js';
import { exitingChild, hangingChild } from './helpers/piped-child.js';

const spawnMock = vi.hoisted(() =>
  vi.fn<typeof import('../src/video/spawn-piped.js').spawnPiped>(),
);
vi.mock('../src/video/spawn-piped.js', async () => {
  const { stubModule } = await import('../../../test/typed-mock.js');
  return stubModule<typeof import('../src/video/spawn-piped.js')>({ spawnPiped: spawnMock });
});

function routeSpawn(probe: ReturnType<typeof hangingChild>) {
  spawnMock.mockImplementation((cmd, args) =>
    cmd === 'ffmpeg' && args[0] === '-version'
      ? exitingChild('ffmpeg version test\n', 0, null)
      : probe,
  );
}

afterEach(() => {
  vi.useRealTimers();
  spawnMock.mockReset();
});

describe("the processors' ffprobe calls are bounded and fail closed", () => {
  for (const [name, probe] of [
    ['probeVideo', probeVideo],
    ['probeAudio', probeAudio],
  ] as const) {
    it(`${name} kills an ffprobe that outlives the probe timeout and throws`, async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      const child = hangingChild();
      routeSpawn(child);
      const result = probe('in.media').then(
        () => 'resolved',
        () => 'threw',
      );
      await vi.advanceTimersByTimeAsync(DEFAULT_PROBE_TIMEOUT_MS - 1);
      expect(child.kill).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      expect(child.kill).toHaveBeenCalled();
      expect(await result).toBe('threw');
    });

    it(`${name} kills ffprobe on abort and throws`, async () => {
      const child = hangingChild();
      routeSpawn(child);
      const controller = new AbortController();
      const result = probe('in.media', { signal: controller.signal }).then(
        () => 'resolved',
        () => 'threw',
      );
      controller.abort();
      expect(await result).toBe('threw');
      expect(child.kill).toHaveBeenCalled();
    });
  }

  it('a processor aborted during its probe reports processing_canceled and produces nothing', async () => {
    const out = (name: string) => path.join(tmpdir(), 'mpc-probe-bounds', name);
    for (const run of [
      (signal: AbortSignal) =>
        processVideo(
          { kind: 'video', maxDurationSec: 60 },
          { inputPath: 'in.webm', outputBasePath: out('v') },
          { signal },
        ),
      (signal: AbortSignal) =>
        processAudio(
          { kind: 'audio', maxDurationSec: 60 },
          { inputPath: 'in.webm', outputBasePath: out('a') },
          { signal },
        ),
    ]) {
      const child = hangingChild();
      routeSpawn(child);
      const controller = new AbortController();
      const pending = run(controller.signal);
      await vi.waitFor(() =>
        expect(spawnMock).toHaveBeenCalledWith('ffprobe', expect.anything(), undefined),
      );
      controller.abort();
      const r = await pending;
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.code).toBe('processing_canceled');
      expect(child.kill).toHaveBeenCalled();
    }
  });
});
