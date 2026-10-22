export type MediaViewerType = 'image' | 'video' | 'audio' | 'other';
export type FallbackMode = 'none' | 'link';

export type MediaPlaybackControls = {
  restart(): void;
  seekTo(seconds: number): void;
};

export type MediaProgressSampleReason = 'periodic' | 'pause' | 'seeked' | 'ended';
