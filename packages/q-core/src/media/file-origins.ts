// The upload origin registry (MEDIA-001, MEDIA-006). One origin value binds everything an
// upload touches: the picker spec, the staging path and its `storage.rules` cap and content type,
// the callable that accepts the upload, and — for a picture — the processing spec and the owner the
// picture is published to. The generic packages treat an origin id as opaque; the policy is here.
//
// Picture origins are processed into their kind's declared sizes and keep no master. Signature
// origins are kept byte-exact (`preserveOriginal`) by the callable that records them and are never
// processed. Adding an origin is one change across this registry, `storage.rules`, the processor
// routing, and their tests; `storage.rules` restates the caps and content types, and a guard pins it
// to this file.

import type { MediaAccept, MediaOriginSpec } from '@ttt-productions/media-schemas';
import { PICTURE_VARIANT_KEYS } from '../types/unions.js';
import type { PictureVariantKey } from '../types/unions.js';
import { PICTURE_ASPECT_RATIOS, pictureAspectRatio } from './picture-aspects.js';
import type { PictureAspect } from './picture-aspects.js';

export const PICTURE_ORIGIN_KEYS = [
  'league-picture',
  'team-picture',
  'landing-picture',
  'location-picture',
  'award-badge',
] as const;
export type PictureOrigin = (typeof PICTURE_ORIGIN_KEYS)[number];

export const SIGNATURE_ORIGIN_KEYS = ['waiver-signature', 'hardware-signature'] as const;
export type SignatureOrigin = (typeof SIGNATURE_ORIGIN_KEYS)[number];

export const FILE_ORIGIN_KEYS = [...PICTURE_ORIGIN_KEYS, ...SIGNATURE_ORIGIN_KEYS] as const;
export type FileOrigin = PictureOrigin | SignatureOrigin;

const MB = 1024 * 1024;

// The raw cap is an abuse bound: the browser uploads a picture already cropped and shrunk to its
// kind's largest size, so a real upload is far below it.
export const PICTURE_UPLOAD_MAX_BYTES = 25 * MB;

// A photo's browser crop and every stored size are JPEG at this quality.
export const PICTURE_JPEG_QUALITY = 85;

// What a picture kind is stored as: a photo as JPEG, a badge as PNG, which keeps the transparent
// corners of a badge drawn round.
export const PICTURE_STORED_FORMAT_KEYS = ['jpeg', 'png'] as const;
export type PictureStoredFormat = (typeof PICTURE_STORED_FORMAT_KEYS)[number];

// The cropper's mask: a rectangle, or a circle for a badge — which is how a badge is drawn, though
// the stored image is square.
export const PICTURE_CROP_SHAPE_KEYS = ['rect', 'round'] as const;
export type PictureCropShape = (typeof PICTURE_CROP_SHAPE_KEYS)[number];

// Picture formats the server's byte inspection accepts. Scriptable or unproven formats (svg, heic,
// avif) are not accepted.
export const PICTURE_ACCEPTED_FORMATS = ['jpeg', 'png', 'gif', 'webp', 'bmp', 'tiff'] as const;

export const PICTURE_ACCEPT: MediaAccept = {
  kinds: ['image'],
  formats: [...PICTURE_ACCEPTED_FORMATS],
};

export interface PictureSize {
  readonly width: number;
  readonly height: number;
}

export interface PictureKind {
  /** The shape the browser crops to, the server re-crops to, and every display frames. */
  readonly aspect: PictureAspect;
  /** Each stored size, at the kind's shape. `lg` is also the size the browser crops to. */
  readonly sizes: Readonly<Record<PictureVariantKey, PictureSize>>;
  /** The format of the browser's crop and of every stored size. */
  readonly format: PictureStoredFormat;
  readonly cropShape: PictureCropShape;
}

export const PICTURE_KINDS = {
  'league-picture': {
    aspect: 'landscape',
    format: 'jpeg',
    cropShape: 'rect',
    sizes: {
      sm: { width: 480, height: 270 },
      md: { width: 960, height: 540 },
      lg: { width: 1920, height: 1080 },
    },
  },
  'team-picture': {
    aspect: 'classic',
    format: 'jpeg',
    cropShape: 'rect',
    sizes: {
      sm: { width: 480, height: 360 },
      md: { width: 960, height: 720 },
      lg: { width: 1600, height: 1200 },
    },
  },
  'landing-picture': {
    aspect: 'banner',
    format: 'jpeg',
    cropShape: 'rect',
    sizes: {
      sm: { width: 720, height: 240 },
      md: { width: 1440, height: 480 },
      lg: { width: 2400, height: 800 },
    },
  },
  'location-picture': {
    aspect: 'landscape',
    format: 'jpeg',
    cropShape: 'rect',
    sizes: {
      sm: { width: 480, height: 270 },
      md: { width: 960, height: 540 },
      lg: { width: 1280, height: 720 },
    },
  },
  // A badge is cropped in a round mask and kept square, at the sizes every award has always had.
  'award-badge': {
    aspect: 'square',
    format: 'png',
    cropShape: 'round',
    sizes: {
      sm: { width: 64, height: 64 },
      md: { width: 256, height: 256 },
      lg: { width: 512, height: 512 },
    },
  },
} as const satisfies Record<PictureOrigin, PictureKind>;

function pictureOriginSpec(kind: PictureKind): MediaOriginSpec {
  const ratio = pictureAspectRatio(kind.aspect);
  const { width, height } = PICTURE_ASPECT_RATIOS[kind.aspect];
  const variants = PICTURE_VARIANT_KEYS.map((key) => ({
    key,
    crop: {
      width: kind.sizes[key].width,
      height: kind.sizes[key].height,
      gravity: 'center' as const,
    },
    format: kind.format,
    ...(kind.format === 'jpeg' ? { quality: PICTURE_JPEG_QUALITY } : {}),
  }));
  return {
    kind: 'image',
    accept: PICTURE_ACCEPT,
    maxBytes: PICTURE_UPLOAD_MAX_BYTES,
    imageCrop: {
      aspectRatio: ratio,
      outputWidth: kind.sizes.lg.width,
      outputHeight: kind.sizes.lg.height,
      shape: kind.cropShape,
      format: kind.format,
      ...(kind.format === 'jpeg' ? { quality: PICTURE_JPEG_QUALITY } : {}),
      aspectRatioDisplay: `${width}:${height}`,
    },
    client: {
      allowPick: true,
      allowCapturePhoto: true,
      allowRecordVideo: false,
      allowRecordAudio: false,
    },
    processing: {
      // The server trusts nothing the browser did: an upload that bypassed the app's cropper is
      // centre-cropped to the kind's shape (`requiredAspectRatio` with `allowAutoFormat`) before
      // every size is cut, and a source smaller than a size is never enlarged.
      image: {
        kind: 'image',
        accept: PICTURE_ACCEPT,
        maxBytes: PICTURE_UPLOAD_MAX_BYTES,
        requiredAspectRatio: ratio,
        allowAutoFormat: true,
        image: { variants, stripMetadata: true },
      },
    },
  };
}

// A signature is drawn on a canvas and exported as PNG, so exactly `image/png` is accepted — no
// other image type, and never the neutral octet-stream lane. It is kept byte-exact by the callable
// that records it, and nothing processes it.
export const SIGNATURE_UPLOAD_MAX_BYTES = 1 * MB;
export const SIGNATURE_CONTENT_TYPE = 'image/png';

export const SIGNATURE_ACCEPT: MediaAccept = {
  kinds: ['file'],
  mimes: [SIGNATURE_CONTENT_TYPE],
};

function signatureOriginSpec(): MediaOriginSpec {
  return {
    kind: 'generic',
    accept: SIGNATURE_ACCEPT,
    maxBytes: SIGNATURE_UPLOAD_MAX_BYTES,
    client: {
      allowPick: false,
      allowCapturePhoto: false,
      allowRecordVideo: false,
      allowRecordAudio: false,
    },
    preserveOriginal: true,
  };
}

export const MEDIA_ORIGIN_SPECS: Readonly<Record<FileOrigin, MediaOriginSpec>> = {
  'league-picture': pictureOriginSpec(PICTURE_KINDS['league-picture']),
  'team-picture': pictureOriginSpec(PICTURE_KINDS['team-picture']),
  'landing-picture': pictureOriginSpec(PICTURE_KINDS['landing-picture']),
  'location-picture': pictureOriginSpec(PICTURE_KINDS['location-picture']),
  'award-badge': pictureOriginSpec(PICTURE_KINDS['award-badge']),
  // Promoted to its kept path by the waiver-signing callable.
  'waiver-signature': signatureOriginSpec(),
  // Promoted to its kept path by the hardware contract's signing callable.
  'hardware-signature': signatureOriginSpec(),
};

export function isFileOrigin(value: string): value is FileOrigin {
  return (FILE_ORIGIN_KEYS as readonly string[]).includes(value);
}

export function isPictureOrigin(value: string): value is PictureOrigin {
  return (PICTURE_ORIGIN_KEYS as readonly string[]).includes(value);
}

export function isSignatureOrigin(value: string): value is SignatureOrigin {
  return (SIGNATURE_ORIGIN_KEYS as readonly string[]).includes(value);
}
