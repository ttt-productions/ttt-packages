import { MediaFormatIdSchema } from "./schemas.js";
import type { z } from "zod";
import type { MediaKind } from "./types.js";

// =============================================================================
// Generic supported-format registry (mechanism + web-standard catalog)
// =============================================================================
//
// ONE extension point for "which concrete formats exist and how a picker
// advertises them". Entries here are WEB FACTS (containers, their MIME aliases,
// their extensions) — not product policy. POLICY (which formats an origin
// accepts) is a per-origin `formats: MediaFormatId[]` selection owned by the
// application's origin registry (`TTT_MEDIA_SPECS` in @ttt-productions/ttt-core).
//
// Contract (canonical-upload-content-classification design):
//   - the app's origin specs SELECT allowed format ids;
//   - @ttt-productions/file-input PROJECTS those ids to the browser `accept`
//     attribute via `projectAcceptTokens` (MIME + extension tokens, for
//     discoverability only — never validation authority);
//   - the SERVER accepts only an INSPECTED formatId enabled for the origin.
//     MIME and extension are advisory everywhere.
//
// Shared A/V containers (`family: 'av-container'`) are semantic containers:
// their entry never predetermines audio vs video — complete stream inspection
// does. Their MIME aliases are therefore split per kind so a kinds-constrained
// origin (e.g. audio-only) projects only the matching aliases.
//
// Adding an entry here NEVER enables anything by itself: a format becomes
// usable only when an origin selects it AND the server inspector proves and
// accepts it (each new family still needs its processing/safety/serving policy
// per the extension model).

export { MediaFormatIdSchema };
export type MediaFormatId = z.infer<typeof MediaFormatIdSchema>;

export type MediaFormatFamily = "image" | "audio" | "av-container";

export interface MediaFormatDefinition {
  readonly formatId: MediaFormatId;
  readonly family: MediaFormatFamily;
  /** Picker MIME aliases. Single-kind families use `all`; shared containers
   *  split per semantic kind so kind-constrained origins project narrowly. */
  readonly mimes: { readonly all?: readonly string[] } & Partial<
    Record<"image" | "video" | "audio", readonly string[]>
  >;
  readonly extensions: readonly string[];
}

export const MEDIA_FORMATS: Readonly<Record<MediaFormatId, MediaFormatDefinition>> = {
  jpeg: { formatId: "jpeg", family: "image", mimes: { all: ["image/jpeg"] }, extensions: ["jpg", "jpeg"] },
  png: { formatId: "png", family: "image", mimes: { all: ["image/png"] }, extensions: ["png"] },
  gif: { formatId: "gif", family: "image", mimes: { all: ["image/gif"] }, extensions: ["gif"] },
  webp: { formatId: "webp", family: "image", mimes: { all: ["image/webp"] }, extensions: ["webp"] },
  bmp: { formatId: "bmp", family: "image", mimes: { all: ["image/bmp"] }, extensions: ["bmp"] },
  tiff: { formatId: "tiff", family: "image", mimes: { all: ["image/tiff"] }, extensions: ["tif", "tiff"] },
  avif: { formatId: "avif", family: "image", mimes: { all: ["image/avif"] }, extensions: ["avif"] },
  heic: {
    formatId: "heic",
    family: "image",
    mimes: { all: ["image/heic", "image/heif"] },
    extensions: ["heic", "heif"],
  },
  svg: { formatId: "svg", family: "image", mimes: { all: ["image/svg+xml"] }, extensions: ["svg"] },

  mp3: { formatId: "mp3", family: "audio", mimes: { all: ["audio/mpeg"] }, extensions: ["mp3"] },
  wav: { formatId: "wav", family: "audio", mimes: { all: ["audio/wav", "audio/x-wav"] }, extensions: ["wav"] },
  flac: { formatId: "flac", family: "audio", mimes: { all: ["audio/flac"] }, extensions: ["flac"] },

  isobmff: {
    formatId: "isobmff",
    family: "av-container",
    mimes: {
      video: ["video/mp4", "video/quicktime"],
      audio: ["audio/mp4", "audio/x-m4a", "audio/aac"],
    },
    extensions: ["mp4", "m4v", "mov", "m4a", "aac"],
  },
  webm: {
    formatId: "webm",
    family: "av-container",
    mimes: {
      video: ["video/webm", "video/x-matroska"],
      audio: ["audio/webm"],
    },
    extensions: ["webm", "mkv"],
  },
  ogg: {
    formatId: "ogg",
    family: "av-container",
    mimes: {
      video: ["video/ogg"],
      audio: ["audio/ogg"],
    },
    extensions: ["ogg", "oga", "opus"],
  },
};

/**
 * Project a policy-selected format set into browser `accept` attribute tokens
 * (MIME aliases + dot-extensions). `kinds` narrows shared-container aliases to
 * the origin's semantic kinds (an audio-only origin never advertises
 * `video/mp4`). Discoverability ONLY — client validation stays fail-open and
 * the server inspector is the authority.
 */
export function projectAcceptTokens(
  formatIds: readonly MediaFormatId[],
  kinds?: readonly MediaKind[],
): string[] {
  const tokens: string[] = [];
  const wantKind = (k: "image" | "video" | "audio"): boolean =>
    !kinds || kinds.length === 0 || kinds.includes(k);
  for (const id of formatIds) {
    const def = MEDIA_FORMATS[id];
    if (!def) continue;
    const familyKind = def.family === "image" ? "image" : def.family === "audio" ? "audio" : null;
    if (familyKind) {
      if (!wantKind(familyKind)) continue;
      for (const m of def.mimes.all ?? []) tokens.push(m);
    } else {
      // shared container: per-kind aliases, narrowed by the origin's kinds
      for (const k of ["image", "video", "audio"] as const) {
        if (!wantKind(k)) continue;
        for (const m of def.mimes[k] ?? []) tokens.push(m);
      }
    }
    // Extensions ride along whenever ANY alias of the entry was projected —
    // they widen discoverability on pickers that match by extension. For a
    // kind-narrowed shared container the extension token is still correct
    // (a .mp4 audio file is selectable for an audio origin).
    if (familyKind ? wantKind(familyKind) : (["image", "video", "audio"] as const).some(wantKind)) {
      for (const ext of def.extensions) tokens.push(`.${ext}`);
    }
  }
  return [...new Set(tokens)];
}
