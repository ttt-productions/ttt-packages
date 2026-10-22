import type { MediaProcessingError } from '@ttt-productions/media-schemas';
import { runCmd } from '../video/ffmpeg.js';

export const DEFAULT_DURATION_MEASURE_TIMEOUT_MS = 120_000;

const MAX_TRACKED_STREAMS = 256;

const SECONDS = /^-?\d+(\.\d+)?$/;
const STREAM_INDEX = /^\d+$/;

function seconds(raw: string | undefined): number | undefined {
  if (raw === undefined || !SECONDS.test(raw)) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

function fields(line: string): { section: string; values: Map<string, string> } {
  const [section = '', ...pairs] = line.split('|');
  const values = new Map<string, string>();
  for (const pair of pairs) {
    const eq = pair.indexOf('=');
    if (eq > 0) values.set(pair.slice(0, eq), pair.slice(eq + 1).trim());
  }
  return { section, values };
}

export interface PacketLengthFold {
  add(line: string): void;
  lengthSec(): number | undefined;
}

export function createPacketLengthFold(): PacketLengthFold {
  const spans = new Map<number, { start: number; end: number }>();
  const timed = new Set<number>();
  let overflow = false;

  return {
    add(line) {
      const { section, values } = fields(line);
      if (section === 'packet') {
        const rawIndex = values.get('stream_index');
        if (rawIndex === undefined || !STREAM_INDEX.test(rawIndex)) return;
        const index = Number(rawIndex);
        const start = seconds(values.get('pts_time')) ?? seconds(values.get('dts_time'));
        if (start === undefined) return;
        const end = start + Math.max(0, seconds(values.get('duration_time')) ?? 0);
        const span = spans.get(index);
        if (span) {
          if (start < span.start) span.start = start;
          if (end > span.end) span.end = end;
        } else if (spans.size >= MAX_TRACKED_STREAMS) {
          overflow = true;
        } else {
          spans.set(index, { start, end });
        }
      } else if (section === 'stream') {
        const rawIndex = values.get('index');
        if (rawIndex === undefined || !STREAM_INDEX.test(rawIndex)) return;
        const type = values.get('codec_type');
        const coverArt = values.get('disposition:attached_pic') === '1';
        if (type === 'audio' || (type === 'video' && !coverArt)) timed.add(Number(rawIndex));
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
      // Packets before zero are encoder pre-roll (AAC priming, Opus pre-skip) a player discards.
      const sec = Math.round((end - Math.max(0, start)) * 1_000_000) / 1_000_000;
      return Number.isFinite(sec) && sec > 0 ? sec : undefined;
    },
  };
}

export interface MeasureDurationOptions {
  timeoutMs?: number;
  signal?: AbortSignal;
}

export async function measureDurationSec(
  localPath: string,
  opts?: MeasureDurationOptions,
): Promise<number | undefined> {
  const fold = createPacketLengthFold();
  let r;
  try {
    r = await runCmd(
      'ffprobe',
      [
        '-v',
        'error',
        '-show_entries',
        'stream=index,codec_type:stream_disposition=attached_pic:packet=stream_index,pts_time,dts_time,duration_time',
        '-of',
        'compact',
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

export type MeasureDurationFn = (
  localPath: string,
  opts?: MeasureDurationOptions,
) => Promise<number | undefined>;

export function unreadableLengthError(
  kind: 'video' | 'audio',
  maxDurationSec: number,
): MediaProcessingError {
  return {
    code: 'unsupported_format',
    message:
      kind === 'video'
        ? "The video's length could not be read."
        : "The audio's length could not be read.",
    details: { maxDurationSec },
  };
}
