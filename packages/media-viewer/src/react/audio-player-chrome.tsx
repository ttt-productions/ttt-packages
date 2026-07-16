"use client";

// Custom audio player chrome — the one owned control surface used by every
// AudioViewer. Owns: play/pause, seek, time readout, mute/volume, and
// the visualizer panel (shared engine in ../visualizer.ts) with minimize and
// line/bars mode toggles. The media ELEMENT (loading, errors, playback API)
// stays owned by AudioViewer — this component only reads/drives it.
//
// Web Audio wiring is created lazily on the first `play` event (autoplay
// policies suspend fresh AudioContexts; a user-gesture play resumes them) and
// is best-effort throughout: if anything throws, the player still plays and
// only the visualizer goes dark. `createMediaElementSource` is once-per-
// element, so the graph is keyed to the element instance and rebuilt only if
// the element itself changes.

import * as React from "react";
import { Pause, Play, Volume2, VolumeX, ChevronDown, ChevronUp, Activity, BarChart3 } from "lucide-react";
import { startWaveformLoop, drawIdleFrame } from "../visualizer.js";
import type { AudioVisualizerMode } from "../visualizer.js";

const DEFAULT_PERSIST_KEY = "mv-audio-player";

function readPref(persistKey: string | null, suffix: string): string | null {
  if (!persistKey) return null;
  try {
    return window.localStorage.getItem(`${persistKey}:${suffix}`);
  } catch {
    return null;
  }
}

function writePref(persistKey: string | null, suffix: string, value: string): void {
  if (!persistKey) return;
  try {
    window.localStorage.setItem(`${persistKey}:${suffix}`, value);
  } catch {
    /* storage unavailable (private mode, SSR) — session-only prefs */
  }
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const whole = Math.floor(seconds);
  const m = Math.floor(whole / 60);
  const s = whole % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export type AudioPlayerChromeProps = {
  audioRef: React.RefObject<HTMLAudioElement | null>;
  /** Initial visualizer mode; a persisted user choice wins over this. */
  visualizerMode?: AudioVisualizerMode;
  /** localStorage key base for minimize/mode prefs; `null` disables persistence. */
  persistKey?: string | null;
  /** App-injected action buttons, rendered at the end of the control row. */
  extraActions?: React.ReactNode;
};

export function AudioPlayerChrome({
  audioRef,
  visualizerMode = "bars",
  persistKey = DEFAULT_PERSIST_KEY,
  extraActions,
}: AudioPlayerChromeProps) {
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [currentTime, setCurrentTime] = React.useState(0);
  const [duration, setDuration] = React.useState(0);
  const [isMuted, setIsMuted] = React.useState(false);
  const [volume, setVolume] = React.useState(1);
  const [minimized, setMinimized] = React.useState<boolean>(() => readPref(persistKey, "minimized") === "1");
  const [mode, setMode] = React.useState<AudioVisualizerMode>(() => {
    const stored = readPref(persistKey, "mode");
    return stored === "line" || stored === "bars" ? stored : visualizerMode;
  });

  // While the user drags the seek slider, timeupdate must not fight the thumb.
  const [scrubTime, setScrubTime] = React.useState<number | null>(null);

  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const modeRef = React.useRef(mode);
  modeRef.current = mode;

  // Web Audio graph (lazy, keyed to the element instance).
  const audioCtxRef = React.useRef<AudioContext | null>(null);
  const sourceElRef = React.useRef<HTMLAudioElement | null>(null);
  const analyserRef = React.useRef<AnalyserNode | null>(null);
  const stopLoopRef = React.useRef<(() => void) | null>(null);

  const stopLoop = React.useCallback(() => {
    stopLoopRef.current?.();
    stopLoopRef.current = null;
  }, []);

  const teardownGraph = React.useCallback(() => {
    stopLoop();
    analyserRef.current = null;
    sourceElRef.current = null;
    const ctx = audioCtxRef.current;
    audioCtxRef.current = null;
    if (ctx && ctx.state !== "closed") {
      ctx.close().catch(() => {});
    }
  }, [stopLoop]);

  const ensureGraph = React.useCallback(
    (el: HTMLAudioElement) => {
      try {
        if (sourceElRef.current === el && audioCtxRef.current) {
          if (audioCtxRef.current.state === "suspended") {
            audioCtxRef.current.resume().catch(() => {});
          }
          return;
        }
        teardownGraph();
        const AudioCtx: typeof AudioContext =
          (window as unknown as { AudioContext?: typeof AudioContext }).AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext!;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const source = ctx.createMediaElementSource(el);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        // Element audio now routes through the graph — destination connection
        // is REQUIRED or playback goes silent.
        source.connect(analyser);
        analyser.connect(ctx.destination);
        audioCtxRef.current = ctx;
        sourceElRef.current = el;
        analyserRef.current = analyser;
        if (ctx.state === "suspended") {
          ctx.resume().catch(() => {});
        }
      } catch {
        // Best-effort: playback works without the visualizer.
        analyserRef.current = null;
      }
    },
    [teardownGraph],
  );

  const startLoop = React.useCallback(() => {
    if (stopLoopRef.current) return;
    const analyser = analyserRef.current;
    if (!analyser) return;
    stopLoopRef.current = startWaveformLoop({
      analyser,
      getCanvas: () => canvasRef.current,
      mode: () => modeRef.current,
    });
  }, []);

  // Element event subscriptions. The element mounts in the same commit as this
  // chrome (AudioViewer renders both once loading starts), so the ref is set
  // by the time this effect runs.
  React.useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    const syncFromElement = () => {
      setIsPlaying(!el.paused && !el.ended);
      setIsMuted(el.muted);
      setVolume(el.volume);
      if (Number.isFinite(el.duration)) setDuration(el.duration);
      setCurrentTime(el.currentTime);
    };
    syncFromElement();

    const onPlay = () => {
      setIsPlaying(true);
      ensureGraph(el);
      startLoop();
    };
    const onPause = () => {
      setIsPlaying(false);
      stopLoop();
    };
    const onEnded = () => {
      setIsPlaying(false);
      stopLoop();
    };
    const onTimeUpdate = () => setCurrentTime(el.currentTime);
    const onDurationChange = () => {
      if (Number.isFinite(el.duration)) setDuration(el.duration);
    };
    const onVolumeChange = () => {
      setIsMuted(el.muted);
      setVolume(el.volume);
    };

    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("ended", onEnded);
    el.addEventListener("timeupdate", onTimeUpdate);
    el.addEventListener("durationchange", onDurationChange);
    el.addEventListener("loadedmetadata", onDurationChange);
    el.addEventListener("volumechange", onVolumeChange);
    return () => {
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("ended", onEnded);
      el.removeEventListener("timeupdate", onTimeUpdate);
      el.removeEventListener("durationchange", onDurationChange);
      el.removeEventListener("loadedmetadata", onDurationChange);
      el.removeEventListener("volumechange", onVolumeChange);
    };
  }, [audioRef, ensureGraph, startLoop, stopLoop]);

  // Full teardown when the chrome unmounts.
  React.useEffect(() => teardownGraph, [teardownGraph]);

  // Idle frame whenever the visualizer is visible but not animating.
  React.useEffect(() => {
    if (minimized || isPlaying) return;
    const canvas = canvasRef.current;
    if (canvas) drawIdleFrame(canvas, mode);
  }, [minimized, isPlaying, mode]);

  const togglePlay = () => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) void el.play().catch(() => {});
    else el.pause();
  };

  const toggleMute = () => {
    const el = audioRef.current;
    if (!el) return;
    el.muted = !el.muted;
  };

  const onVolumeInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const el = audioRef.current;
    if (!el) return;
    const v = Number(e.target.value);
    el.volume = v;
    if (v > 0 && el.muted) el.muted = false;
  };

  const onSeekInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setScrubTime(Number(e.target.value));
  };

  const commitSeek = () => {
    const el = audioRef.current;
    if (el && scrubTime !== null) {
      try {
        el.currentTime = scrubTime;
      } catch {
        /* not seekable yet */
      }
    }
    setScrubTime(null);
  };

  const toggleMinimized = () => {
    setMinimized((m) => {
      writePref(persistKey, "minimized", m ? "0" : "1");
      return !m;
    });
  };

  const toggleMode = () => {
    setMode((prev) => {
      const next: AudioVisualizerMode = prev === "line" ? "bars" : "line";
      writePref(persistKey, "mode", next);
      return next;
    });
  };

  const shownTime = scrubTime ?? currentTime;

  return (
    <div className="mv-player" data-mv-player data-minimized={minimized ? "true" : "false"} data-mode={mode}>
      {!minimized && (
        <div className="mv-player-viz">
          <canvas ref={canvasRef} width={600} height={96} className="mv-player-canvas" aria-hidden="true" />
          <button
            type="button"
            className="mv-player-btn mv-player-mode-btn"
            onClick={toggleMode}
            aria-label={mode === "line" ? "Switch visualizer to bars" : "Switch visualizer to waveform line"}
          >
            {mode === "line" ? <BarChart3 aria-hidden="true" /> : <Activity aria-hidden="true" />}
          </button>
        </div>
      )}
      <div className="mv-player-controls">
        <button
          type="button"
          className="mv-player-btn mv-player-play-btn"
          onClick={togglePlay}
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
        </button>
        <span className="mv-player-time" aria-hidden="true">
          {formatTime(shownTime)}
        </span>
        <input
          type="range"
          className="mv-player-seek"
          min={0}
          max={duration > 0 ? duration : 0}
          step={0.1}
          value={Math.min(shownTime, duration > 0 ? duration : shownTime)}
          onChange={onSeekInput}
          onMouseUp={commitSeek}
          onTouchEnd={commitSeek}
          onKeyUp={commitSeek}
          disabled={duration <= 0}
          aria-label="Seek"
        />
        <span className="mv-player-time" aria-hidden="true">
          {formatTime(duration)}
        </span>
        <button
          type="button"
          className="mv-player-btn"
          onClick={toggleMute}
          aria-label={isMuted ? "Unmute" : "Mute"}
        >
          {isMuted ? <VolumeX aria-hidden="true" /> : <Volume2 aria-hidden="true" />}
        </button>
        <input
          type="range"
          className="mv-player-volume"
          min={0}
          max={1}
          step={0.05}
          value={isMuted ? 0 : volume}
          onChange={onVolumeInput}
          aria-label="Volume"
        />
        <button
          type="button"
          className="mv-player-btn"
          onClick={toggleMinimized}
          aria-label={minimized ? "Show visualizer" : "Hide visualizer"}
        >
          {minimized ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
        </button>
        {extraActions != null && <div className="mv-player-extra">{extraActions}</div>}
      </div>
    </div>
  );
}
