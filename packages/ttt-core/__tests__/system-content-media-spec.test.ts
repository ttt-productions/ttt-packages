import { describe, it, expect } from 'vitest';
import { APP_MODE } from '../src/constants/app-mode.js';
import { TTT_MEDIA_SPECS, tttMediaSpecsFor } from '../src/media/ttt-media-specs.js';

const THIRTY_MINUTES_SEC = 30 * 60;

describe('system-content media spec', () => {
  it('the deployed registry is the one built in the deployed mode', () => {
    expect(TTT_MEDIA_SPECS).toEqual(tttMediaSpecsFor(APP_MODE));
  });

  it('loads each mode with its own mode-varied limits', () => {
    const charter = tttMediaSpecsFor('charter');
    const full = tttMediaSpecsFor('full');
    expect(charter['television-episode-video'].maxDurationSec).not.toBe(
      full['television-episode-video'].maxDurationSec,
    );
  });

  for (const mode of ['charter', 'full'] as const) {
    describe(`in ${mode} mode`, () => {
      it('admits a 30-minute video at file selection and at processing', () => {
        const spec = tttMediaSpecsFor(mode)['system-content'];
        expect(spec.maxDurationSec).toBe(THIRTY_MINUTES_SEC);
        expect(spec.processing?.video?.maxDurationSec).toBe(THIRTY_MINUTES_SEC);
      });

      it("caps raw and processed bytes at full-mode Hall Television's caps", () => {
        const spec = tttMediaSpecsFor(mode)['system-content'];
        const fullTelevision = tttMediaSpecsFor('full')['television-episode-video'];
        expect(spec.maxBytes).toBe(fullTelevision.maxBytes);
        expect(spec.processing?.video?.maxOutputBytes).toBe(
          fullTelevision.processing?.video?.maxOutputBytes,
        );
      });

      it('does not take the short-video output cap from its template origin', () => {
        const specs = tttMediaSpecsFor(mode);
        expect(specs['system-content'].processing?.video?.maxOutputBytes).not.toBe(
          specs['admin-audition-prompt'].processing?.video?.maxOutputBytes,
        );
      });

      it('outputs at the admin audition prompt resolution', () => {
        const specs = tttMediaSpecsFor(mode);
        const video = specs['system-content'].processing?.video;
        const template = specs['admin-audition-prompt'].processing?.video;
        expect(video?.requiredWidth).toBe(template?.requiredWidth);
        expect(video?.requiredHeight).toBe(template?.requiredHeight);
        expect(video?.video).toEqual(template?.video);
      });
    });
  }

  it('is a 16:9 horizontal video, picked from the computer only', () => {
    const spec = tttMediaSpecsFor('charter')['system-content'];
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
