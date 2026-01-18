import { runCmd } from "../video/ffmpeg";

export interface AudioProbe {
  durationSec?: number;
}

export async function probeAudio(inputPath: string): Promise<AudioProbe> {
  const args = ["-v", "error", "-print_format", "json", "-show_format", inputPath];

  const r = await runCmd("ffprobe", args);

  if (r.code !== 0) {
    throw new Error(`ffprobe failed (${r.code}): ${r.stderr || r.stdout}`);
  }

  const json = JSON.parse(r.stdout || "{}");
  const format: any = json.format ?? {};
  const durationStr = format.duration;
  const durationSec = durationStr ? Number(durationStr) : undefined;

  return { durationSec: Number.isFinite(durationSec) ? durationSec : undefined };
}
