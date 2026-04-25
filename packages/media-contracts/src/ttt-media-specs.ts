import type { FileOrigin } from "./file-origin.js";
import type { MediaProcessingSpec } from "./types.js";

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
    video: {
      maxDurationSec: 20,
      preset: 'veryfast',
      crf: 28,
      scaleMode: 'fit',
    },
    audio: {
      maxDurationSec: 30,
    },
    client: {
      allowPick: true,
      allowCapturePhoto: true,
      allowRecordVideo: true,
      allowRecordAudio: true,
      maxRecordDurationSec: DEFAULT_RECORD_DURATION_SEC,
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
    video: {
      maxDurationSec: DEFAULT_RECORD_DURATION_SEC,
      preset: 'veryfast',
      crf: 28,
      scaleMode: 'fit',
    },
    audio: {
      maxDurationSec: DEFAULT_RECORD_DURATION_SEC,
    },
    client: {
      allowPick: true,
      allowCapturePhoto: true,
      allowRecordVideo: true,
      allowRecordAudio: true,
      maxRecordDurationSec: DEFAULT_RECORD_DURATION_SEC,
    },
  },

  'opportunity-prompt': {
    kind: 'video',
    accept: ACCEPT_VIDEO_ONLY,
    maxBytes: 25 * 1024 * 1024,
    maxDurationSec: DEFAULT_RECORD_DURATION_SEC,
    requiredAspectRatio: 16 / 9,
    videoOrientation: 'horizontal' as const,
    allowAutoFormat: true,
    video: {
      preset: 'veryfast',
      crf: 28,
      scaleMode: 'fit',
    },
    client: {
      allowPick: true,
      allowCapturePhoto: false,
      allowRecordVideo: true,
      allowRecordAudio: false,
      maxRecordDurationSec: DEFAULT_RECORD_DURATION_SEC,
    },
  },

  'opportunity-reply': {
    kind: 'video',
    accept: ACCEPT_VIDEO_ONLY,
    maxBytes: 50 * 1024 * 1024,
    maxDurationSec: DEFAULT_RECORD_DURATION_SEC,
    requiredAspectRatio: 9 / 16,
    videoOrientation: 'vertical' as const,
    allowAutoFormat: true,
    video: {
      preset: 'veryfast',
      crf: 28,
      scaleMode: 'fit',
    },
    client: {
      allowPick: true,
      allowCapturePhoto: false,
      allowRecordVideo: true,
      allowRecordAudio: false,
      cameraFacingMode: 'user' as const,
      maxRecordDurationSec: DEFAULT_RECORD_DURATION_SEC,
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
    video: {
      maxDurationSec: DEFAULT_RECORD_DURATION_SEC,
      preset: 'veryfast',
      crf: 28,
      scaleMode: 'fit',
    },
    client: {
      allowPick: true,
      allowCapturePhoto: false,
      allowRecordVideo: false,
      allowRecordAudio: false,
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
    video: {
      maxDurationSec: DEFAULT_RECORD_DURATION_SEC,
      preset: 'veryfast',
      crf: 28,
      scaleMode: 'fit',
    },
    client: {
      allowPick: true,
      allowCapturePhoto: false,
      allowRecordVideo: false,
      allowRecordAudio: false,
    },
  },

  'chapter-photo': {
    kind: 'image',
    accept: ACCEPT_IMAGE_ONLY,
    maxBytes: 2 * 1024 * 1024,
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
  },

  'song-photo': {
    kind: 'image',
    accept: ACCEPT_IMAGE_ONLY,
    maxBytes: 2 * 1024 * 1024,
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
  },

  'show-photo': {
    kind: 'image',
    accept: ACCEPT_IMAGE_ONLY,
    maxBytes: 2 * 1024 * 1024,
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
  },

  'song-audio': {
    kind: 'audio',
    accept: ACCEPT_AUDIO_ONLY,
    maxBytes: 10 * 1024 * 1024,
    audio: {
      maxDurationSec: DEFAULT_RECORD_DURATION_SEC,
    },
    client: {
      allowPick: true,
      allowCapturePhoto: false,
      allowRecordVideo: false,
      allowRecordAudio: true,
      maxRecordDurationSec: DEFAULT_RECORD_DURATION_SEC,
    },
  },

  'show-video': {
    kind: 'video',
    accept: ACCEPT_VIDEO_ONLY,
    maxBytes: 50 * 1024 * 1024,
    video: {
      maxDurationSec: DEFAULT_RECORD_DURATION_SEC,
      preset: 'veryfast',
      crf: 28,
      scaleMode: 'fit',
    },
    client: {
      allowPick: true,
      allowCapturePhoto: false,
      allowRecordVideo: true,
      allowRecordAudio: false,
      maxRecordDurationSec: DEFAULT_RECORD_DURATION_SEC,
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
  },

} as const satisfies Record<FileOrigin, MediaProcessingSpec>;
