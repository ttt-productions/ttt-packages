import { DEFAULT_PROBE_TIMEOUT_MS, runCmd } from "../video/ffmpeg.js";
import { measureDurationSec, type MeasureDurationOptions } from "../duration/media-duration.js";

export interface AudioProbe {
  durationSec?: number;
}

export async function probeAudio(inputPath: string, opts?: MeasureDurationOptions): Promise<AudioProbe> {
  // ffprobe opening the file is the readability check: a file it cannot open
  // throws here rather than reaching the length rule as merely unmeasurable.
  const r = await runCmd("ffprobe", ["-v", "error", inputPath], { timeoutMs: DEFAULT_PROBE_TIMEOUT_MS, signal: opts?.signal });

  if (r.timedOut || r.code !== 0) {
    throw new Error(`ffprobe failed (${r.code}): ${r.stderr || r.stdout}`);
  }

  return { durationSec: await measureDurationSec(inputPath, opts) };
}
