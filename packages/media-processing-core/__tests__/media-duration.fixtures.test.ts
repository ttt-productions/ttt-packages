import { describe, it, expect, beforeAll } from "vitest";
import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { MediaProcessingSpec } from "@ttt-productions/media-schemas";
import { inspectMedia } from "../src/inspection/inspect-media.js";
import { probeVideo } from "../src/video/probe.js";
import { probeAudio } from "../src/audio/probe.js";
import { processVideo } from "../src/video/video-processor.js";
import { processAudio } from "../src/audio/audio-processor.js";
import { runCmd } from "../src/video/ffmpeg.js";

// REAL-TOOL proof of the one length rule: every length is measured, never read
// from the header. Chromium's MediaRecorder writes WebM with no length in its
// header; ffmpeg writing WebM to a pipe produces the same header-less file, so
// those fixtures stand in for real browser recordings. ffmpeg/ffprobe are
// required local prerequisites, as for the inspector fixtures.

const SECONDS = 3;
const LIE_LOOPS = 8;
const LIE_SECONDS = LIE_LOOPS;
const VIDEO_1S = ["-f", "lavfi", "-i", "testsrc2=size=64x64:duration=1:rate=10"];
const AUDIO_1S = ["-f", "lavfi", "-i", "sine=frequency=440:duration=1"];
const VIDEO = ["-f", "lavfi", "-i", `testsrc2=size=64x64:duration=${SECONDS}:rate=10`];
const AUDIO = ["-f", "lavfi", "-i", `sine=frequency=440:duration=${SECONDS}`];

let dir: string;

async function gen(name: string, args: string[]): Promise<string> {
  const out = path.join(dir, name);
  const r = await runCmd("ffmpeg", ["-hide_banner", "-y", ...args, out], { timeoutMs: 60_000 });
  if (r.code !== 0) throw new Error(`fixture ${name} failed: ${r.stderr}`);
  return out;
}

/** Writes through ffmpeg's `pipe:` output, which is never seekable, so the
 *  WebM muxer cannot go back and write the length into the header. */
async function genPiped(name: string, args: string[]): Promise<string> {
  const out = path.join(dir, name);
  const p = spawn("ffmpeg", ["-hide_banner", "-v", "error", ...args, "-f", "webm", "pipe:1"], { stdio: ["ignore", "pipe", "inherit"] });
  const file = createWriteStream(out);
  const written = new Promise<void>((resolve, reject) => {
    file.on("finish", resolve);
    file.on("error", reject);
  });
  p.stdout.pipe(file);
  const code = await new Promise<number | null>((resolve, reject) => {
    p.on("error", reject);
    p.on("close", resolve);
  });
  if (code !== 0) throw new Error(`ffmpeg exited ${code} writing ${name}`);
  await written;
  return out;
}

async function headerDurationOf(file: string): Promise<string | undefined> {
  const r = await runCmd("ffprobe", ["-v", "error", "-print_format", "json", "-show_format", file], { timeoutMs: 30_000 });
  return JSON.parse(r.stdout || "{}").format?.duration;
}

const f: Record<string, string> = {};

beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "mpc-duration-"));
  f.recVideo = await genPiped("rec-video.webm", [...VIDEO, ...AUDIO, "-c:v", "libvpx", "-c:a", "libopus"]);
  f.recAudio = await genPiped("rec-audio.webm", [...AUDIO, "-c:a", "libopus"]);
  f.mp4 = await gen("v.mp4", [...VIDEO, ...AUDIO, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac"]);
  f.webm = await gen("v.webm", [...VIDEO, ...AUDIO, "-c:v", "libvpx", "-c:a", "libopus"]);
  f.m4a = await gen("a.m4a", [...AUDIO, "-c:a", "aac"]);
  f.mp3 = await gen("a.mp3", [...AUDIO, "-c:a", "libmp3lame"]);
  f.wav = await gen("a.wav", [...AUDIO]);
  f.flac = await gen("a.flac", [...AUDIO]);
  f.audioWebm = await gen("a.webm", [...AUDIO, "-c:a", "libopus"]);
  // Looping a one-second clip through the pipe muxer carries the clip's
  // header length into a file LIE_LOOPS times longer.
  const clipVideo = await gen("clip-v.webm", [...VIDEO_1S, ...AUDIO_1S, "-c:v", "libvpx", "-c:a", "libopus"]);
  f.lieVideo = await genPiped("lie-video.webm", ["-stream_loop", String(LIE_LOOPS - 1), "-i", clipVideo, "-c", "copy"]);
  const clipAudio = await gen("clip-a.webm", [...AUDIO_1S, "-c:a", "libopus"]);
  f.lieAudio = await genPiped("lie-audio.webm", ["-stream_loop", String(LIE_LOOPS - 1), "-i", clipAudio, "-c", "copy"]);
  // The header of a recording with none of its packets: it opens and lists
  // its streams, but has no length to read and none to measure.
  f.headerOnlyVideo = path.join(dir, "header-only-video.webm");
  await writeFile(f.headerOnlyVideo, (await readFile(f.recVideo)).subarray(0, 600));
  f.headerOnlyAudio = path.join(dir, "header-only-audio.webm");
  await writeFile(f.headerOnlyAudio, (await readFile(f.recAudio)).subarray(0, 600));
}, 180_000);

function spec(kind: "video" | "audio", maxDurationSec: number): MediaProcessingSpec {
  return { kind, maxDurationSec };
}

function outBase(name: string): string {
  return path.join(dir, "out", name);
}

describe("header-less recordings get a measured length", () => {
  it("the recorder-style fixtures really carry no header length", async () => {
    expect(await headerDurationOf(f.recVideo)).toBeUndefined();
    expect(await headerDurationOf(f.recAudio)).toBeUndefined();
  });

  it("a header-less WebM video measures its real length, and inspection and the video probe agree", async () => {
    const inspected = await inspectMedia({ localPath: f.recVideo });
    expect(inspected.canonicalKind).toBe("video");
    expect(inspected.durationSec).toBeGreaterThanOrEqual(SECONDS - 0.1);
    expect(inspected.durationSec).toBeLessThanOrEqual(SECONDS + 0.1);
    expect((await probeVideo(f.recVideo)).durationSec).toBe(inspected.durationSec);
  });

  it("a header-less WebM audio measures its real length, and inspection and the audio probe agree", async () => {
    const inspected = await inspectMedia({ localPath: f.recAudio });
    expect(inspected.canonicalKind).toBe("audio");
    expect(inspected.durationSec).toBeGreaterThanOrEqual(SECONDS - 0.1);
    expect(inspected.durationSec).toBeLessThanOrEqual(SECONDS + 0.1);
    expect((await probeAudio(f.recAudio)).durationSec).toBe(inspected.durationSec);
  });
});

describe("a header that claims a short length for a long file", () => {
  it("the lying fixtures really declare about one loop in their header", async () => {
    for (const file of [f.lieVideo, f.lieAudio]) {
      const declared = Number(await headerDurationOf(file));
      expect(declared).toBeGreaterThan(0.9);
      expect(declared).toBeLessThan(1.1);
    }
  });

  it("inspection and both probes report the real measured length, not the header's", async () => {
    const video = await inspectMedia({ localPath: f.lieVideo });
    expect(video.durationSec).toBeGreaterThanOrEqual(LIE_SECONDS - 0.1);
    expect(video.durationSec).toBeLessThanOrEqual(LIE_SECONDS + 0.1);
    expect((await probeVideo(f.lieVideo)).durationSec).toBe(video.durationSec);

    const audio = await inspectMedia({ localPath: f.lieAudio });
    expect(audio.durationSec).toBeGreaterThanOrEqual(LIE_SECONDS - 0.1);
    expect(audio.durationSec).toBeLessThanOrEqual(LIE_SECONDS + 0.1);
    expect((await probeAudio(f.lieAudio)).durationSec).toBe(audio.durationSec);
  });

  it("is too_long under a max its header satisfies but its real length exceeds", async () => {
    const video = await processVideo(spec("video", LIE_SECONDS - 2), { inputPath: f.lieVideo, outputBasePath: outBase("lie-v") });
    expect(video.ok).toBe(false);
    if (!video.ok) expect(video.error.code).toBe("too_long");

    const audio = await processAudio(spec("audio", LIE_SECONDS - 2), { inputPath: f.lieAudio, outputBasePath: outBase("lie-a") });
    expect(audio.ok).toBe(false);
    if (!audio.ok) expect(audio.error.code).toBe("too_long");
  }, 60_000);
});

describe("every format measures its real length, and inspection and its probe agree", () => {
  for (const [name, kind] of [
    ["mp4", "video"],
    ["webm", "video"],
    ["m4a", "audio"],
    ["mp3", "audio"],
    ["wav", "audio"],
    ["flac", "audio"],
    ["audioWebm", "audio"],
  ] as const) {
    it(`${name}: inspection and the ${kind} probe both return the real length`, async () => {
      const inspected = await inspectMedia({ localPath: f[name] });
      expect(inspected.durationSec).toBeGreaterThanOrEqual(SECONDS - 0.1);
      expect(inspected.durationSec).toBeLessThanOrEqual(SECONDS + 0.1);
      const probed = kind === "video" ? await probeVideo(f[name]) : await probeAudio(f[name]);
      expect(probed.durationSec).toBe(inspected.durationSec);
    });
  }
});

describe("processors check the length against the spec's max", () => {
  it("a header-less video passes a max above its length and is too_long under a max below it", async () => {
    expect((await processVideo(spec("video", SECONDS + 2), { inputPath: f.recVideo, outputBasePath: outBase("rv-pass") })).ok).toBe(true);
    const over = await processVideo(spec("video", SECONDS - 1), { inputPath: f.recVideo, outputBasePath: outBase("rv-over") });
    expect(over.ok).toBe(false);
    if (!over.ok) expect(over.error.code).toBe("too_long");
  }, 60_000);

  it("an MP4 video passes a max above its length and is too_long under a max below it", async () => {
    expect((await processVideo(spec("video", SECONDS + 2), { inputPath: f.mp4, outputBasePath: outBase("mp4-pass") })).ok).toBe(true);
    const over = await processVideo(spec("video", SECONDS - 1), { inputPath: f.mp4, outputBasePath: outBase("mp4-over") });
    expect(over.ok).toBe(false);
    if (!over.ok) expect(over.error.code).toBe("too_long");
  }, 60_000);

  it("a header-less audio passes a max above its length and is too_long under a max below it", async () => {
    expect((await processAudio(spec("audio", SECONDS + 2), { inputPath: f.recAudio, outputBasePath: outBase("ra-pass") })).ok).toBe(true);
    const over = await processAudio(spec("audio", SECONDS - 1), { inputPath: f.recAudio, outputBasePath: outBase("ra-over") });
    expect(over.ok).toBe(false);
    if (!over.ok) expect(over.error.code).toBe("too_long");
  }, 60_000);

  it("an M4A audio passes a max above its length and is too_long under a max below it", async () => {
    expect((await processAudio(spec("audio", SECONDS + 2), { inputPath: f.m4a, outputBasePath: outBase("m4a-pass") })).ok).toBe(true);
    const over = await processAudio(spec("audio", SECONDS - 1), { inputPath: f.m4a, outputBasePath: outBase("m4a-over") });
    expect(over.ok).toBe(false);
    if (!over.ok) expect(over.error.code).toBe("too_long");
  }, 60_000);
});

describe("a file with no readable or measurable length", () => {
  it("has no durationSec from inspection or either probe", async () => {
    expect(await inspectMedia({ localPath: f.headerOnlyVideo })).not.toHaveProperty("durationSec");
    expect((await probeVideo(f.headerOnlyVideo)).durationSec).toBeUndefined();
    expect((await probeAudio(f.headerOnlyAudio)).durationSec).toBeUndefined();
  });

  it("is refused by the video processor when the spec caps length", async () => {
    const r = await processVideo(spec("video", 600), { inputPath: f.headerOnlyVideo, outputBasePath: outBase("hov") });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("unsupported_format");
  });

  it("is refused by the audio processor when the spec caps length", async () => {
    const r = await processAudio(spec("audio", 600), { inputPath: f.headerOnlyAudio, outputBasePath: outBase("hoa") });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("unsupported_format");
  });
});
