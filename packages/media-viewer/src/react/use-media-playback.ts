"use client";

import * as React from "react";
import type { MediaPlaybackControls, MediaPlaybackProps } from "../types.js";

/**
 * Throttle interval for periodic progress samples. A sample fires at most once
 * per this many milliseconds of active (non-paused) playback via `timeupdate`.
 */
export const PROGRESS_SAMPLE_INTERVAL_MS = 5000;

export type UseMediaPlaybackResult = {
  /** Whether the media has ended (drives the end overlay). */
  hasEnded: boolean;
  /** Handlers to spread onto the underlying <video>/<audio> element. */
  handlers: {
    onLoadedMetadata: (e: React.SyntheticEvent<HTMLMediaElement>) => void;
    onTimeUpdate: (e: React.SyntheticEvent<HTMLMediaElement>) => void;
    onPlay: (e: React.SyntheticEvent<HTMLMediaElement>) => void;
    onPause: (e: React.SyntheticEvent<HTMLMediaElement>) => void;
    onSeeked: (e: React.SyntheticEvent<HTMLMediaElement>) => void;
    onEnded: (e: React.SyntheticEvent<HTMLMediaElement>) => void;
  };
};

/**
 * Shared playback API for VideoViewer and AudioViewer. Owns the additive
 * playback surface (onEnded, onProgressSample, startAtSeconds, endOverlay,
 * imperative controls) so both viewers behave identically. Adds NO observer —
 * everything is derived from native media element events (MEDIA-102).
 *
 * The element ref is supplied by the viewer (which already owns it for
 * autoplay/fullscreen). When the viewer unloads the element off-screen
 * (`unloadOnExit`) and remounts it on return, the last known playback position
 * is tracked in a component-scoped ref that outlives the element, so playback
 * resumes from where it left off — never from `startAtSeconds` again and never
 * from 0.
 */
export function useMediaPlayback(
  elementRef: React.RefObject<HTMLMediaElement | null>,
  props: MediaPlaybackProps,
  playbackControlsRef?: React.Ref<MediaPlaybackControls>,
  /**
   * Stable identity for the CURRENT media source (the viewer passes its `url`).
   * When this changes the media is a different asset, so all resume/progress/
   * ended tracking is reset — a stale position from the previous media must NOT
   * carry over onto the new element. Omit when the viewer never reuses one
   * instance across sources.
   */
  mediaKey?: string,
): UseMediaPlaybackResult {
  const { onEnded, onProgressSample, startAtSeconds, endOverlay } = props;

  const [hasEnded, setHasEnded] = React.useState(false);

  // Latest callbacks/props via refs so handler identities stay stable and the
  // element event handlers always see current values.
  const onEndedRef = React.useRef(onEnded);
  const onProgressSampleRef = React.useRef(onProgressSample);
  onEndedRef.current = onEnded;
  onProgressSampleRef.current = onProgressSample;

  const seedPosition = () =>
    typeof startAtSeconds === "number" && startAtSeconds > 0 ? startAtSeconds : null;

  // Last known playback position. Seeded from startAtSeconds, then updated once
  // playback has actually started. Survives the unloadOnExit unload/remount
  // cycle because it lives on the (still-mounted) component instance.
  const lastPositionRef = React.useRef<number | null>(seedPosition());
  // True once we have observed real playback progress — after this we resume
  // from lastPositionRef, never re-apply the original startAtSeconds prop.
  const hasStartedRef = React.useRef(false);

  // Throttle bookkeeping for periodic samples (wall-clock, active playback only).
  const lastSampleAtRef = React.useRef(0);

  // Render-phase reset-on-source-change: when the media source (`mediaKey`)
  // changes, the same component/hook instance is being reused for a DIFFERENT
  // asset (e.g. a playlist swapping `url` in place). Reset every piece of
  // per-source tracking so the previous media's position/ended/throttle state
  // cannot bleed onto the new element. This is the sanctioned render-phase
  // reset-on-prop-change pattern (not a set-state-in-effect).
  const prevMediaKeyRef = React.useRef<string | undefined>(mediaKey);
  if (prevMediaKeyRef.current !== mediaKey) {
    prevMediaKeyRef.current = mediaKey;
    lastPositionRef.current = seedPosition();
    hasStartedRef.current = false;
    lastSampleAtRef.current = 0;
    if (hasEnded) setHasEnded(false);
  }

  const emitSample = React.useCallback((el: HTMLMediaElement) => {
    const cb = onProgressSampleRef.current;
    if (!cb) return;
    const duration = Number.isFinite(el.duration) ? el.duration : 0;
    cb(el.currentTime, duration);
  }, []);

  const trackPosition = React.useCallback((el: HTMLMediaElement) => {
    if (hasStartedRef.current) {
      lastPositionRef.current = el.currentTime;
    }
  }, []);

  const applyInitialSeek = React.useCallback((el: HTMLMediaElement) => {
    const target = lastPositionRef.current;
    if (typeof target !== "number" || target <= 0) return;
    // Only seek a freshly-loaded element sitting at the start. This makes the
    // handler idempotent (a metadata event on an already-positioned element is
    // a no-op) and, crucially, re-applies the LAST KNOWN position to the new
    // element created by an unloadOnExit remount — resuming, never restarting.
    if (el.currentTime > 0.01) return;
    const dur = el.duration;
    const clamped = Number.isFinite(dur) && dur > 0 ? Math.min(target, dur) : target;
    try {
      el.currentTime = clamped;
    } catch {
      /* setting currentTime before ready can throw in some engines; ignore */
    }
  }, []);

  const onLoadedMetadata = React.useCallback(
    (e: React.SyntheticEvent<HTMLMediaElement>) => {
      applyInitialSeek(e.currentTarget);
    },
    [applyInitialSeek],
  );

  const onTimeUpdate = React.useCallback(
    (e: React.SyntheticEvent<HTMLMediaElement>) => {
      const el = e.currentTarget;
      // Any observed timeupdate while playing means playback has started; from
      // now on we track live position for remount resume.
      if (!el.paused && !el.ended) {
        hasStartedRef.current = true;
      }
      trackPosition(el);
      if (el.paused) return; // no periodic samples while paused
      const now = Date.now();
      if (now - lastSampleAtRef.current >= PROGRESS_SAMPLE_INTERVAL_MS) {
        lastSampleAtRef.current = now;
        emitSample(el);
      }
    },
    [emitSample, trackPosition],
  );

  const onPlay = React.useCallback(() => {
    // Playing again after an ended state (native replay) clears the overlay.
    setHasEnded(false);
  }, []);

  const onPause = React.useCallback(
    (e: React.SyntheticEvent<HTMLMediaElement>) => {
      const el = e.currentTarget;
      trackPosition(el);
      // Flush a sample immediately on pause (final position for this segment).
      lastSampleAtRef.current = Date.now();
      emitSample(el);
    },
    [emitSample, trackPosition],
  );

  const onSeeked = React.useCallback(
    (e: React.SyntheticEvent<HTMLMediaElement>) => {
      const el = e.currentTarget;
      trackPosition(el);
      // Flush a sample on seek completion so the app sees the new position.
      lastSampleAtRef.current = Date.now();
      emitSample(el);
    },
    [emitSample, trackPosition],
  );

  const onEndedHandler = React.useCallback(
    (e: React.SyntheticEvent<HTMLMediaElement>) => {
      const el = e.currentTarget;
      // Ended means the play cursor reached duration; record final position.
      hasStartedRef.current = true;
      lastPositionRef.current = el.currentTime;
      // Flush a final sample with the ended position.
      lastSampleAtRef.current = Date.now();
      emitSample(el);
      setHasEnded(true);
      onEndedRef.current?.();
    },
    [emitSample],
  );

  // Imperative controls. restart() seeks to 0 and plays; seekTo(s) seeks.
  React.useImperativeHandle(
    playbackControlsRef,
    (): MediaPlaybackControls => ({
      restart() {
        const el = elementRef.current;
        if (!el) return;
        try {
          el.currentTime = 0;
        } catch {
          /* ignore */
        }
        lastPositionRef.current = 0;
        setHasEnded(false);
        void el.play().catch(() => {});
      },
      seekTo(seconds: number) {
        const el = elementRef.current;
        if (!el) return;
        const dur = el.duration;
        const clamped =
          Number.isFinite(dur) && dur > 0 ? Math.min(Math.max(seconds, 0), dur) : Math.max(seconds, 0);
        try {
          el.currentTime = clamped;
        } catch {
          /* ignore */
        }
        hasStartedRef.current = true;
        lastPositionRef.current = clamped;
      },
    }),
    [elementRef],
  );

  // Ended state is cleared by onPlay (native replay / imperative restart).
  // endOverlay itself is rendered by the viewer using `hasEnded`.
  void endOverlay;

  return {
    hasEnded,
    handlers: {
      onLoadedMetadata,
      onTimeUpdate,
      onPlay,
      onPause,
      onSeeked,
      onEnded: onEndedHandler,
    },
  };
}
