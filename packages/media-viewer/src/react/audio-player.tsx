"use client";

// Named entry point for the owned audio player: AudioViewer wearing the
// custom `chrome="player"` control surface (see audio-player-chrome.tsx).
// Prefer this at call sites that always want the player — it reads as intent.

import { AudioViewer } from "./audio-viewer.js";
import type { AudioViewerProps } from "../types.js";

export type AudioPlayerProps = Omit<AudioViewerProps, "chrome" | "controls">;

export function AudioPlayer(props: AudioPlayerProps) {
  return <AudioViewer {...props} chrome="player" />;
}
