import type { FileOrigin } from './file-origin.js';
import type { MediaOriginSpec } from '@ttt-productions/media-schemas';
import { APP_MODE, valueInMode, type AppMode } from '../constants/app-mode.js';
import { NCII_EVIDENCE_MAX_FILE_BYTES } from '../doc-schemas/ncii/config.js';
import { MIB } from '../constants/byte-units.js';

// storage.rules restates the raw-input caps because rules cannot import TypeScript.

const IMAGE_RAW_BYTES = 25 * MIB;
const FULL_VIDEO_RAW_BYTES = 1024 * MIB;
const NCII_EVIDENCE_RAW_BYTES = NCII_EVIDENCE_MAX_FILE_BYTES;

const FULL_TELEVISION_DURATION_SEC = 1800;
const FULL_TELEVISION_OUTPUT_BYTES = 1024 * MIB;

const SYSTEM_CONTENT_DURATION_SEC = FULL_TELEVISION_DURATION_SEC;
const SYSTEM_CONTENT_RAW_BYTES = FULL_VIDEO_RAW_BYTES;
const SYSTEM_CONTENT_OUTPUT_BYTES = FULL_TELEVISION_OUTPUT_BYTES;

const IMAGE_FORMATS = ['jpeg', 'png', 'gif', 'webp', 'bmp', 'tiff'] as const;
const AUDIO_FORMATS = ['mp3', 'wav', 'flac', 'isobmff', 'webm', 'ogg'] as const;
const VIDEO_FORMATS = ['isobmff', 'webm'] as const;

const ACCEPT_IMAGE_ONLY = { kinds: ['image' as const], formats: [...IMAGE_FORMATS] };
const ACCEPT_VIDEO_ONLY = { kinds: ['video' as const], formats: [...VIDEO_FORMATS] };
const ACCEPT_AUDIO_ONLY = { kinds: ['audio' as const], formats: [...AUDIO_FORMATS] };
const ACCEPT_MEDIA_ALL = {
  kinds: ['image' as const, 'video' as const, 'audio' as const],
  formats: [...new Set([...IMAGE_FORMATS, ...VIDEO_FORMATS, ...AUDIO_FORMATS])],
};
const ACCEPT_IMAGE_VIDEO = {
  kinds: ['image' as const, 'video' as const],
  formats: [...new Set([...IMAGE_FORMATS, ...VIDEO_FORMATS])],
};

export function tttMediaSpecsFor(mode: AppMode): Record<FileOrigin, MediaOriginSpec> {
  const inMode = <T>(charter: T, full: T): T => valueInMode(mode, charter, full);

  const VIDEO_RAW_BYTES = inMode(500 * MIB, FULL_VIDEO_RAW_BYTES);
  const AUDIO_RAW_BYTES = inMode(100 * MIB, 250 * MIB);
  const CONVERSATION_FILE_RAW_BYTES = inMode(250 * MIB, 500 * MIB);

  const SHORT_VIDEO_DURATION_SEC = inMode(60, 180);
  const ADMIN_PROMPT_DURATION_SEC = inMode(120, 600);
  const TELEVISION_DURATION_SEC = inMode(300, FULL_TELEVISION_DURATION_SEC);
  const LONG_AUDIO_DURATION_SEC = inMode(600, 900);
  const CONVERSATION_FILE_AUDIO_DURATION_SEC = inMode(60, 180);

  const SHORT_VIDEO_OUTPUT_BYTES = inMode(60 * MIB, 300 * MIB);
  const TELEVISION_OUTPUT_BYTES = inMode(200 * MIB, FULL_TELEVISION_OUTPUT_BYTES);
  const AUDIO_OUTPUT_BYTES = inMode(20 * MIB, 60 * MIB);

  const WIDE_VIDEO_WIDTH = inMode(1280, 1920);
  const WIDE_VIDEO_HEIGHT = inMode(720, 1080);
  const ENTRY_VIDEO_WIDTH = inMode(360, 720);
  const ENTRY_VIDEO_HEIGHT = inMode(640, 1280);

  const RECORD_DURATION_SEC = SHORT_VIDEO_DURATION_SEC;

  return {
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
              {
                key: 'full',
                crop: { width: 200, height: 200, gravity: 'center' },
                format: 'jpeg',
                quality: 85,
              },
              {
                key: 'medium',
                crop: { width: 48, height: 48, gravity: 'center' },
                format: 'jpeg',
                quality: 85,
              },
              {
                key: 'small',
                crop: { width: 32, height: 32, gravity: 'center' },
                format: 'jpeg',
                quality: 85,
              },
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
              {
                key: 'main',
                crop: { width: 800, height: 600, gravity: 'center' },
                format: 'jpeg',
                quality: 85,
              },
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
              {
                key: 'full',
                crop: { width: 600, height: 600, gravity: 'center' },
                format: 'jpeg',
                quality: 85,
              },
            ],
          },
        },
      },
    },

    'realm-cover': {
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
              {
                key: 'full',
                crop: { width: 600, height: 600, gravity: 'center' },
                format: 'jpeg',
                quality: 85,
              },
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
              {
                key: 'full',
                crop: { width: 400, height: 600, gravity: 'center' },
                format: 'jpeg',
                quality: 85,
              },
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
              {
                key: 'full',
                crop: { width: 1280, height: 720, gravity: 'center' },
                format: 'jpeg',
                quality: 85,
              },
            ],
          },
        },
      },
    },

    squareStreetz: {
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
              {
                key: 'main',
                crop: { width: 800, height: 600, gravity: 'center' },
                format: 'jpeg',
                quality: 85,
              },
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
              {
                key: 'main',
                crop: { width: 800, height: 600, gravity: 'center' },
                format: 'jpeg',
                quality: 85,
              },
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
              {
                key: 'full',
                crop: { width: 400, height: 400, gravity: 'center' },
                format: 'jpeg',
                quality: 85,
              },
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
              {
                key: 'full',
                crop: { width: 400, height: 400, gravity: 'center' },
                format: 'jpeg',
                quality: 85,
              },
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
              {
                key: 'full',
                crop: { width: 400, height: 400, gravity: 'center' },
                format: 'jpeg',
                quality: 85,
              },
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

    'conversation-file': {
      kind: 'generic',
      accept: ACCEPT_MEDIA_ALL,
      maxBytes: CONVERSATION_FILE_RAW_BYTES,
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
            variants: [{ key: 'main', maxWidth: 800, maxHeight: 800, format: 'jpeg', quality: 85 }],
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
          audio: { maxDurationSec: CONVERSATION_FILE_AUDIO_DURATION_SEC },
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

    'system-content': {
      kind: 'video',
      accept: ACCEPT_VIDEO_ONLY,
      maxBytes: SYSTEM_CONTENT_RAW_BYTES,
      maxDurationSec: SYSTEM_CONTENT_DURATION_SEC,
      requiredAspectRatio: 16 / 9,
      videoOrientation: 'horizontal' as const,
      client: {
        allowPick: true,
        allowCapturePhoto: false,
        allowRecordVideo: false,
        allowRecordAudio: false,
      },
      processing: {
        video: {
          kind: 'video',
          requiredWidth: WIDE_VIDEO_WIDTH,
          requiredHeight: WIDE_VIDEO_HEIGHT,
          allowAutoFormat: true,
          maxDurationSec: SYSTEM_CONTENT_DURATION_SEC,
          maxOutputBytes: SYSTEM_CONTENT_OUTPUT_BYTES,
          video: { scaleMode: 'fit', preset: 'veryfast', crf: 28 },
        },
      },
    },

    'ncii-evidence': {
      kind: 'generic',
      accept: ACCEPT_IMAGE_VIDEO,
      maxBytes: NCII_EVIDENCE_RAW_BYTES,
      preserveOriginal: true,
      client: {
        allowPick: true,
        allowCapturePhoto: false,
        allowRecordVideo: false,
        allowRecordAudio: false,
      },
    },
  };
}

export const TTT_MEDIA_SPECS: Record<FileOrigin, MediaOriginSpec> = tttMediaSpecsFor(APP_MODE);
