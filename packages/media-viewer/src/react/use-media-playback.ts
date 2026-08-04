"use client";

import * as React from "react";
import type {
  MediaPlaybackControls,
  MediaPlaybackProps,
  MediaProgressSampleReason,
} from "../types.js";

/**
 * Throttle interval for periodic progress samples. A sample fires at most once
 * per this many milliseconds of active (non-paused) playback via `timeupdate`.
 */
export const PROGRESS_SAMPLE_INTERVAL_MS = 5000;

/**
 * How far an element may have played from the start and still ADOPT a
 * late-arriving `startAtSeconds`. Autoplay can begin playback before the app's
 * async resume position resolves (firefox reliably loses that race); a couple
 * of autoplayed seconds are not user intent, so the saved position still wins
 * inside this window. Beyond it, a late value is ignored — the user is
 * genuinely watching from where they are.
 */
export const LATE_RESUME_ADOPT_WINDOW_SEC = 3;

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
  /**
   * Element lifecycle boundary. Attach the native element through this callback
   * (compose it into the element `ref`) so the hook knows which element
   * generation is ACTIVE. A detach (`null`) retires the outgoing element:
   * its still-live cursor is committed as one final `pause` sample (unless the
   * last commit already reported that exact position, playback never started,
   * or the position is still inside the pre-seed suppression window), and every
   * later `pause`/`seeked`/`ended`/`timeupdate` event from that retired element
   * is ignored — a teardown-generated reset can never masquerade as a user
   * playback event. Opt-in: a consumer that never calls this keeps the previous
   * ungated behavior.
   */
  attachElement: (element: HTMLMediaElement | null) => void;
  /**
   * Retire the currently attached element NOW, before a destructive media
   * operation the caller is about to perform on it (`pause()` +
   * `removeAttribute("src")` + `load()`, DOM removal, source replacement).
   * Emits the same final-snapshot commit as a detach and stops all further
   * reporting from that element. Idempotent — a later detach of an already
   * retired element emits nothing. Re-attaching an element through
   * `attachElement` reactivates reporting.
   */
  retireElement: () => void;
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
 *
 * The hook is also the single owner of the ACTIVE element generation: viewers
 * attach their native element through `attachElement` (composed into the
 * element ref) and call `retireElement` before performing a destructive media
 * operation (`pause()` + src removal + `load()`, source replacement, DOM
 * removal). A retiring element's still-live cursor is committed once as a
 * final `pause` sample, and every media event a torn-down element emits
 * afterwards (browsers reset the cursor to 0 and can fire pause/seeked/
 * timeupdate during teardown) is ignored — so a teardown reset can never be
 * presented to the app as a user playback event.
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

  // The resume position implied by the CURRENT props: a positive
  // startAtSeconds, or null when the caller supplies none. One declaration —
  // the mount seed, the mediaKey reset, and the late-arrival effect all read it.
  const seedFromProps =
    typeof startAtSeconds === "number" && startAtSeconds > 0 ? startAtSeconds : null;

  // Last known playback position. Seeded from startAtSeconds, then updated once
  // playback has actually started. Survives the unloadOnExit unload/remount
  // cycle because it lives on the (still-mounted) component instance.
  const lastPositionRef = React.useRef<number | null>(seedFromProps);
  // True once we have observed real playback progress — after this we resume
  // from lastPositionRef, never re-apply the original startAtSeconds prop.
  const hasStartedRef = React.useRef(false);
  // True once a startAtSeconds seed has been ADOPTED (at mount or late-arrival).
  // Owns the adopt-exactly-once rule for the late-arrival effect below — playback
  // state is deliberately NOT that gate, because autoplay can start playback
  // before an async resume position arrives (see LATE_RESUME_ADOPT_WINDOW_SEC).
  const seededRef = React.useRef(seedFromProps !== null);

  // Throttle bookkeeping for periodic samples (wall-clock, active playback only).
  const lastSampleAtRef = React.useRef(0);

  // --- Active-element lifecycle (retirement boundary) -----------------------
  // The element generation currently attached via `attachElement`, whether that
  // generation is still ACTIVE (retirement flips this off), and whether this
  // hook instance is lifecycle-managed at all (a consumer that never calls
  // `attachElement` keeps the previous ungated behavior).
  const attachedElRef = React.useRef<HTMLMediaElement | null>(null);
  const activeRef = React.useRef(false);
  const managedRef = React.useRef(false);
  // The position of the last commit-class (`pause`/`seeked`/`ended`) sample
  // actually emitted. Retirement consults it so an already-reported final
  // position (a pause/scrub/ended the app has just committed) is not emitted a
  // second time by the retirement snapshot.
  const lastCommittedRef = React.useRef<number | null>(null);
  // After a source swap on a RETAINED element, events queued by the outgoing
  // source's teardown can still arrive addressed to the same element. Until the
  // NEW source proves itself live (loadedmetadata, play, or a playing
  // timeupdate), commit-class events are ignored — an old URL must not emit
  // into the callback for a new URL. True from mount so a fresh element's
  // pre-metadata pause/seek still reports as before.
  const sourceSettledRef = React.useRef(true);

  // Render-phase reset-on-source-change: when the media source (`mediaKey`)
  // changes, the same component/hook instance is being reused for a DIFFERENT
  // asset (e.g. a playlist swapping `url` in place). Reset every piece of
  // per-source tracking so the previous media's position/ended/throttle state
  // cannot bleed onto the new element. This is the sanctioned render-phase
  // reset-on-prop-change pattern (not a set-state-in-effect).
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
      if (reason !== "periodic") {
        lastCommittedRef.current = el.currentTime;
      }
      const cb = onProgressSampleRef.current;
      if (!cb) return;
      const duration = Number.isFinite(el.duration) ? el.duration : 0;
      cb(el.currentTime, duration, reason);
    },
    [],
  );

  /**
   * Is this event from the element generation that is allowed to report?
   * Only enforced once the consumer opted into lifecycle management.
   */
  const isFromActiveElement = React.useCallback((el: HTMLMediaElement) => {
    if (!managedRef.current) return true;
    return activeRef.current && attachedElRef.current === el;
  }, []);

  // Retire the attached element: commit its still-live cursor once (final
  // `pause` snapshot), then mark it inactive so later teardown-generated
  // events are ignored. Snapshot rules: nothing to report unless playback
  // actually started; skip when the last commit already reported this exact
  // position; and honor the pre-seed suppression window — an autoplaying
  // element torn down before the async resume decision settled must not write
  // its near-0 drift over a saved position.
  const doRetire = React.useCallback(() => {
    const el = attachedElRef.current;
    if (el && activeRef.current) {
      if (hasStartedRef.current) {
        const position = el.currentTime;
        const preSeed =
          !seededRef.current && position <= LATE_RESUME_ADOPT_WINDOW_SEC;
        if (!preSeed && lastCommittedRef.current !== position) {
          lastPositionRef.current = position;
          emitSample(el, "pause");
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
        // A newly attached element IS its current source — no stale teardown
        // events can be queued against it yet.
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
    if (typeof target !== "number" || target <= 0) return;
    // Only seek an element still near the start. The DEFAULT window keeps the
    // metadata handler idempotent (a metadata event on an already-positioned
    // element is a no-op) and re-applies the LAST KNOWN position to the new
    // element created by an unloadOnExit remount — resuming, never restarting.
    // The late-arrival effect widens the window (LATE_RESUME_ADOPT_WINDOW_SEC)
    // because autoplay may have advanced a little before the seed arrived.
    if (el.currentTime > adoptWindowSec) return;
    const dur = el.duration;
    const clamped = Number.isFinite(dur) && dur > 0 ? Math.min(target, dur) : target;
    try {
      el.currentTime = clamped;
    } catch {
      /* setting currentTime before ready can throw in some engines; ignore */
    }
  }, []);

  // Late-arriving resume position. `startAtSeconds` usually comes from an async
  // app source (a user-prefs query); when that resolves AFTER this hook mounted,
  // the mount-time seed above saw `undefined` and the element would silently
  // start at 0. Adopt the value when it finally arrives — exactly ONCE
  // (`seededRef`), and only while the element is within the small adoption
  // window of the start, so a late value can never yank media the user is
  // genuinely watching. Playback state is deliberately NOT the gate: under
  // AUTOPLAY the element starts playing from 0 on its own, and by the time the
  // prefs query resolves it has drifted a fraction of a second — firefox loses
  // that race on every deep-link resume (live 2026-07-31, hosted path 14.4:
  // expected ~224s, read 0.2s). A few autoplayed seconds are not user intent;
  // jumping to the user's saved position IS the requested behavior. Beyond the
  // window (a user genuinely re-watching from the top) the late value is
  // ignored, same as before. A `mediaKey` change resets the refs in the
  // render-phase block above, re-arming this for the new source; the seek is
  // applied here because the element may already have fired `loadedmetadata`
  // and will not fire it again — when metadata has not landed yet,
  // `onLoadedMetadata` applies it.
  React.useEffect(() => {
    if (seedFromProps === null) return;
    if (seededRef.current) return; // adopt exactly once; never override an applied seed
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
      // Metadata is the new source proving itself live after an in-place swap.
      sourceSettledRef.current = true;
      applyInitialSeek(el);
    },
    [applyInitialSeek, isFromActiveElement],
  );

  const onTimeUpdate = React.useCallback(
    (e: React.SyntheticEvent<HTMLMediaElement>) => {
      const el = e.currentTarget;
      // A retired element's teardown resets (currentTime → 0) must not corrupt
      // the tracked resume position or produce samples.
      if (!isFromActiveElement(el)) return;
      // Any observed timeupdate while playing means playback has started; from
      // now on we track live position for remount resume. A PLAYING timeupdate
      // also proves the post-swap source live (teardown timeupdates are paused).
      if (!el.paused && !el.ended) {
        hasStartedRef.current = true;
        sourceSettledRef.current = true;
      }
      trackPosition(el);
      if (el.paused) return; // no periodic samples while paused
      // Pre-seed suppression: until a resume position has been adopted, an
      // element still near the start may be autoplaying from 0 while the app's
      // async saved position is in flight. A periodic ~0 sample here would be
      // written to durable state and CLOBBER that saved position before the
      // seek lands. Stay silent for the adoption window; the seek's `seeked`
      // flush reports the resumed position, and with no saved position at all
      // periodic sampling simply begins a few seconds in (harmless). Deliberate
      // pause/seeked/ended flushes are never suppressed — a user pausing at
      // 0.5 s is genuine intent.
      if (!seededRef.current && el.currentTime <= LATE_RESUME_ADOPT_WINDOW_SEC) return;
      const now = Date.now();
      if (now - lastSampleAtRef.current >= PROGRESS_SAMPLE_INTERVAL_MS) {
        lastSampleAtRef.current = now;
        emitSample(el, "periodic");
      }
    },
    [emitSample, trackPosition, isFromActiveElement],
  );

  const onPlay = React.useCallback(
    (e: React.SyntheticEvent<HTMLMediaElement>) => {
      if (!isFromActiveElement(e.currentTarget)) return;
      // A play event only ever comes from the current source (a torn-down
      // source cannot start playing), so it settles a post-swap source too.
      sourceSettledRef.current = true;
      // Playing again after an ended state (native replay) clears the overlay.
      setHasEnded(false);
    },
    [isFromActiveElement],
  );

  const onPause = React.useCallback(
    (e: React.SyntheticEvent<HTMLMediaElement>) => {
      const el = e.currentTarget;
      // Retired-element and old-source teardown pauses are not user intent.
      if (!isFromActiveElement(el) || !sourceSettledRef.current) return;
      trackPosition(el);
      // Flush a sample immediately on pause (final position for this segment).
      lastSampleAtRef.current = Date.now();
      emitSample(el, "pause");
    },
    [emitSample, trackPosition, isFromActiveElement],
  );

  const onSeeked = React.useCallback(
    (e: React.SyntheticEvent<HTMLMediaElement>) => {
      const el = e.currentTarget;
      // A retired element's src-removal `load()` resets the cursor to 0 and can
      // report it as a seek — that reset must never read as a user seek.
      if (!isFromActiveElement(el) || !sourceSettledRef.current) return;
      trackPosition(el);
      // Flush a sample on seek completion so the app sees the new position.
      // This is also how the programmatic initial-resume seek reports the
      // adopted position — the element fires `seeked` after applyInitialSeek.
      lastSampleAtRef.current = Date.now();
      emitSample(el, "seeked");
    },
    [emitSample, trackPosition, isFromActiveElement],
  );

  const onEndedHandler = React.useCallback(
    (e: React.SyntheticEvent<HTMLMediaElement>) => {
      const el = e.currentTarget;
      if (!isFromActiveElement(el) || !sourceSettledRef.current) return;
      // Ended means the play cursor reached duration; record final position.
      hasStartedRef.current = true;
      lastPositionRef.current = el.currentTime;
      // Flush a final sample with the ended position.
      lastSampleAtRef.current = Date.now();
      emitSample(el, "ended");
      setHasEnded(true);
      onEndedRef.current?.();
    },
    [emitSample, isFromActiveElement],
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
    attachElement,
    retireElement,
  };
}
