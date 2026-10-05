// The system-content upload limits are fixed across app modes at full-mode Hall Television's
// ceiling: a 30-minute video, with Hall Television's full-mode raw and processed byte caps. Each
// mode's registry is loaded with the app-mode module mocked to that mode.
import { describe, it, expect, vi, afterEach } from 'vitest';
import type { MediaOriginSpec } from '@ttt-productions/media-schemas';
import type { AppMode } from '../src/constants/app-mode';
import type { FileOrigin } from '../src/media/file-origin';

const THIRTY_MINUTES_SEC = 30 * 60;

async function specsInMode(mode: AppMode): Promise<Record<FileOrigin, MediaOriginSpec>> {
  vi.resetModules();
  vi.doMock('../src/constants/app-mode', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../src/constants/app-mode')>();
    return {
      ...actual,
      APP_MODE: mode,
      byMode: <T>(charter: T, full: T): T => (mode === 'charter' ? charter : full),
    };
  });
  const { TTT_MEDIA_SPECS } = await import('../src/media/ttt-media-specs');
  return TTT_MEDIA_SPECS;
}

afterEach(() => {
  vi.doUnmock('../src/constants/app-mode');
  vi.resetModules();
});

describe('system-content media spec', () => {
  it('loads each mode with its own mode-varied limits', async () => {
    const charter = await specsInMode('charter');
    const full = await specsInMode('full');
    expect(charter['television-episode-video'].maxDurationSec).not.toBe(
      full['television-episode-video'].maxDurationSec,
    );
  });

  for (const mode of ['charter', 'full'] as const) {
    describe(`in ${mode} mode`, () => {
      it('admits a 30-minute video at file selection and at processing', async () => {
        const spec = (await specsInMode(mode))['system-content'];
        expect(spec.maxDurationSec).toBe(THIRTY_MINUTES_SEC);
        expect(spec.processing?.video?.maxDurationSec).toBe(THIRTY_MINUTES_SEC);
      });

      it("caps raw and processed bytes at full-mode Hall Television's caps", async () => {
        const spec = (await specsInMode(mode))['system-content'];
        const fullTelevision = (await specsInMode('full'))['television-episode-video'];
        expect(spec.maxBytes).toBe(fullTelevision.maxBytes);
        expect(spec.processing?.video?.maxOutputBytes).toBe(fullTelevision.processing?.video?.maxOutputBytes);
      });

      it('does not take the short-video output cap from its template origin', async () => {
        const specs = await specsInMode(mode);
        expect(specs['system-content'].processing?.video?.maxOutputBytes).not.toBe(
          specs['admin-audition-prompt'].processing?.video?.maxOutputBytes,
        );
      });

      it('outputs at the admin audition prompt resolution', async () => {
        const specs = await specsInMode(mode);
        const video = specs['system-content'].processing?.video;
        const template = specs['admin-audition-prompt'].processing?.video;
        expect(video?.requiredWidth).toBe(template?.requiredWidth);
        expect(video?.requiredHeight).toBe(template?.requiredHeight);
        expect(video?.video).toEqual(template?.video);
      });
    });
  }

  it('is a 16:9 horizontal video, picked from the computer only', async () => {
    const spec = (await specsInMode('charter'))['system-content'];
    expect(spec.kind).toBe('video');
    expect(spec.accept?.kinds).toEqual(['video']);
    expect(spec.requiredAspectRatio).toBe(16 / 9);
    expect(spec.videoOrientation).toBe('horizontal');
    expect(spec.client).toEqual({
      allowPick: true,
      allowCapturePhoto: false,
      allowRecordVideo: false,
      allowRecordAudio: false,
    });
  });
});
