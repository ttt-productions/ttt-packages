// Defense-in-depth: guarantee every File we emit has a valid, parameter-less
// media MIME (image/*, video/*, or audio/*). If file.type is missing or
// unusable, infer from the extension; if the extension is unknown, fall back
// to a kind-appropriate default.
//
// MediaRecorder (and some pickers) report parameterized types such as
// "audio/webm;codecs=opus". Downstream storage rules validate a
// parameter-less image|video|audio regex, so we always emit the base type
// ("audio/webm"), never the parameterized form.
//
// Consumers of @ttt-productions/file-input should never see a File whose
// .type is "" or "application/octet-stream". upload-core will refuse them.

export type InferKind = "image" | "video" | "audio";

const EXT_TO_MIME: Record<string, string> = {
  // image
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  heic: "image/heic",
  heif: "image/heif",
  // video
  mp4: "video/mp4",
  m4v: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  mkv: "video/x-matroska",
  // audio
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  aac: "audio/aac",
  wav: "audio/wav",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  flac: "audio/flac",
};

// Containers that legitimately hold either audio or video. When the caller
// declares a kind (e.g. the record dialog's chosen recording kind), that kind
// picks the matching side; without a kind we keep the historical single-kind
// guess in EXT_TO_MIME (webm → video, ogg → audio).
const AMBIGUOUS_EXT_TO_MIME: Record<string, Partial<Record<InferKind, string>>> = {
  webm: { audio: "audio/webm", video: "video/webm" },
  ogg: { audio: "audio/ogg", video: "video/ogg" },
};

const KIND_DEFAULT: Record<InferKind, string> = {
  image: "image/jpeg",
  video: "video/webm",
  audio: "audio/webm",
};

const BASE_MEDIA_MIME_RE = /^(image|video|audio)\/[a-z0-9.+-]+$/;

/**
 * Extracts the parameter-less base MIME ("audio/webm" from
 * "audio/webm;codecs=opus"), lowercased, when it is a usable media type.
 * Returns null for empty values, application/octet-stream, and anything
 * whose base is not image/*, video/*, or audio/*.
 */
function parseBaseMime(mime: string | undefined | null): string | null {
  if (!mime) return null;
  const base = mime.split(";")[0].trim().toLowerCase();
  if (base === "application/octet-stream") return null;
  return BASE_MEDIA_MIME_RE.test(base) ? base : null;
}

function kindOfMime(base: string): InferKind {
  return base.slice(0, base.indexOf("/")) as InferKind;
}

function extOf(name: string): string | null {
  const dot = name.lastIndexOf(".");
  if (dot < 0 || dot === name.length - 1) return null;
  return name.slice(dot + 1).toLowerCase();
}

/**
 * Returns a valid, parameter-less media MIME for the given File.
 *
 * Precedence:
 * 1. The base of file.type (parameters stripped, lowercased) when valid —
 *    unless `fallbackKind` is supplied and disagrees with the declared
 *    top-level kind. A caller-declared kind (e.g. the record dialog's chosen
 *    recording kind) is authoritative context, so a conflicting declared type
 *    is treated as untrustworthy and resolution falls through to the
 *    extension.
 * 2. Extension lookup. For ambiguous containers (webm/ogg exist as both audio
 *    and video) a supplied `fallbackKind` picks the matching side; unambiguous
 *    extensions keep their single mapping.
 * 3. The kind default for `fallbackKind`, then image/jpeg as last resort.
 */
export function inferContentType(file: File, fallbackKind?: InferKind): string {
  const base = parseBaseMime(file.type);
  if (base && (!fallbackKind || kindOfMime(base) === fallbackKind)) return base;

  const ext = extOf(file.name);
  if (ext) {
    const byKind = fallbackKind ? AMBIGUOUS_EXT_TO_MIME[ext]?.[fallbackKind] : undefined;
    if (byKind) return byKind;
    if (EXT_TO_MIME[ext]) return EXT_TO_MIME[ext];
  }

  if (fallbackKind) return KIND_DEFAULT[fallbackKind];

  // Last resort — must still be a valid media MIME. Default to image/jpeg
  // since it's the most common upload type; upload-core will accept it.
  return "image/jpeg";
}

/**
 * Returns a File whose .type is exactly the valid, parameter-less media MIME
 * from inferContentType. If the original file already carries that exact
 * type, it is returned unchanged; otherwise (missing type, parameterized
 * type, wrong case, or a type overridden by fallbackKind precedence) the
 * bytes are wrapped in a new File with the normalized type.
 */
export function ensureFileWithContentType(file: File, fallbackKind?: InferKind): File {
  const type = inferContentType(file, fallbackKind);
  if (file.type === type) return file;
  return new File([file], file.name, { type, lastModified: file.lastModified });
}
