import { runCmd } from "./ffmpeg.js";

export interface VideoProbe {
  durationSec?: number;
  width?: number;
  height?: number;
  hasAudio?: boolean;
}

export async function probeVideo(inputPath: string): Promise<VideoProbe> {
  // ffprobe must exist in runtime environment
  const args = [
    "-v",
    "error",
    "-print_format",
    "json",
    "-show_streams",
    "-show_format",
    inputPath,
  ];

  const r = await runCmd("ffprobe", args);

  if (r.code !== 0) {
    throw new Error(`ffprobe failed (${r.code}): ${r.stderr || r.stdout}`);
  }

  const json = JSON.parse(r.stdout || "{}");

  const streams: any[] = Array.isArray(json.streams) ? json.streams : [];
  const format: any = json.format ?? {};

  const v = streams.find((s) => s.codec_type === "video");
  const a = streams.find((s) => s.codec_type === "audio");

  const durationStr = format.duration ?? v?.duration ?? a?.duration;
  const durationSec = durationStr ? Number(durationStr) : undefined;

  const width = v?.width ? Number(v.width) : undefined;
  const height = v?.height ? Number(v.height) : undefined;

  return {
    durationSec: Number.isFinite(durationSec) ? durationSec : undefined,
    width,
    height,
    hasAudio: !!a,
  };
}
