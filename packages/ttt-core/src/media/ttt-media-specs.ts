import type { FileOrigin } from "./file-origin.js";
import type { MediaOriginSpec } from "@ttt-productions/media-schemas";
import { byMode } from "../constants/app-mode.js";

// Mode-aware media-origin registry. Two distinct caps per origin (see
// ttt-prod docs/design/charter-season-and-app-mode.md):
//  - `maxBytes` — the RAW-INPUT cap at the upload gate. Deliberately generous:
//    modern phones record high-bitrate by default and the user can't control
//    that; the pipeline absorbs it. This is an abuse bound, not the quality cap.
//  - processing `maxOutputBytes` / `maxDurationSec` — the PROCESSED-OUTPUT
//    spec the transcoder enforces. This is what actually gets stored/served.
// Charter mode = lower durations/output quality; full mode raises them.
// storage.rules `uploadMaxBytes` mirrors the raw caps — keep in sync (S6 test).

const MB = 1024 * 1024;

// --- Raw-input caps (upload gate) ---
const IMAGE_RAW_BYTES = 25 * MB; // 48MP phone HEIC/JPEG fits comfortably
const VIDEO_RAW_BYTES = byMode(500 * MB, 1024 * MB);
const AUDIO_RAW_BYTES = byMode(100 * MB, 250 * MB);
const CHAT_RAW_BYTES = byMode(250 * MB, 500 * MB);
// [H-01/R10] NCII take-it-down evidence: 100MB. The scan trigger downloads the whole object into a
// ~512MiB Function before scanning, so an allowed file must fit in memory. No mode variation (the
// evidence is preserveOriginal — never transcoded). Mirrored by storage.rules `uploadMaxBytes` (caps
// sync test) + NciiPolicyConfigV1.maxEvidenceFileBytes (104857600).
const NCII_EVIDENCE_RAW_BYTES = 100 * MB;

// --- Output duration caps (seconds) ---
const SHORT_VIDEO_DURATION_SEC = byMode(60, 180);
const ADMIN_PROMPT_DURATION_SEC = byMode(120, 600);
const TELEVISION_DURATION_SEC = byMode(300, 1800);
const LONG_AUDIO_DURATION_SEC = byMode(600, 900);
const CHAT_AUDIO_DURATION_SEC = byMode(60, 180);

// --- Output size caps (post-transcode) ---
const SHORT_VIDEO_OUTPUT_BYTES = byMode(60 * MB, 300 * MB);
const TELEVISION_OUTPUT_BYTES = byMode(200 * MB, 1024 * MB);
const AUDIO_OUTPUT_BYTES = byMode(20 * MB, 60 * MB);

// --- Output resolutions (full mode unlocks 1080p on the big surfaces) ---
const WIDE_VIDEO_WIDTH = byMode(1280, 1920);
const WIDE_VIDEO_HEIGHT = byMode(720, 1080);
const ENTRY_VIDEO_WIDTH = byMode(360, 720);
const ENTRY_VIDEO_HEIGHT = byMode(640, 1280);

// --- Client recording caps ---
const RECORD_DURATION_SEC = SHORT_VIDEO_DURATION_SEC;

const ACCEPT_IMAGE_ONLY = { kinds: ['image' as const] };
const ACCEPT_VIDEO_ONLY = { kinds: ['video' as const] };
const ACCEPT_AUDIO_ONLY = { kinds: ['audio' as const] };
const ACCEPT_MEDIA_ALL = { kinds: ['image' as const, 'video' as const, 'audio' as const] };
const ACCEPT_IMAGE_VIDEO = { kinds: ['image' as const, 'video' as const] };

export const TTT_MEDIA_SPECS: Record<FileOrigin, MediaOriginSpec> = {

  'profile-picture': {
    kind: 'image',
    accept: ACCEPT_IMAGE_ONLY,
    maxBytes: IMAGE_RAW_BYTES,
    imageCrop: {
      aspectRatio: 1,
      outputWidth: 200,
      outputHeight: 200,
      shape: 'round',
      format: 'jpeg',
      quality: 85,
      aspectRatioDisplay: '1:1',
    },
    client: {
      allowPick: true,
      allowCapturePhoto: true,
      allowRecordVideo: false,
      allowRecordAudio: false,
    },
    processing: {
      image: {
        kind: 'image',
        image: {
          variants: [
            { key: 'full', crop: { width: 200, height: 200, gravity: 'center' }, format: 'jpeg', quality: 85 },
            { key: 'medium', crop: { width: 48, height: 48, gravity: 'center' }, format: 'jpeg', quality: 85 },
            { key: 'small', crop: { width: 32, height: 32, gravity: 'center' }, format: 'jpeg', quality: 85 },
          ],
        },
      },
    },
  },

  'craft-skill-media': {
    kind: 'image',
    accept: ACCEPT_MEDIA_ALL,
    maxBytes: VIDEO_RAW_BYTES,
    maxDurationSec: SHORT_VIDEO_DURATION_SEC,
    imageCrop: {
      aspectRatio: 4 / 3,
      outputWidth: 800,
      outputHeight: 600,
      format: 'jpeg',
      quality: 85,
      aspectRatioDisplay: '4:3',
    },
    client: {
      allowPick: true,
      allowCapturePhoto: true,
      allowRecordVideo: true,
      allowRecordAudio: true,
      maxRecordDurationSec: RECORD_DURATION_SEC,
    },
    processing: {
      image: {
        kind: 'image',
        image: {
          variants: [
            { key: 'main', crop: { width: 800, height: 600, gravity: 'center' }, format: 'jpeg', quality: 85 },
          ],
        },
      },
      video: {
        kind: 'video',
        requiredWidth: 800,
        requiredHeight: 600,
        allowAutoFormat: true,
        maxDurationSec: SHORT_VIDEO_DURATION_SEC,
        maxOutputBytes: SHORT_VIDEO_OUTPUT_BYTES,
        video: { scaleMode: 'fit', preset: 'veryfast', crf: 28 },
      },
      audio: {
        kind: 'audio',
        maxOutputBytes: AUDIO_OUTPUT_BYTES,
        audio: { maxDurationSec: LONG_AUDIO_DURATION_SEC },
      },
    },
  },

  'hallLibrary-cover-square': {
    kind: 'image',
    accept: ACCEPT_IMAGE_ONLY,
    maxBytes: IMAGE_RAW_BYTES,
    imageCrop: {
      aspectRatio: 1,
      outputWidth: 600,
      outputHeight: 600,
      format: 'jpeg',
      quality: 85,
      aspectRatioDisplay: '1:1',
    },
    client: {
      allowPick: true,
      allowCapturePhoto: true,
      allowRecordVideo: false,
      allowRecordAudio: false,
    },
    processing: {
      image: {
        kind: 'image',
        image: {
          variants: [
            { key: 'full', crop: { width: 600, height: 600, gravity: 'center' }, format: 'jpeg', quality: 85 },
          ],
        },
      },
    },
  },

  'hallLibrary-cover-poster': {
    kind: 'image',
    accept: ACCEPT_IMAGE_ONLY,
    maxBytes: IMAGE_RAW_BYTES,
    imageCrop: {
      aspectRatio: 2 / 3,
      outputWidth: 400,
      outputHeight: 600,
      format: 'jpeg',
      quality: 85,
      aspectRatioDisplay: '2:3',
    },
    client: {
      allowPick: true,
      allowCapturePhoto: true,
      allowRecordVideo: false,
      allowRecordAudio: false,
    },
    processing: {
      image: {
        kind: 'image',
        image: {
          variants: [
            { key: 'full', crop: { width: 400, height: 600, gravity: 'center' }, format: 'jpeg', quality: 85 },
          ],
        },
      },
    },
  },

  'hallLibrary-cover-cinematic': {
    kind: 'image',
    accept: ACCEPT_IMAGE_ONLY,
    maxBytes: IMAGE_RAW_BYTES,
    imageCrop: {
      aspectRatio: 16 / 9,
      outputWidth: 1280,
      outputHeight: 720,
      format: 'jpeg',
      quality: 85,
      aspectRatioDisplay: '16:9',
    },
    client: {
      allowPick: true,
      allowCapturePhoto: true,
      allowRecordVideo: false,
      allowRecordAudio: false,
    },
    processing: {
      image: {
        kind: 'image',
        image: {
          variants: [
            { key: 'full', crop: { width: 1280, height: 720, gravity: 'center' }, format: 'jpeg', quality: 85 },
          ],
        },
      },
    },
  },

  'squareStreetz': {
    kind: 'image',
    accept: ACCEPT_MEDIA_ALL,
    maxBytes: VIDEO_RAW_BYTES,
    maxDurationSec: SHORT_VIDEO_DURATION_SEC,
    imageCrop: {
      aspectRatio: 16 / 9,
      outputWidth: 1280,
      outputHeight: 720,
      format: 'jpeg',
      quality: 85,
      aspectRatioDisplay: '16:9',
    },
    client: {
      allowPick: true,
      allowCapturePhoto: true,
      allowRecordVideo: true,
      allowRecordAudio: true,
      maxRecordDurationSec: RECORD_DURATION_SEC,
    },
    processing: {
      image: {
        kind: 'image',
        image: {
          variants: [
            { key: 'main', maxWidth: 1280, maxHeight: 720, format: 'jpeg', quality: 85 },
          ],
        },
      },
      video: {
        kind: 'video',
        requiredWidth: WIDE_VIDEO_WIDTH,
        requiredHeight: WIDE_VIDEO_HEIGHT,
        allowAutoFormat: true,
        maxDurationSec: SHORT_VIDEO_DURATION_SEC,
        maxOutputBytes: SHORT_VIDEO_OUTPUT_BYTES,
        video: { scaleMode: 'fit', preset: 'veryfast', crf: 28 },
      },
      audio: {
        kind: 'audio',
        maxOutputBytes: AUDIO_OUTPUT_BYTES,
        audio: { maxDurationSec: LONG_AUDIO_DURATION_SEC },
      },
    },
  },

  'audition-prompt': {
    kind: 'video',
    accept: ACCEPT_VIDEO_ONLY,
    maxBytes: VIDEO_RAW_BYTES,
    maxDurationSec: SHORT_VIDEO_DURATION_SEC,
    requiredAspectRatio: 16 / 9,
    videoOrientation: 'horizontal' as const,
    client: {
      allowPick: true,
      allowCapturePhoto: false,
      allowRecordVideo: true,
      allowRecordAudio: false,
      maxRecordDurationSec: RECORD_DURATION_SEC,
    },
    processing: {
      video: {
        kind: 'video',
        requiredWidth: WIDE_VIDEO_WIDTH,
        requiredHeight: WIDE_VIDEO_HEIGHT,
        allowAutoFormat: true,
        maxDurationSec: SHORT_VIDEO_DURATION_SEC,
        maxOutputBytes: SHORT_VIDEO_OUTPUT_BYTES,
        video: { scaleMode: 'fit', preset: 'veryfast', crf: 28 },
      },
    },
  },

  'admin-audition-prompt': {
    kind: 'video',
    accept: ACCEPT_VIDEO_ONLY,
    maxBytes: VIDEO_RAW_BYTES,
    maxDurationSec: ADMIN_PROMPT_DURATION_SEC,
    requiredAspectRatio: 16 / 9,
    videoOrientation: 'horizontal' as const,
    client: {
      allowPick: true,
      allowCapturePhoto: false,
      allowRecordVideo: true,
      allowRecordAudio: false,
      maxRecordDurationSec: ADMIN_PROMPT_DURATION_SEC,
    },
    processing: {
      video: {
        kind: 'video',
        requiredWidth: WIDE_VIDEO_WIDTH,
        requiredHeight: WIDE_VIDEO_HEIGHT,
        allowAutoFormat: true,
        maxDurationSec: ADMIN_PROMPT_DURATION_SEC,
        maxOutputBytes: SHORT_VIDEO_OUTPUT_BYTES,
        video: { scaleMode: 'fit', preset: 'veryfast', crf: 28 },
      },
    },
  },

  'audition-entry': {
    kind: 'video',
    accept: ACCEPT_VIDEO_ONLY,
    maxBytes: VIDEO_RAW_BYTES,
    maxDurationSec: SHORT_VIDEO_DURATION_SEC,
    requiredAspectRatio: 9 / 16,
    videoOrientation: 'vertical' as const,
    client: {
      allowPick: true,
      allowCapturePhoto: false,
      allowRecordVideo: true,
      allowRecordAudio: false,
      cameraFacingMode: 'user' as const,
      maxRecordDurationSec: RECORD_DURATION_SEC,
    },
    processing: {
      video: {
        kind: 'video',
        requiredWidth: ENTRY_VIDEO_WIDTH,
        requiredHeight: ENTRY_VIDEO_HEIGHT,
        allowAutoFormat: true,
        maxDurationSec: SHORT_VIDEO_DURATION_SEC,
        maxOutputBytes: SHORT_VIDEO_OUTPUT_BYTES,
        video: { scaleMode: 'fit', preset: 'veryfast', crf: 28 },
      },
    },
  },

  'commission-posting': {
    kind: 'image',
    accept: ACCEPT_MEDIA_ALL,
    maxBytes: VIDEO_RAW_BYTES,
    maxDurationSec: SHORT_VIDEO_DURATION_SEC,
    imageCrop: {
      aspectRatio: 4 / 3,
      outputWidth: 800,
      outputHeight: 600,
      format: 'jpeg',
      quality: 85,
      aspectRatioDisplay: '4:3',
    },
    client: {
      allowPick: true,
      allowCapturePhoto: true,
      allowRecordVideo: true,
      allowRecordAudio: true,
      maxRecordDurationSec: RECORD_DURATION_SEC,
    },
    processing: {
      image: {
        kind: 'image',
        image: {
          variants: [
            { key: 'main', crop: { width: 800, height: 600, gravity: 'center' }, format: 'jpeg', quality: 85 },
          ],
        },
      },
      video: {
        kind: 'video',
        requiredWidth: 800,
        requiredHeight: 600,
        allowAutoFormat: true,
        maxDurationSec: SHORT_VIDEO_DURATION_SEC,
        maxOutputBytes: SHORT_VIDEO_OUTPUT_BYTES,
        video: { scaleMode: 'fit', preset: 'veryfast', crf: 28 },
      },
      audio: {
        kind: 'audio',
        maxOutputBytes: AUDIO_OUTPUT_BYTES,
        audio: { maxDurationSec: LONG_AUDIO_DURATION_SEC },
      },
    },
  },

  'commission-proposal': {
    kind: 'image',
    accept: ACCEPT_MEDIA_ALL,
    maxBytes: VIDEO_RAW_BYTES,
    maxDurationSec: SHORT_VIDEO_DURATION_SEC,
    imageCrop: {
      aspectRatio: 4 / 3,
      outputWidth: 800,
      outputHeight: 600,
      format: 'jpeg',
      quality: 85,
      aspectRatioDisplay: '4:3',
    },
    client: {
      allowPick: true,
      allowCapturePhoto: true,
      allowRecordVideo: true,
      allowRecordAudio: true,
      maxRecordDurationSec: RECORD_DURATION_SEC,
    },
    processing: {
      image: {
        kind: 'image',
        image: {
          variants: [
            { key: 'main', crop: { width: 800, height: 600, gravity: 'center' }, format: 'jpeg', quality: 85 },
          ],
        },
      },
      video: {
        kind: 'video',
        requiredWidth: 800,
        requiredHeight: 600,
        allowAutoFormat: true,
        maxDurationSec: SHORT_VIDEO_DURATION_SEC,
        maxOutputBytes: SHORT_VIDEO_OUTPUT_BYTES,
        video: { scaleMode: 'fit', preset: 'veryfast', crf: 28 },
      },
      audio: {
        kind: 'audio',
        maxOutputBytes: AUDIO_OUTPUT_BYTES,
        audio: { maxDurationSec: LONG_AUDIO_DURATION_SEC },
      },
    },
  },

  'chapter-photo': {
    kind: 'image',
    accept: ACCEPT_IMAGE_ONLY,
    maxBytes: IMAGE_RAW_BYTES,
    imageCrop: {
      aspectRatio: 1,
      outputWidth: 400,
      outputHeight: 400,
      format: 'jpeg',
      quality: 85,
      aspectRatioDisplay: '1:1',
    },
    client: {
      allowPick: true,
      allowCapturePhoto: true,
      allowRecordVideo: false,
      allowRecordAudio: false,
    },
    processing: {
      image: {
        kind: 'image',
        image: {
          variants: [
            { key: 'full', crop: { width: 400, height: 400, gravity: 'center' }, format: 'jpeg', quality: 85 },
          ],
        },
      },
    },
  },

  'tune-track-photo': {
    kind: 'image',
    accept: ACCEPT_IMAGE_ONLY,
    maxBytes: IMAGE_RAW_BYTES,
    imageCrop: {
      aspectRatio: 1,
      outputWidth: 400,
      outputHeight: 400,
      format: 'jpeg',
      quality: 85,
      aspectRatioDisplay: '1:1',
    },
    client: {
      allowPick: true,
      allowCapturePhoto: true,
      allowRecordVideo: false,
      allowRecordAudio: false,
    },
    processing: {
      image: {
        kind: 'image',
        image: {
          variants: [
            { key: 'full', crop: { width: 400, height: 400, gravity: 'center' }, format: 'jpeg', quality: 85 },
          ],
        },
      },
    },
  },

  'television-episode-photo': {
    kind: 'image',
    accept: ACCEPT_IMAGE_ONLY,
    maxBytes: IMAGE_RAW_BYTES,
    imageCrop: {
      aspectRatio: 1,
      outputWidth: 400,
      outputHeight: 400,
      format: 'jpeg',
      quality: 85,
      aspectRatioDisplay: '1:1',
    },
    client: {
      allowPick: true,
      allowCapturePhoto: true,
      allowRecordVideo: false,
      allowRecordAudio: false,
    },
    processing: {
      image: {
        kind: 'image',
        image: {
          variants: [
            { key: 'full', crop: { width: 400, height: 400, gravity: 'center' }, format: 'jpeg', quality: 85 },
          ],
        },
      },
    },
  },

  'tune-track-audio': {
    kind: 'audio',
    accept: ACCEPT_AUDIO_ONLY,
    maxBytes: AUDIO_RAW_BYTES,
    maxDurationSec: LONG_AUDIO_DURATION_SEC,
    client: {
      allowPick: true,
      allowCapturePhoto: false,
      allowRecordVideo: false,
      allowRecordAudio: true,
      maxRecordDurationSec: RECORD_DURATION_SEC,
    },
    processing: {
      audio: {
        kind: 'audio',
        maxOutputBytes: AUDIO_OUTPUT_BYTES,
        audio: {
          maxDurationSec: LONG_AUDIO_DURATION_SEC,
        },
      },
    },
  },

  'television-episode-video': {
    kind: 'video',
    accept: ACCEPT_VIDEO_ONLY,
    maxBytes: VIDEO_RAW_BYTES,
    maxDurationSec: TELEVISION_DURATION_SEC,
    client: {
      allowPick: true,
      allowCapturePhoto: false,
      allowRecordVideo: true,
      allowRecordAudio: false,
      maxRecordDurationSec: RECORD_DURATION_SEC,
    },
    processing: {
      video: {
        kind: 'video',
        requiredWidth: WIDE_VIDEO_WIDTH,
        requiredHeight: WIDE_VIDEO_HEIGHT,
        allowAutoFormat: true,
        maxDurationSec: TELEVISION_DURATION_SEC,
        maxOutputBytes: TELEVISION_OUTPUT_BYTES,
        video: { scaleMode: 'fit', preset: 'veryfast', crf: 28 },
      },
    },
  },

  'guild-chat-message-attachment': {
    kind: 'generic',
    accept: ACCEPT_MEDIA_ALL,
    maxBytes: CHAT_RAW_BYTES,
    maxDurationSec: SHORT_VIDEO_DURATION_SEC,
    client: {
      allowPick: true,
      allowCapturePhoto: true,
      allowRecordVideo: true,
      allowRecordAudio: true,
    },
    processing: {
      image: {
        kind: 'image',
        image: {
          variants: [
            { key: 'main', maxWidth: 800, maxHeight: 800, format: 'jpeg', quality: 85 },
          ],
        },
      },
      video: {
        kind: 'video',
        requiredWidth: 800,
        requiredHeight: 600,
        allowAutoFormat: true,
        maxDurationSec: SHORT_VIDEO_DURATION_SEC,
        maxOutputBytes: SHORT_VIDEO_OUTPUT_BYTES,
        video: { scaleMode: 'fit', preset: 'veryfast', crf: 28 },
      },
      audio: {
        kind: 'audio',
        maxOutputBytes: AUDIO_OUTPUT_BYTES,
        audio: { maxDurationSec: CHAT_AUDIO_DURATION_SEC },
      },
    },
  },

  'work-asset': {
    kind: 'generic',
    accept: ACCEPT_MEDIA_ALL,
    maxBytes: VIDEO_RAW_BYTES,
    maxDurationSec: SHORT_VIDEO_DURATION_SEC,
    client: {
      allowPick: true,
      allowCapturePhoto: true,
      allowRecordVideo: true,
      allowRecordAudio: true,
      maxRecordDurationSec: RECORD_DURATION_SEC,
    },
    processing: {
      image: {
        kind: 'image',
        image: {
          variants: [
            { key: 'main', maxWidth: 1280, maxHeight: 1280, format: 'jpeg', quality: 85 },
          ],
        },
      },
      video: {
        kind: 'video',
        requiredWidth: WIDE_VIDEO_WIDTH,
        requiredHeight: WIDE_VIDEO_HEIGHT,
        allowAutoFormat: true,
        maxDurationSec: SHORT_VIDEO_DURATION_SEC,
        maxOutputBytes: SHORT_VIDEO_OUTPUT_BYTES,
        video: { scaleMode: 'fit', preset: 'veryfast', crf: 28 },
      },
      audio: {
        kind: 'audio',
        maxOutputBytes: AUDIO_OUTPUT_BYTES,
        audio: {
          maxDurationSec: SHORT_VIDEO_DURATION_SEC,
        },
      },
    },
  },

  // NCII / TAKE IT DOWN evidence: a take-it-down requester (App Check, no login)
  // uploads the actual image/video as evidence. Preserved BYTE-EXACT — NO
  // `processing` block, so the pipeline never transcodes/resizes it (legal
  // integrity + the hash). Never served — the evidence processor scans it, lands
  // the original in the admin-only nciiEvidence bucket, and stops.
  'ncii-evidence': {
    kind: 'generic',
    accept: ACCEPT_IMAGE_VIDEO,
    // [H-01/R10] 100MB (was VIDEO_RAW_BYTES=500MB) — see NCII_EVIDENCE_RAW_BYTES.
    maxBytes: NCII_EVIDENCE_RAW_BYTES,
    // Byte-exact: scanned, but NEVER transcoded/resized (legal evidence integrity).
    // The explicit flag marks this no-`processing` origin as intentional, not forgotten.
    preserveOriginal: true,
    client: {
      allowPick: true,
      allowCapturePhoto: false,
      allowRecordVideo: false,
      allowRecordAudio: false,
    },
  },

};
