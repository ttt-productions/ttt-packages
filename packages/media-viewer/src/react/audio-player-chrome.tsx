'use client';

// Autoplay policies suspend a fresh AudioContext until a user-gesture play resumes it.
// `createMediaElementSource` is once per element, so the graph is keyed to the element instance.
// A cross-origin file fetched without CORS reaches the graph, and once routed the speakers, as silence.

import * as React from 'react';
import {
  Pause,
  Play,
  Volume2,
  VolumeX,
  ChevronDown,
  ChevronUp,
  Activity,
  BarChart3,
} from 'lucide-react';
import { Spinner } from '@ttt-productions/ui-core/react';
import { startWaveformLoop, drawIdleFrame } from '../visualizer.js';
import type { AudioVisualizerMode } from '../visualizer.js';
import { resolveInfiniteDuration, seekMedia } from '../media-duration.js';

const DEFAULT_PERSIST_KEY = 'mv-audio-player';

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
    // A blocked or full store throws on write; the preference then lasts this page only.
  }
}

function graphCanHear(el: HTMLAudioElement): boolean {
  if (el.crossOrigin) return true;
  const src = el.currentSrc || el.src;
  if (!src) return false;
  try {
    const u = new URL(src, window.location.href);
    return u.protocol === 'blob:' || u.protocol === 'data:' || u.origin === window.location.origin;
  } catch {
    return false;
  }
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const whole = Math.floor(seconds);
  const m = Math.floor(whole / 60);
  const s = whole % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export type AudioPlayerChromeProps = {
  audioRef: React.RefObject<HTMLAudioElement | null>;
  visualizerMode?: AudioVisualizerMode;
  persistKey?: string | null;
  extraActions?: React.ReactNode;
};

export function AudioPlayerChrome({
  audioRef,
  visualizerMode = 'bars',
  persistKey = DEFAULT_PERSIST_KEY,
  extraActions,
}: AudioPlayerChromeProps) {
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [buffering, setBuffering] = React.useState(false);
  const [currentTime, setCurrentTime] = React.useState(0);
  const [duration, setDuration] = React.useState(0);
  const [isMuted, setIsMuted] = React.useState(false);
  const [volume, setVolume] = React.useState(1);
  const [minimized, setMinimized] = React.useState<boolean>(
    () => readPref(persistKey, 'minimized') === '1',
  );
  const [mode, setMode] = React.useState<AudioVisualizerMode>(() => {
    const stored = readPref(persistKey, 'mode');
    return stored === 'line' || stored === 'bars' ? stored : visualizerMode;
  });

  const [scrubTime, setScrubTime] = React.useState<number | null>(null);

  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const modeRef = React.useRef(mode);
  modeRef.current = mode;

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
    if (ctx && ctx.state !== 'closed') {
      // Closing a context the browser is already closing rejects; the context is released either way.
      ctx.close().catch(() => {});
    }
  }, [stopLoop]);

  const ensureGraph = React.useCallback(
    (el: HTMLAudioElement) => {
      try {
        if (sourceElRef.current === el && audioCtxRef.current) {
          if (audioCtxRef.current.state === 'suspended') {
            // resume() rejects once the context is closed; the visualizer then stays idle and playback is unaffected.
            audioCtxRef.current.resume().catch(() => {});
          }
          return;
        }
        if (!graphCanHear(el)) return;
        teardownGraph();
        const AudioCtx: typeof AudioContext =
          (window as unknown as { AudioContext?: typeof AudioContext }).AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext!;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const source = ctx.createMediaElementSource(el);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        // Once routed through the graph, the element is silent unless the graph reaches the destination.
        source.connect(analyser);
        analyser.connect(ctx.destination);
        audioCtxRef.current = ctx;
        sourceElRef.current = el;
        analyserRef.current = analyser;
        if (ctx.state === 'suspended') {
          // resume() rejects once the context is closed; the visualizer then stays idle and playback is unaffected.
          ctx.resume().catch(() => {});
        }
      } catch {
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

  // The element mounts in the same commit as this chrome, so the ref is set by the time this effect runs.
  React.useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    let durationReconcileAttempted = false;
    const reconcileInfiniteDuration = () => {
      if (durationReconcileAttempted || Number.isFinite(el.duration) || !el.paused) return;
      durationReconcileAttempted = true;
      void resolveInfiniteDuration(el).then((real) => {
        if (real !== null) setDuration(real);
      });
    };

    const syncFromElement = () => {
      setIsPlaying(!el.paused && !el.ended);
      setIsMuted(el.muted);
      setVolume(el.volume);
      if (Number.isFinite(el.duration)) setDuration(el.duration);
      setCurrentTime(el.currentTime);
    };
    syncFromElement();
    if (el.readyState >= 1) reconcileInfiniteDuration();

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
      else reconcileInfiniteDuration();
    };
    const onVolumeChange = () => {
      setIsMuted(el.muted);
      setVolume(el.volume);
    };
    const onWaiting = () => setBuffering(true);
    const onReady = () => setBuffering(false);

    el.addEventListener('play', onPlay);
    el.addEventListener('pause', onPause);
    el.addEventListener('ended', onEnded);
    el.addEventListener('timeupdate', onTimeUpdate);
    el.addEventListener('durationchange', onDurationChange);
    el.addEventListener('loadedmetadata', onDurationChange);
    el.addEventListener('volumechange', onVolumeChange);
    el.addEventListener('waiting', onWaiting);
    el.addEventListener('seeking', onWaiting);
    el.addEventListener('playing', onReady);
    el.addEventListener('seeked', onReady);
    el.addEventListener('canplay', onReady);
    el.addEventListener('pause', onReady);
    el.addEventListener('ended', onReady);
    el.addEventListener('error', onReady);
    return () => {
      el.removeEventListener('play', onPlay);
      el.removeEventListener('pause', onPause);
      el.removeEventListener('ended', onEnded);
      el.removeEventListener('timeupdate', onTimeUpdate);
      el.removeEventListener('durationchange', onDurationChange);
      el.removeEventListener('loadedmetadata', onDurationChange);
      el.removeEventListener('volumechange', onVolumeChange);
      el.removeEventListener('waiting', onWaiting);
      el.removeEventListener('seeking', onWaiting);
      el.removeEventListener('playing', onReady);
      el.removeEventListener('seeked', onReady);
      el.removeEventListener('canplay', onReady);
      el.removeEventListener('pause', onReady);
      el.removeEventListener('ended', onReady);
      el.removeEventListener('error', onReady);
    };
  }, [audioRef, ensureGraph, startLoop, stopLoop]);

  React.useEffect(() => teardownGraph, [teardownGraph]);

  React.useEffect(() => {
    if (minimized || isPlaying) return;
    const canvas = canvasRef.current;
    if (canvas) drawIdleFrame(canvas, mode);
  }, [minimized, isPlaying, mode]);

  const togglePlay = () => {
    const el = audioRef.current;
    if (!el) return;
    // play() rejects when a pause interrupts it or the browser blocks playback; the media then stays paused.
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
      seekMedia(el, scrubTime);
    }
    setScrubTime(null);
  };

  const toggleMinimized = () => {
    setMinimized((m) => {
      writePref(persistKey, 'minimized', m ? '0' : '1');
      return !m;
    });
  };

  const toggleMode = () => {
    setMode((prev) => {
      const next: AudioVisualizerMode = prev === 'line' ? 'bars' : 'line';
      writePref(persistKey, 'mode', next);
      return next;
    });
  };

  const shownTime = scrubTime ?? currentTime;

  return (
    <div
      className="mv-player"
      data-mv-player
      data-minimized={minimized ? 'true' : 'false'}
      data-mode={mode}
    >
      {!minimized && (
        <div className="mv-player-viz">
          <canvas
            ref={canvasRef}
            width={600}
            height={96}
            className="mv-player-canvas"
            aria-hidden="true"
          />
          <button
            type="button"
            className="mv-player-btn mv-player-mode-btn"
            onClick={toggleMode}
            aria-label={
              mode === 'line' ? 'Switch visualizer to bars' : 'Switch visualizer to waveform line'
            }
          >
            {mode === 'line' ? <BarChart3 aria-hidden="true" /> : <Activity aria-hidden="true" />}
          </button>
        </div>
      )}
      <div className="mv-player-controls">
        <button
          type="button"
          className="mv-player-btn mv-player-play-btn"
          onClick={togglePlay}
          aria-label={isPlaying ? 'Pause' : 'Play'}
          aria-busy={isPlaying && buffering ? true : undefined}
        >
          {isPlaying && buffering ? (
            <Spinner size="xs" />
          ) : isPlaying ? (
            <Pause aria-hidden="true" />
          ) : (
            <Play aria-hidden="true" />
          )}
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
          aria-label={isMuted ? 'Unmute' : 'Mute'}
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
          aria-label={minimized ? 'Show visualizer' : 'Hide visualizer'}
        >
          {minimized ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
        </button>
        {extraActions != null && <div className="mv-player-extra">{extraActions}</div>}
      </div>
    </div>
  );
}
