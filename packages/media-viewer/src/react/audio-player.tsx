"use client";

// Semantic named entry point for the canonical AudioViewer. Both exports use
// the same package-owned control surface; native browser chrome is unavailable.

import { AudioViewer } from "./audio-viewer.js";
import type { AudioViewerProps } from "../types.js";

export type AudioPlayerProps = AudioViewerProps;

export function AudioPlayer(props: AudioPlayerProps) {
  return <AudioViewer {...props} />;
}
