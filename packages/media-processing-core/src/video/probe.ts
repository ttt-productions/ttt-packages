import { DEFAULT_PROBE_TIMEOUT_MS, runCmd } from './ffmpeg.js';
import { measureDurationSec, type MeasureDurationOptions } from '../duration/media-duration.js';

export interface VideoProbe {
  durationSec?: number;
  width?: number;
  height?: number;
  hasAudio?: boolean;
}

type ProbeStream = { codec_type?: unknown; width?: unknown; height?: unknown };

export async function probeVideo(
  inputPath: string,
  opts?: MeasureDurationOptions,
): Promise<VideoProbe> {
  const args = ['-v', 'error', '-print_format', 'json', '-show_streams', inputPath];

  const r = await runCmd('ffprobe', args, {
    timeoutMs: DEFAULT_PROBE_TIMEOUT_MS,
    signal: opts?.signal,
  });

  if (r.timedOut || r.code !== 0) {
    throw new Error(`ffprobe failed (${r.code}): ${r.stderr || r.stdout}`);
  }

  // ffprobe's JSON output lists the file's streams in this shape.
  const json = JSON.parse(r.stdout || '{}') as { streams?: ProbeStream[] };

  const streams: ProbeStream[] = Array.isArray(json.streams) ? json.streams : [];

  const v = streams.find((s) => s.codec_type === 'video');
  const a = streams.find((s) => s.codec_type === 'audio');

  const durationSec = await measureDurationSec(inputPath, opts);

  const width = v?.width ? Number(v.width) : undefined;
  const height = v?.height ? Number(v.height) : undefined;

  return {
    durationSec,
    width,
    height,
    hasAudio: !!a,
  };
}
