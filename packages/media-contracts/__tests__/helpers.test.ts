import { describe, it, expect } from 'vitest';
import {
  getSimplifiedMediaType,
  isImageType,
  isVideoType,
  isAudioType,
  isSupportedMime,
} from '../src/helpers';

describe('getSimplifiedMediaType', () => {
  describe('with mime strings', () => {
    it('returns "image" for image/* mimes', () => {
      expect(getSimplifiedMediaType('image/png')).toBe('image');
      expect(getSimplifiedMediaType('image/jpeg')).toBe('image');
      expect(getSimplifiedMediaType('image/webp')).toBe('image');
      expect(getSimplifiedMediaType('image/gif')).toBe('image');
    });

    it('returns "video" for video/* mimes', () => {
      expect(getSimplifiedMediaType('video/mp4')).toBe('video');
      expect(getSimplifiedMediaType('video/webm')).toBe('video');
      expect(getSimplifiedMediaType('video/quicktime')).toBe('video');
    });

    it('returns "audio" for audio/* mimes', () => {
      expect(getSimplifiedMediaType('audio/mp3')).toBe('audio');
      expect(getSimplifiedMediaType('audio/mpeg')).toBe('audio');
      expect(getSimplifiedMediaType('audio/wav')).toBe('audio');
    });

    it('returns "other" for application/pdf', () => {
      expect(getSimplifiedMediaType('application/pdf')).toBe('other');
    });

    it('returns "other" for application/octet-stream', () => {
      expect(getSimplifiedMediaType('application/octet-stream')).toBe('other');
    });

    it('is case-insensitive', () => {
      expect(getSimplifiedMediaType('IMAGE/PNG')).toBe('image');
      expect(getSimplifiedMediaType('Video/MP4')).toBe('video');
    });
  });

  describe('with filenames', () => {
    it('returns "image" for image file extensions', () => {
      expect(getSimplifiedMediaType('photo.jpg')).toBe('image');
      expect(getSimplifiedMediaType('photo.jpeg')).toBe('image');
      expect(getSimplifiedMediaType('image.png')).toBe('image');
      expect(getSimplifiedMediaType('anim.gif')).toBe('image');
      expect(getSimplifiedMediaType('pic.webp')).toBe('image');
    });

    it('returns "video" for video file extensions', () => {
      expect(getSimplifiedMediaType('clip.mp4')).toBe('video');
      expect(getSimplifiedMediaType('movie.mov')).toBe('video');
      expect(getSimplifiedMediaType('vid.webm')).toBe('video');
    });

    it('returns "audio" for audio file extensions', () => {
      expect(getSimplifiedMediaType('song.mp3')).toBe('audio');
      expect(getSimplifiedMediaType('track.wav')).toBe('audio');
      expect(getSimplifiedMediaType('audio.m4a')).toBe('audio');
    });

    it('returns "other" for unknown extensions', () => {
      expect(getSimplifiedMediaType('file.pdf')).toBe('other');
      expect(getSimplifiedMediaType('doc.docx')).toBe('other');
    });
  });

  describe('with FileLike objects', () => {
    it('returns "image" for image mime type', () => {
      expect(getSimplifiedMediaType({ type: 'image/jpeg' })).toBe('image');
    });

    it('returns "video" for video mime type', () => {
      expect(getSimplifiedMediaType({ type: 'video/mp4' })).toBe('video');
    });

    it('returns "audio" for audio mime type', () => {
      expect(getSimplifiedMediaType({ type: 'audio/mpeg' })).toBe('audio');
    });

    it('falls back to name when type is empty', () => {
      expect(getSimplifiedMediaType({ type: '', name: 'photo.jpg' })).toBe('image');
    });

    it('uses name when type is absent', () => {
      expect(getSimplifiedMediaType({ name: 'song.mp3' })).toBe('audio');
    });

    it('returns "other" when both type and name are absent', () => {
      expect(getSimplifiedMediaType({})).toBe('other');
    });
  });

  describe('edge cases', () => {
    it('returns "other" for null', () => {
      expect(getSimplifiedMediaType(null)).toBe('other');
    });

    it('returns "other" for undefined', () => {
      expect(getSimplifiedMediaType(undefined)).toBe('other');
    });

    it('returns "other" for empty string', () => {
      expect(getSimplifiedMediaType('')).toBe('other');
    });
  });
});

describe('isImageType', () => {
  it('returns true for image mime', () => {
    expect(isImageType('image/png')).toBe(true);
  });

  it('returns true for image filename', () => {
    expect(isImageType('photo.jpg')).toBe(true);
  });

  it('returns false for video', () => {
    expect(isImageType('video/mp4')).toBe(false);
  });

  it('returns false for null', () => {
    expect(isImageType(null)).toBe(false);
  });
});

describe('isVideoType', () => {
  it('returns true for video mime', () => {
    expect(isVideoType('video/mp4')).toBe(true);
  });

  it('returns true for video filename', () => {
    expect(isVideoType('clip.mov')).toBe(true);
  });

  it('returns false for image', () => {
    expect(isVideoType('image/png')).toBe(false);
  });

  it('returns false for null', () => {
    expect(isVideoType(null)).toBe(false);
  });
});

describe('isAudioType', () => {
  it('returns true for audio mime', () => {
    expect(isAudioType('audio/mpeg')).toBe(true);
  });

  it('returns true for audio filename', () => {
    expect(isAudioType('track.mp3')).toBe(true);
  });

  it('returns false for video', () => {
    expect(isAudioType('video/mp4')).toBe(false);
  });

  it('returns false for null', () => {
    expect(isAudioType(null)).toBe(false);
  });
});

describe('isSupportedMime', () => {
  it('returns true for image mimes', () => {
    expect(isSupportedMime('image/jpeg')).toBe(true);
    expect(isSupportedMime('image/png')).toBe(true);
  });

  it('returns true for video mimes', () => {
    expect(isSupportedMime('video/mp4')).toBe(true);
  });

  it('returns true for audio mimes', () => {
    expect(isSupportedMime('audio/mpeg')).toBe(true);
  });

  it('returns false for application/pdf', () => {
    expect(isSupportedMime('application/pdf')).toBe(false);
  });

  it('returns false for application/octet-stream', () => {
    expect(isSupportedMime('application/octet-stream')).toBe(false);
  });
});
