// Defense-in-depth: guarantee every File we emit has a valid media MIME
// (image/*, video/*, or audio/*). If file.type is missing or unusable,
// infer from the extension; if the extension is unknown, fall back to a
// kind-appropriate default.
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

const KIND_DEFAULT: Record<InferKind, string> = {
  image: "image/jpeg",
  video: "video/webm",
  audio: "audio/webm",
};

function isValid(mime: string | undefined | null): mime is string {
  if (!mime) return false;
  const ct = mime.toLowerCase().trim();
  if (ct === "application/octet-stream") return false;
  return /^(image|video|audio)\/[a-z0-9.+-]+$/.test(ct);
}

function extOf(name: string): string | null {
  const dot = name.lastIndexOf(".");
  if (dot < 0 || dot === name.length - 1) return null;
  return name.slice(dot + 1).toLowerCase();
}

/**
 * Returns a valid media MIME for the given File, using file.type when possible,
 * falling back to extension lookup, and finally to a kind-default.
 */
export function inferContentType(file: File, fallbackKind?: InferKind): string {
  if (isValid(file.type)) return file.type.toLowerCase();

  const ext = extOf(file.name);
  if (ext && EXT_TO_MIME[ext]) return EXT_TO_MIME[ext];

  if (fallbackKind) return KIND_DEFAULT[fallbackKind];

  // Last resort — must still be a valid media MIME. Default to image/jpeg
  // since it's the most common upload type; upload-core will accept it.
  return "image/jpeg";
}

/**
 * Returns a new File with a guaranteed valid contentType. If the original
 * file already has a valid type, returns it unchanged. Otherwise wraps the
 * bytes in a new File with the inferred type.
 */
export function ensureFileWithContentType(file: File, fallbackKind?: InferKind): File {
  if (isValid(file.type)) return file;
  const type = inferContentType(file, fallbackKind);
  return new File([file], file.name, { type, lastModified: file.lastModified });
}
