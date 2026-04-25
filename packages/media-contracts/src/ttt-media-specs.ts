import type { FileOrigin } from "./file-origin.js";
import type { TTTMediaOriginEntry } from "./types.js";

const DEFAULT_RECORD_DURATION_SEC = 60;

const ACCEPT_IMAGE_ONLY = { kinds: ['image' as const] };
const ACCEPT_VIDEO_ONLY = { kinds: ['video' as const] };
const ACCEPT_AUDIO_ONLY = { kinds: ['audio' as const] };
const ACCEPT_IMAGE_VIDEO = { kinds: ['image' as const, 'video' as const] };
const ACCEPT_MEDIA_ALL = { kinds: ['image' as const, 'video' as const, 'audio' as const] };
const ACCEPT_MEDIA_AND_TEXT = {
  kinds: ['image' as const, 'video' as const, 'audio' as const, 'file' as const],
  mimes: ['image/*', 'video/*', 'audio/*', 'text/plain', 'text/markdown'],
};

export const TTT_MEDIA_SPECS = {

  'profile-picture': {
    kind: 'image',
    accept: ACCEPT_IMAGE_ONLY,
    maxBytes: 5 * 1024 * 1024,
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

  'skill-media': {
    kind: 'image',
    accept: ACCEPT_MEDIA_ALL,
    maxBytes: 10 * 1024 * 1024,
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
      maxRecordDurationSec: DEFAULT_RECORD_DURATION_SEC,
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
        video: { scaleMode: 'fit', preset: 'veryfast', crf: 28 },
      },
      audio: {
        kind: 'audio',
        audio: { maxDurationSec: 600 },
      },
    },
  },

  'library-cover-square': {
    kind: 'image',
    accept: ACCEPT_IMAGE_ONLY,
    maxBytes: 5 * 1024 * 1024,
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
      allowCapturePhoto: false,
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

  'library-cover-poster': {
    kind: 'image',
    accept: ACCEPT_IMAGE_ONLY,
    maxBytes: 5 * 1024 * 1024,
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
      allowCapturePhoto: false,
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

  'library-cover-cinematic': {
    kind: 'image',
    accept: ACCEPT_IMAGE_ONLY,
    maxBytes: 5 * 1024 * 1024,
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
      allowCapturePhoto: false,
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

  'streetz': {
    kind: 'image',
    accept: ACCEPT_MEDIA_ALL,
    maxBytes: 10 * 1024 * 1024,
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
      maxRecordDurationSec: DEFAULT_RECORD_DURATION_SEC,
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
        requiredWidth: 1280,
        requiredHeight: 720,
        allowAutoFormat: true,
        video: { scaleMode: 'fit', preset: 'veryfast', crf: 28 },
      },
      audio: {
        kind: 'audio',
        audio: { maxDurationSec: 600 },
      },
    },
  },

  'opportunity-prompt': {
    kind: 'video',
    accept: ACCEPT_VIDEO_ONLY,
    maxBytes: 25 * 1024 * 1024,
    maxDurationSec: DEFAULT_RECORD_DURATION_SEC,
    requiredAspectRatio: 16 / 9,
    videoOrientation: 'horizontal' as const,
    client: {
      allowPick: true,
      allowCapturePhoto: false,
      allowRecordVideo: true,
      allowRecordAudio: false,
      maxRecordDurationSec: DEFAULT_RECORD_DURATION_SEC,
    },
    processing: {
      video: {
        kind: 'video',
        requiredWidth: 1280,
        requiredHeight: 720,
        allowAutoFormat: true,
        video: { scaleMode: 'fit', preset: 'veryfast', crf: 28 },
      },
    },
  },

  'opportunity-reply': {
    kind: 'video',
    accept: ACCEPT_VIDEO_ONLY,
    maxBytes: 50 * 1024 * 1024,
    maxDurationSec: DEFAULT_RECORD_DURATION_SEC,
    requiredAspectRatio: 9 / 16,
    videoOrientation: 'vertical' as const,
    client: {
      allowPick: true,
      allowCapturePhoto: false,
      allowRecordVideo: true,
      allowRecordAudio: false,
      cameraFacingMode: 'user' as const,
      maxRecordDurationSec: DEFAULT_RECORD_DURATION_SEC,
    },
    processing: {
      video: {
        kind: 'video',
        requiredWidth: 360,
        requiredHeight: 640,
        allowAutoFormat: true,
        video: { scaleMode: 'fit', preset: 'veryfast', crf: 28 },
      },
    },
  },

  'job-posting': {
    kind: 'image',
    accept: ACCEPT_IMAGE_VIDEO,
    maxBytes: 5 * 1024 * 1024,
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
      allowCapturePhoto: false,
      allowRecordVideo: false,
      allowRecordAudio: false,
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
        video: { scaleMode: 'fit', preset: 'veryfast', crf: 28 },
      },
    },
  },

  'job-reply': {
    kind: 'image',
    accept: ACCEPT_IMAGE_VIDEO,
    maxBytes: 10 * 1024 * 1024,
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
      allowCapturePhoto: false,
      allowRecordVideo: false,
      allowRecordAudio: false,
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
        video: { scaleMode: 'fit', preset: 'veryfast', crf: 28 },
      },
    },
  },

  'chapter-photo': {
    kind: 'image',
    accept: ACCEPT_IMAGE_ONLY,
    maxBytes: 5 * 1024 * 1024,
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

  'song-photo': {
    kind: 'image',
    accept: ACCEPT_IMAGE_ONLY,
    maxBytes: 5 * 1024 * 1024,
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

  'show-photo': {
    kind: 'image',
    accept: ACCEPT_IMAGE_ONLY,
    maxBytes: 5 * 1024 * 1024,
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

  'song-audio': {
    kind: 'audio',
    accept: ACCEPT_AUDIO_ONLY,
    maxBytes: 25 * 1024 * 1024,
    client: {
      allowPick: true,
      allowCapturePhoto: false,
      allowRecordVideo: false,
      allowRecordAudio: true,
      maxRecordDurationSec: DEFAULT_RECORD_DURATION_SEC,
    },
    processing: {
      audio: {
        kind: 'audio',
        audio: {
          maxDurationSec: 600,
        },
      },
    },
  },

  'show-video': {
    kind: 'video',
    accept: ACCEPT_VIDEO_ONLY,
    maxBytes: 250 * 1024 * 1024,
    client: {
      allowPick: true,
      allowCapturePhoto: false,
      allowRecordVideo: true,
      allowRecordAudio: false,
      maxRecordDurationSec: DEFAULT_RECORD_DURATION_SEC,
    },
    processing: {
      video: {
        kind: 'video',
        requiredWidth: 1280,
        requiredHeight: 720,
        allowAutoFormat: true,
        video: { scaleMode: 'fit', preset: 'veryfast', crf: 28 },
      },
    },
  },

  'chat-attachment': {
    kind: 'generic',
    accept: ACCEPT_MEDIA_AND_TEXT,
    maxBytes: 10 * 1024 * 1024,
    maxDurationSec: 60,
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
        video: { scaleMode: 'fit', preset: 'veryfast', crf: 28 },
      },
    },
  },

} as const satisfies Record<FileOrigin, TTTMediaOriginEntry>;
