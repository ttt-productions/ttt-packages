'use client';

import * as React from 'react';
import type { MediaPlaybackControls, MediaProgressSampleReason } from '../types.js';
import type { MediaPlaybackProps } from './types.js';
import { seekMedia } from '../media-duration.js';

export const PROGRESS_SAMPLE_INTERVAL_MS = 5000;

/** Autoplay can start before an async resume position resolves (Firefox reliably loses that race), so a value arriving this close to the start is still adopted. */
export const LATE_RESUME_ADOPT_WINDOW_SEC = 3;

export type UseMediaPlaybackResult = {
  hasEnded: boolean;
  handlers: {
    onLoadedMetadata: (e: React.SyntheticEvent<HTMLMediaElement>) => void;
    onTimeUpdate: (e: React.SyntheticEvent<HTMLMediaElement>) => void;
    onPlay: (e: React.SyntheticEvent<HTMLMediaElement>) => void;
    onPause: (e: React.SyntheticEvent<HTMLMediaElement>) => void;
    onSeeked: (e: React.SyntheticEvent<HTMLMediaElement>) => void;
    onEnded: (e: React.SyntheticEvent<HTMLMediaElement>) => void;
  };
  attachElement: (element: HTMLMediaElement | null) => void;
  retireElement: () => void;
};

export function useMediaPlayback(
  elementRef: React.RefObject<HTMLMediaElement | null>,
  props: MediaPlaybackProps,
  playbackControlsRef?: React.Ref<MediaPlaybackControls>,
  mediaKey?: string,
): UseMediaPlaybackResult {
  const { onEnded, onProgressSample, startAtSeconds, endOverlay } = props;

  const [hasEnded, setHasEnded] = React.useState(false);

  const onEndedRef = React.useRef(onEnded);
  const onProgressSampleRef = React.useRef(onProgressSample);
  onEndedRef.current = onEnded;
  onProgressSampleRef.current = onProgressSample;

  const seedFromProps =
    typeof startAtSeconds === 'number' && startAtSeconds > 0 ? startAtSeconds : null;

  const lastPositionRef = React.useRef<number | null>(seedFromProps);
  const hasStartedRef = React.useRef(false);
  const seededRef = React.useRef(seedFromProps !== null);

  const lastSampleAtRef = React.useRef(0);

  const attachedElRef = React.useRef<HTMLMediaElement | null>(null);
  const activeRef = React.useRef(false);
  const managedRef = React.useRef(false);
  const lastCommittedRef = React.useRef<number | null>(null);
  // After a source swap on a retained element, events from the outgoing source's teardown can still arrive.
  const sourceSettledRef = React.useRef(true);

  const prevMediaKeyRef = React.useRef<string | undefined>(mediaKey);
  if (prevMediaKeyRef.current !== mediaKey) {
    prevMediaKeyRef.current = mediaKey;
    lastPositionRef.current = seedFromProps;
    hasStartedRef.current = false;
    seededRef.current = seedFromProps !== null;
    lastSampleAtRef.current = 0;
    lastCommittedRef.current = null;
    sourceSettledRef.current = false;
    if (hasEnded) setHasEnded(false);
  }

  const emitSample = React.useCallback(
    (el: HTMLMediaElement, reason: MediaProgressSampleReason) => {
      if (reason !== 'periodic') {
        lastCommittedRef.current = el.currentTime;
      }
      const cb = onProgressSampleRef.current;
      if (!cb) return;
      const duration = Number.isFinite(el.duration) ? el.duration : 0;
      cb(el.currentTime, duration, reason);
    },
    [],
  );

  const isFromActiveElement = React.useCallback((el: HTMLMediaElement) => {
    if (!managedRef.current) return true;
    return activeRef.current && attachedElRef.current === el;
  }, []);

  const doRetire = React.useCallback(() => {
    const el = attachedElRef.current;
    if (el && activeRef.current) {
      if (hasStartedRef.current) {
        const position = el.currentTime;
        const preSeed = !seededRef.current && position <= LATE_RESUME_ADOPT_WINDOW_SEC;
        if (!preSeed && lastCommittedRef.current !== position) {
          lastPositionRef.current = position;
          emitSample(el, 'pause');
        }
      }
    }
    activeRef.current = false;
  }, [emitSample]);

  const attachElement = React.useCallback(
    (element: HTMLMediaElement | null) => {
      managedRef.current = true;
      if (element === attachedElRef.current && (element === null || activeRef.current)) {
        return;
      }
      if (attachedElRef.current && attachedElRef.current !== element) {
        doRetire();
      }
      attachedElRef.current = element;
      activeRef.current = element !== null;
      if (element !== null) {
        sourceSettledRef.current = true;
      }
    },
    [doRetire],
  );

  const retireElement = React.useCallback(() => {
    doRetire();
  }, [doRetire]);

  const trackPosition = React.useCallback((el: HTMLMediaElement) => {
    if (hasStartedRef.current) {
      lastPositionRef.current = el.currentTime;
    }
  }, []);

  const applyInitialSeek = React.useCallback((el: HTMLMediaElement, adoptWindowSec = 0.01) => {
    const target = lastPositionRef.current;
    if (typeof target !== 'number' || target <= 0) return;
    if (el.currentTime > adoptWindowSec) return;
    const dur = el.duration;
    const clamped = Number.isFinite(dur) && dur > 0 ? Math.min(target, dur) : target;
    try {
      el.currentTime = clamped;
    } catch {
      /* setting currentTime before ready can throw in some engines; ignore */
    }
  }, []);

  // The element may already have fired `loadedmetadata` and will not fire it again, so the late seek is applied here.
  React.useEffect(() => {
    if (seedFromProps === null) return;
    if (seededRef.current) return;
    const el = elementRef.current;
    if (el && el.currentTime > LATE_RESUME_ADOPT_WINDOW_SEC) return;
    seededRef.current = true;
    lastPositionRef.current = seedFromProps;
    if (el) applyInitialSeek(el, LATE_RESUME_ADOPT_WINDOW_SEC);
  }, [seedFromProps, applyInitialSeek, elementRef]);

  const onLoadedMetadata = React.useCallback(
    (e: React.SyntheticEvent<HTMLMediaElement>) => {
      const el = e.currentTarget;
      if (!isFromActiveElement(el)) return;
      sourceSettledRef.current = true;
      applyInitialSeek(el);
    },
    [applyInitialSeek, isFromActiveElement],
  );

  const onTimeUpdate = React.useCallback(
    (e: React.SyntheticEvent<HTMLMediaElement>) => {
      const el = e.currentTarget;
      if (!isFromActiveElement(el)) return;
      if (!el.paused && !el.ended) {
        hasStartedRef.current = true;
        sourceSettledRef.current = true;
      }
      trackPosition(el);
      if (el.paused) return;
      if (!seededRef.current && el.currentTime <= LATE_RESUME_ADOPT_WINDOW_SEC) return;
      const now = Date.now();
      if (now - lastSampleAtRef.current >= PROGRESS_SAMPLE_INTERVAL_MS) {
        lastSampleAtRef.current = now;
        emitSample(el, 'periodic');
      }
    },
    [emitSample, trackPosition, isFromActiveElement],
  );

  const onPlay = React.useCallback(
    (e: React.SyntheticEvent<HTMLMediaElement>) => {
      if (!isFromActiveElement(e.currentTarget)) return;
      sourceSettledRef.current = true;
      setHasEnded(false);
    },
    [isFromActiveElement],
  );

  const onPause = React.useCallback(
    (e: React.SyntheticEvent<HTMLMediaElement>) => {
      const el = e.currentTarget;
      if (!isFromActiveElement(el) || !sourceSettledRef.current) return;
      trackPosition(el);
      lastSampleAtRef.current = Date.now();
      emitSample(el, 'pause');
    },
    [emitSample, trackPosition, isFromActiveElement],
  );

  const onSeeked = React.useCallback(
    (e: React.SyntheticEvent<HTMLMediaElement>) => {
      const el = e.currentTarget;
      // A retired element's src-removal `load()` resets the cursor to 0 and can report it as a seek.
      if (!isFromActiveElement(el) || !sourceSettledRef.current) return;
      trackPosition(el);
      lastSampleAtRef.current = Date.now();
      emitSample(el, 'seeked');
    },
    [emitSample, trackPosition, isFromActiveElement],
  );

  const onEndedHandler = React.useCallback(
    (e: React.SyntheticEvent<HTMLMediaElement>) => {
      const el = e.currentTarget;
      if (!isFromActiveElement(el) || !sourceSettledRef.current) return;
      hasStartedRef.current = true;
      lastPositionRef.current = el.currentTime;
      lastSampleAtRef.current = Date.now();
      emitSample(el, 'ended');
      setHasEnded(true);
      onEndedRef.current?.();
    },
    [emitSample, isFromActiveElement],
  );

  React.useImperativeHandle(
    playbackControlsRef,
    (): MediaPlaybackControls => ({
      restart() {
        const el = elementRef.current;
        if (!el) return;
        seekMedia(el, 0);
        lastPositionRef.current = 0;
        setHasEnded(false);
        void el.play().catch(() => {});
      },
      seekTo(seconds: number) {
        const el = elementRef.current;
        if (!el) return;
        const dur = el.duration;
        const clamped =
          Number.isFinite(dur) && dur > 0
            ? Math.min(Math.max(seconds, 0), dur)
            : Math.max(seconds, 0);
        seekMedia(el, clamped);
        hasStartedRef.current = true;
        lastPositionRef.current = clamped;
      },
    }),
    [elementRef],
  );

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
    attachElement,
    retireElement,
  };
}
