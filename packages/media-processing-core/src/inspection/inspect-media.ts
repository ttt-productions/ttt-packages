// =============================================================================
// Canonical media content inspection (canonical-upload-content-classification)
// =============================================================================
//
// The ONE server-side classification authority. Consumes a LOCAL file (the
// pipeline's generation-pinned temp download), establishes what the bytes
// actually contain, and returns the bounded `MediaInspectionResult` contract
// from @ttt-productions/media-schemas. Everything downstream — origin/kind
// validation, processing-spec selection, the persisted asset kind, and the
// safety (PhotoDNA) routing — derives from this one result. Client MIME,
// filename, extension, container brand, and payload-byte heuristics are never
// consulted.
//
// Design (reviewed 2026-07-31; see the consuming app's
// CODE_CHANGE_canonical_upload_content_classification.md):
//   - family selection by a bounded 64 KiB SIGNATURE read (header only —
//     semantic elements are NEVER searched for in arbitrary payload; that
//     flat-scan heuristic caused the WebM audio misclassification twice);
//   - shared A/V containers (EBML/ISO-BMFF/Ogg/AVI) classified by a hardened
//     `ffprobe` stream table (libavformat's structural parsers), with timeout,
//     kill-on-abort, output cap, and strict schema validation;
//   - image-family proof by DECODER (sharp) — a signature or `ftyp` brand is a
//     candidate, not proof, and image-family ISO-BMFF (AVIF/HEIC) is resolved
//     BEFORE the ordinary "any timed video stream wins" rule (a valid AVIF
//     probes as a one-frame AV1 `video` stream);
//   - FAIL-CLOSED: anything unproven is `indeterminate` with the
//     `strict-video-fallback` safety plan — never audio, never publishable.

import { open } from "node:fs/promises";
import { z } from "zod";
import {
  MediaInspectionResultSchema,
  type MediaInspectionResult,
  type MediaInspectionStreams,
  type NormalizedCodecId,
  type MediaFormatId,
} from "@ttt-productions/media-schemas";
import { runCmd } from "../video/ffmpeg.js";

/** Bump on any classification-rule change (rides every decision event). */
export const INSPECTOR_VERSION = "mpc-inspect-1";

const SIGNATURE_READ_BYTES = 64 * 1024;
const DEFAULT_PROBE_TIMEOUT_MS = 20_000;
const PROBE_SIZE_BYTES = 4 * 1024 * 1024; // -probesize: metadata, not playback
const ANALYZE_DURATION_US = 10 * 1000 * 1000;

// ---- ffprobe JSON boundary (strict; anything else is malformed) ----

const ProbeStreamSchema = z
  .object({
    codec_type: z.string().max(32).optional(),
    codec_name: z.string().max(64).optional(),
    disposition: z
      .object({ attached_pic: z.number().int().min(0).max(1).optional() })
      .loose()
      .optional(),
    nb_frames: z.string().max(20).optional(),
    duration: z.string().max(32).optional(),
  })
  .loose();

const ProbeJsonSchema = z
  .object({
    format: z.object({ format_name: z.string().max(200).optional() }).loose().optional(),
    streams: z.array(ProbeStreamSchema).max(256).optional(),
  })
  .loose();

// ---- codec normalization (bounded — raw strings never escape) ----

const CODEC_MAP: Record<string, NormalizedCodecId> = {
  h264: "h264",
  hevc: "hevc",
  vp8: "vp8",
  vp9: "vp9",
  av1: "av1",
  theora: "theora",
  mpeg4: "mpeg4",
  mjpeg: "mjpeg",
  aac: "aac",
  alac: "alac",
  opus: "opus",
  vorbis: "vorbis",
  mp3: "mp3",
  flac: "flac",
};

function normalizeCodec(name: string | undefined): NormalizedCodecId {
  if (!name) return "other";
  const n = name.toLowerCase();
  if (CODEC_MAP[n]) return CODEC_MAP[n];
  if (n.startsWith("pcm_")) return "pcm";
  if (n.startsWith("amr")) return "amr";
  return "other";
}

// ---- signature families ----

type SignatureFamily =
  | { family: "image"; formatId: MediaFormatId; container: string }
  | { family: "svg" }
  | { family: "ebml" }
  | { family: "isobmff"; brand: string }
  | { family: "ogg" }
  | { family: "avi" }
  | { family: "wav" }
  | { family: "mp3" }
  | { family: "flac" }
  | { family: "unknown" };

/** ISO-BMFF brands that declare an IMAGE-item file (HEIF family). Resolved via
 *  decoder proof BEFORE the timed-video rule — see the AVIF note above. */
const ISOBMFF_IMAGE_BRANDS = new Set(["avif", "avis", "heic", "heix", "heim", "heis", "hevc", "hevx", "mif1", "msf1"]);

function ascii(b: Uint8Array, off: number, s: string): boolean {
  if (off + s.length > b.length) return false;
  for (let i = 0; i < s.length; i++) if (b[off + i] !== s.charCodeAt(i)) return false;
  return true;
}

export function detectSignatureFamily(b: Uint8Array): SignatureFamily {
  if (b.length < 12) return { family: "unknown" };
  // images (single-format signatures)
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { family: "image", formatId: "jpeg", container: "jpeg" };
  if (b[0] === 0x89 && ascii(b, 1, "PNG")) return { family: "image", formatId: "png", container: "png" };
  if (ascii(b, 0, "GIF8")) return { family: "image", formatId: "gif", container: "gif" };
  if (ascii(b, 0, "RIFF") && ascii(b, 8, "WEBP")) return { family: "image", formatId: "webp", container: "webp" };
  if (b[0] === 0x42 && b[1] === 0x4d) return { family: "image", formatId: "bmp", container: "bmp" };
  if ((b[0] === 0x49 && b[1] === 0x49 && b[2] === 0x2a) || (b[0] === 0x4d && b[1] === 0x4d && b[3] === 0x2a)) {
    return { family: "image", formatId: "tiff", container: "tiff" };
  }
  // SVG: XML text — scan a short prefix for '<svg' (bounded; case-insensitive).
  {
    const prefix = Buffer.from(b.slice(0, Math.min(b.length, 4096)))
      .toString("latin1")
      .toLowerCase();
    if (prefix.includes("<svg") && (prefix.trimStart().startsWith("<?xml") || prefix.trimStart().startsWith("<svg") || prefix.includes("<!doctype svg"))) {
      return { family: "svg" };
    }
  }
  // containers
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return { family: "ebml" };
  if (ascii(b, 4, "ftyp")) {
    const brand = String.fromCharCode(b[8], b[9], b[10], b[11]).trim().toLowerCase();
    return { family: "isobmff", brand };
  }
  if (ascii(b, 0, "OggS")) return { family: "ogg" };
  if (ascii(b, 0, "RIFF") && ascii(b, 8, "AVI ")) return { family: "avi" };
  if (ascii(b, 0, "RIFF") && ascii(b, 8, "WAVE")) return { family: "wav" };
  if (ascii(b, 0, "ID3")) return { family: "mp3" };
  if (b[0] === 0xff && (b[1] & 0xe0) === 0xe0) return { family: "mp3" };
  if (ascii(b, 0, "fLaC")) return { family: "flac" };
  return { family: "unknown" };
}

// ---- dependency seams (tests inject; production uses the real tools) ----

export interface InspectMediaDeps {
  /** Probe the local file; default shells to the hardened `ffprobe`. */
  probe?: (localPath: string, opts: { timeoutMs: number; signal?: AbortSignal }) => Promise<
    | { ok: true; json: unknown }
    | { ok: false; reason: "timeout" | "truncated" | "failed" | "bad_json" }
  >;
  /** Decode-prove an image; default uses sharp metadata. Returns frame count
   *  (pages) on success, null on decode failure. */
  decodeImage?: (localPath: string) => Promise<{ frames: number } | null>;
  /** Injected ffprobe version (default: cached `ffprobe -version` first line). */
  ffprobeVersion?: string;
}

let cachedFfprobeVersion: string | null | undefined;

async function getFfprobeVersion(): Promise<string | undefined> {
  if (cachedFfprobeVersion !== undefined) return cachedFfprobeVersion ?? undefined;
  try {
    const r = await runCmd("ffprobe", ["-version"], { timeoutMs: 5_000 });
    const first = (r.stdout || r.stderr).split(/\r?\n/)[0]?.trim() ?? "";
    cachedFfprobeVersion = first ? first.slice(0, 120) : null;
  } catch {
    cachedFfprobeVersion = null;
  }
  return cachedFfprobeVersion ?? undefined;
}

async function defaultProbe(
  localPath: string,
  opts: { timeoutMs: number; signal?: AbortSignal },
): Promise<{ ok: true; json: unknown } | { ok: false; reason: "timeout" | "truncated" | "failed" | "bad_json" }> {
  let r;
  try {
    r = await runCmd(
      "ffprobe",
      [
        "-v",
        "error",
        "-print_format",
        "json",
        "-show_format",
        "-show_streams",
        "-probesize",
        String(PROBE_SIZE_BYTES),
        "-analyzeduration",
        String(ANALYZE_DURATION_US),
        localPath,
      ],
      { timeoutMs: opts.timeoutMs, signal: opts.signal },
    );
  } catch {
    return { ok: false, reason: "failed" }; // spawn failure (ffprobe missing) — fail closed
  }
  if (r.timedOut) return { ok: false, reason: "timeout" };
  if (r.truncated) return { ok: false, reason: "truncated" };
  if (r.code !== 0) return { ok: false, reason: "failed" };
  try {
    return { ok: true, json: JSON.parse(r.stdout || "{}") };
  } catch {
    return { ok: false, reason: "bad_json" };
  }
}

async function defaultDecodeImage(localPath: string): Promise<{ frames: number } | null> {
  try {
    const sharp = (await import("sharp")).default;
    const meta = await sharp(localPath, { limitInputPixels: 268402689 /* sharp default ~16k x 16k */ }).metadata();
    if (!meta.width || !meta.height) return null;
    return { frames: Math.max(1, meta.pages ?? 1) };
  } catch {
    return null;
  }
}

// ---- result builders ----

function baseResult(
  partial: Omit<MediaInspectionResult, "inspectorVersion" | "streams" | "codecs"> &
    Partial<Pick<MediaInspectionResult, "streams" | "codecs">>,
  ffprobeVersion: string | undefined,
): MediaInspectionResult {
  const result: MediaInspectionResult = {
    inspectorVersion: INSPECTOR_VERSION,
    ...(ffprobeVersion ? { ffprobeVersion } : {}),
    streams: partial.streams ?? { audio: 0, timedVideo: 0, attachedPictures: 0, imageFrames: 0, auxiliary: 0 },
    codecs: partial.codecs ?? { audio: [], video: [] },
    status: partial.status,
    container: partial.container,
    safetyPlan: partial.safetyPlan,
    reasonCode: partial.reasonCode,
    ...(partial.canonicalKind ? { canonicalKind: partial.canonicalKind } : {}),
    ...(partial.formatId ? { formatId: partial.formatId } : {}),
  };
  return MediaInspectionResultSchema.parse(result);
}

function indeterminate(
  container: string,
  reasonCode: string,
  ffprobeVersion: string | undefined,
  formatId?: MediaFormatId,
): MediaInspectionResult {
  return baseResult(
    {
      status: "indeterminate",
      container,
      safetyPlan: "strict-video-fallback",
      reasonCode,
      ...(formatId ? { formatId } : {}),
    },
    ffprobeVersion,
  );
}

// ---- the inspector ----

export interface InspectMediaArgs {
  localPath: string;
  timeoutMs?: number;
  signal?: AbortSignal;
  deps?: InspectMediaDeps;
}

export async function inspectMedia(args: InspectMediaArgs): Promise<MediaInspectionResult> {
  const timeoutMs = args.timeoutMs ?? DEFAULT_PROBE_TIMEOUT_MS;
  const probe = args.deps?.probe ?? defaultProbe;
  const decodeImage = args.deps?.decodeImage ?? defaultDecodeImage;
  const ffprobeVersion = args.deps?.ffprobeVersion ?? (await getFfprobeVersion());

  // 1) bounded signature read (header only)
  let head: Uint8Array;
  try {
    const fh = await open(args.localPath, "r");
    try {
      const buf = Buffer.alloc(SIGNATURE_READ_BYTES);
      const { bytesRead } = await fh.read(buf, 0, SIGNATURE_READ_BYTES, 0);
      head = buf.subarray(0, bytesRead);
    } finally {
      await fh.close();
    }
  } catch {
    return indeterminate("unknown", "read_failed", ffprobeVersion);
  }

  const sig = detectSignatureFamily(head);

  // 2) family routing
  switch (sig.family) {
    case "unknown":
      return indeterminate("unknown", "unrecognized_signature", ffprobeVersion);

    case "svg":
      // Scriptable XML "image" — structurally recognized, deliberately NOT a
      // processable format until a sanitize/rasterize design exists (launch
      // policy 2026-07-31). Never classified by decoder capability alone.
      return baseResult(
        {
          status: "unsupported",
          container: "svg",
          formatId: "svg",
          safetyPlan: "strict-video-fallback",
          reasonCode: "unsupported_format:svg",
        },
        ffprobeVersion,
      );

    case "image": {
      // Single-format image signature: decoder proof required — a signature is
      // a candidate, not a classification.
      const decoded = await decodeImage(args.localPath);
      if (!decoded) return baseResult(
        { status: "malformed", container: sig.container, formatId: sig.formatId, safetyPlan: "strict-video-fallback", reasonCode: "image_decode_failed" },
        ffprobeVersion,
      );
      const frames = decoded.frames;
      return baseResult(
        {
          status: "definitive",
          canonicalKind: "image",
          container: sig.container,
          formatId: sig.formatId,
          streams: { audio: 0, timedVideo: 0, attachedPictures: 0, imageFrames: frames, auxiliary: 0 },
          safetyPlan: frames > 1 ? "animated-image-frames" : "still-image",
          reasonCode: "ok",
        },
        ffprobeVersion,
      );
    }

    case "isobmff":
      if (ISOBMFF_IMAGE_BRANDS.has(sig.brand)) {
        // IMAGE-FAMILY ISO-BMFF resolves BEFORE the timed-video rule: a valid
        // AVIF probes as a one-frame AV1 `video` stream. Proof = image brand +
        // successful bounded decode + no ordinary timed A/V presentation.
        const probed = await probe(args.localPath, { timeoutMs, signal: args.signal });
        const parsed = probed.ok ? ProbeJsonSchema.safeParse(probed.json) : null;
        const streams = parsed?.success ? parsed.data.streams ?? [] : null;
        const hasAudio = streams ? streams.some((s) => s.codec_type === "audio") : true; // unknown ⇒ assume worst
        const formatId: MediaFormatId | undefined = sig.brand.startsWith("avi") ? "avif" : "heic";
        const decoded = await decodeImage(args.localPath);
        if (!decoded || hasAudio) {
          if (formatId === "heic" && !decoded && !hasAudio) {
            // Recognized HEIC-family that the runtime cannot decode: explicit
            // unsupported-image (launch policy) — NEVER relabeled video.
            return baseResult(
              { status: "unsupported", container: "heif", formatId, safetyPlan: "strict-video-fallback", reasonCode: "unsupported_format:heic" },
              ffprobeVersion,
            );
          }
          // Undecodable/ambiguous image-brand file, or one carrying audio (a
          // real timed presentation wearing an image brand): fail toward the
          // stricter visual path.
          return indeterminate("heif", decoded ? "image_brand_with_audio" : "image_decode_failed", ffprobeVersion, formatId);
        }
        const frames = decoded.frames;
        return baseResult(
          {
            status: "definitive",
            canonicalKind: "image",
            container: "heif",
            formatId,
            streams: { audio: 0, timedVideo: 0, attachedPictures: 0, imageFrames: frames, auxiliary: 0 },
            safetyPlan: frames > 1 ? "animated-image-frames" : "still-image",
            reasonCode: "ok",
          },
          ffprobeVersion,
        );
      }
      return classifyAvContainer(args, "isobmff", "isobmff", probe, timeoutMs, ffprobeVersion);

    case "ebml":
      return classifyAvContainer(args, "webm", "webm", probe, timeoutMs, ffprobeVersion);
    case "ogg":
      return classifyAvContainer(args, "ogg", "ogg", probe, timeoutMs, ffprobeVersion);
    case "avi":
      // Real container ffprobe parses; no registry entry (no origin enables it
      // today) — the stream truth still classifies it, policy rejects by format.
      return classifyAvContainer(args, "avi", undefined, probe, timeoutMs, ffprobeVersion);
    case "wav":
      return classifyAvContainer(args, "wav", "wav", probe, timeoutMs, ffprobeVersion);
    case "mp3":
      return classifyAvContainer(args, "mp3", "mp3", probe, timeoutMs, ffprobeVersion);
    case "flac":
      return classifyAvContainer(args, "flac", "flac", probe, timeoutMs, ffprobeVersion);
  }
}

async function classifyAvContainer(
  args: InspectMediaArgs,
  container: string,
  formatId: MediaFormatId | undefined,
  probe: NonNullable<InspectMediaDeps["probe"]>,
  timeoutMs: number,
  ffprobeVersion: string | undefined,
): Promise<MediaInspectionResult> {
  const probed = await probe(args.localPath, { timeoutMs, signal: args.signal });
  if (!probed.ok) {
    return indeterminate(container, `probe_${probed.reason}`, ffprobeVersion, formatId);
  }
  const parsed = ProbeJsonSchema.safeParse(probed.json);
  if (!parsed.success) return indeterminate(container, "probe_schema_invalid", ffprobeVersion, formatId);

  const rawStreams = parsed.data.streams ?? [];
  if (rawStreams.length === 0) return indeterminate(container, "no_streams", ffprobeVersion, formatId);

  const counts: MediaInspectionStreams = { audio: 0, timedVideo: 0, attachedPictures: 0, imageFrames: 0, auxiliary: 0 };
  const audioCodecs = new Set<NormalizedCodecId>();
  const videoCodecs = new Set<NormalizedCodecId>();
  let sawUnknownType = false;

  for (const s of rawStreams) {
    const type = s.codec_type ?? "";
    if (type === "audio") {
      counts.audio++;
      audioCodecs.add(normalizeCodec(s.codec_name));
    } else if (type === "video") {
      // An attached picture (cover art) is NOT a timed presentation — but the
      // disposition flag is untrusted container data, so it is COUNTED and the
      // safety plan forces every such picture through the image hash path
      // before the audio guard may return clean.
      if (s.disposition?.attached_pic === 1) {
        counts.attachedPictures++;
      } else {
        counts.timedVideo++;
        videoCodecs.add(normalizeCodec(s.codec_name));
      }
    } else if (type === "subtitle" || type === "data" || type === "attachment") {
      counts.auxiliary++;
    } else {
      counts.auxiliary++;
      sawUnknownType = true;
    }
  }

  const codecs = { audio: [...audioCodecs], video: [...videoCodecs] };

  // classification table (fail-closed)
  if (counts.timedVideo > 0) {
    return baseResult(
      {
        status: "definitive",
        canonicalKind: "video",
        container,
        ...(formatId ? { formatId } : {}),
        streams: counts,
        codecs,
        safetyPlan: "video-frames",
        reasonCode: "ok",
      },
      ffprobeVersion,
    );
  }
  if (counts.audio > 0 && !sawUnknownType) {
    return baseResult(
      {
        status: "definitive",
        canonicalKind: "audio",
        container,
        ...(formatId ? { formatId } : {}),
        streams: counts,
        codecs,
        safetyPlan: counts.attachedPictures > 0 ? "audio-plus-artwork" : "audio-only",
        reasonCode: "ok",
      },
      ffprobeVersion,
    );
  }
  // auxiliary-only, unknown stream types alongside audio, or nothing usable:
  // never audio — the strict visual fallback owns it.
  return baseResult(
    {
      status: "indeterminate",
      container,
      ...(formatId ? { formatId } : {}),
      streams: counts,
      codecs,
      safetyPlan: "strict-video-fallback",
      reasonCode: sawUnknownType ? "unknown_stream_type" : "auxiliary_only",
    },
    ffprobeVersion,
  );
}
