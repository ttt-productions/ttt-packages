// The ONE rule for a timed media file's length (ENG-002). The inspection's
// `durationSec` and both processors' too-long checks read it here, so they can
// never disagree about the same file.
//
//   1. The length is always MEASURED from the packets themselves: ffprobe
//      lists every packet's timestamp and duration (demux only, no decode),
//      and the length is the span from the earliest packet start (never before
//      zero) to the latest packet end across the audio and video streams. A
//      container header's declared length (`format.duration`) is never used:
//      a header can claim a short length for a long file, and Chromium's
//      MediaRecorder writes WebM with none. ffmpeg's `-progress` output time
//      is not used either: it trails the true end by the B-frame reorder
//      delay. The listing is read one line at a time and folded into a few
//      numbers per stream, so a file of any packet count is measured in
//      bounded memory.
//   2. A measure that fails, times out, is aborted, is cut short, or finds no
//      timed packet is NO length. Every caller treats that as unknown and
//      fails closed.

import type { MediaProcessingError } from "@ttt-productions/media-schemas";
import { runCmd } from "../video/ffmpeg.js";

/** Wall-clock ceiling for the measuring pass; it bounds an adversarial input,
 *  not a real upload (a 920 MB, 30-minute WebM measures in about a second). */
export const DEFAULT_DURATION_MEASURE_TIMEOUT_MS = 120_000;

/** More streams than this is an adversarial file, and is no length. */
const MAX_TRACKED_STREAMS = 256;

const SECONDS = /^-?\d+(\.\d+)?$/;
const STREAM_INDEX = /^\d+$/;

function seconds(raw: string | undefined): number | undefined {
  if (raw === undefined || !SECONDS.test(raw)) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

function fields(line: string): { section: string; values: Map<string, string> } {
  const [section = "", ...pairs] = line.split("|");
  const values = new Map<string, string>();
  for (const pair of pairs) {
    const eq = pair.indexOf("=");
    if (eq > 0) values.set(pair.slice(0, eq), pair.slice(eq + 1).trim());
  }
  return { section, values };
}

export interface PacketLengthFold {
  /** One line of ffprobe's `-of compact` packet and stream listing. */
  add(line: string): void;
  /** Seconds from the earliest packet start (never before zero) to the latest
   *  packet end across the timed (audio, and non-cover-art video) streams, or
   *  `undefined`. */
  lengthSec(): number | undefined;
}

export function createPacketLengthFold(): PacketLengthFold {
  const spans = new Map<number, { start: number; end: number }>();
  const timed = new Set<number>();
  let overflow = false;

  return {
    add(line) {
      const { section, values } = fields(line);
      if (section === "packet") {
        const rawIndex = values.get("stream_index");
        if (rawIndex === undefined || !STREAM_INDEX.test(rawIndex)) return;
        const index = Number(rawIndex);
        const start = seconds(values.get("pts_time")) ?? seconds(values.get("dts_time"));
        if (start === undefined) return;
        const end = start + Math.max(0, seconds(values.get("duration_time")) ?? 0);
        const span = spans.get(index);
        if (span) {
          if (start < span.start) span.start = start;
          if (end > span.end) span.end = end;
        } else if (spans.size >= MAX_TRACKED_STREAMS) {
          overflow = true;
        } else {
          spans.set(index, { start, end });
        }
      } else if (section === "stream") {
        const rawIndex = values.get("index");
        if (rawIndex === undefined || !STREAM_INDEX.test(rawIndex)) return;
        const type = values.get("codec_type");
        const coverArt = values.get("disposition:attached_pic") === "1";
        if (type === "audio" || (type === "video" && !coverArt)) timed.add(Number(rawIndex));
      }
    },
    lengthSec() {
      if (overflow) return undefined;
      let start = Infinity;
      let end = -Infinity;
      for (const index of timed) {
        const span = spans.get(index);
        if (!span) continue;
        if (span.start < start) start = span.start;
        if (span.end > end) end = span.end;
      }
      // Packets before zero are encoder pre-roll (AAC priming, Opus pre-skip)
      // that a player discards, so they add no playable length.
      const sec = Math.round((end - Math.max(0, start)) * 1_000_000) / 1_000_000;
      return Number.isFinite(sec) && sec > 0 ? sec : undefined;
    },
  };
}

export interface MeasureDurationOptions {
  timeoutMs?: number;
  signal?: AbortSignal;
}

/** The file's length in seconds, or `undefined` when it cannot be measured. */
export async function measureDurationSec(localPath: string, opts?: MeasureDurationOptions): Promise<number | undefined> {
  const fold = createPacketLengthFold();
  let r;
  try {
    r = await runCmd(
      "ffprobe",
      [
        "-v",
        "error",
        "-show_entries",
        "stream=index,codec_type:stream_disposition=attached_pic:packet=stream_index,pts_time,dts_time,duration_time",
        "-of",
        "compact",
        localPath,
      ],
      {
        timeoutMs: opts?.timeoutMs ?? DEFAULT_DURATION_MEASURE_TIMEOUT_MS,
        signal: opts?.signal,
        onStdoutLine: (line) => fold.add(line),
      },
    );
  } catch {
    return undefined;
  }
  if (r.timedOut || r.truncated || r.code !== 0) return undefined;
  return fold.lengthSec();
}

export type MeasureDurationFn = (localPath: string, opts?: MeasureDurationOptions) => Promise<number | undefined>;

/** The refusal for a file with no length under a spec that caps length: a
 *  length that cannot be measured cannot be shown to be within the cap. The
 *  code is `unsupported_format`, never `too_long` — the file is not known to
 *  be too long, and its copy must not say so. */
export function unreadableLengthError(kind: "video" | "audio", maxDurationSec: number): MediaProcessingError {
  return {
    code: "unsupported_format",
    message: kind === "video" ? "The video's length could not be read." : "The audio's length could not be read.",
    details: { maxDurationSec },
  };
}
