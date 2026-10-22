'use client';

import { AudioViewer } from './audio-viewer.js';
import type { AudioViewerProps } from './types.js';

export type AudioPlayerProps = AudioViewerProps;

export function AudioPlayer(props: AudioPlayerProps) {
  return <AudioViewer {...props} />;
}
