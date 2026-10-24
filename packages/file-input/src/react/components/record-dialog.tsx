'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Video, Mic, X, RotateCcw, Check } from 'lucide-react';
import { startWaveformLoop } from '@ttt-productions/media-viewer';
import { MediaPreview } from '@ttt-productions/media-viewer/react';
import { ensureFileWithContentType } from '../../lib/infer-content-type.js';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Spinner,
  useAsyncAction,
} from '@ttt-productions/ui-core/react';
import { releaseObjectUrl } from '../../lib/validate-media-duration.js';

type RecorderState = 'idle' | 'recording' | 'preview';

// An explicit supported container keeps mr.mimeType deterministic; Safari has no webm and falls
// through to mp4.
const RECORDER_MIME_CANDIDATES: Record<'audio' | 'video', readonly string[]> = {
  audio: ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'],
  video: ['video/webm;codecs=vp9,opus', 'video/webm', 'video/mp4'],
};

function stopIfRecording(recorder: MediaRecorder | null): void {
  if (!recorder || recorder.state !== 'recording') return;
  try {
    recorder.stop();
  } catch {
    // A recorder that stopped between the state check and this call throws; it has stopped.
  }
}

function pickRecorderMimeType(kind: 'audio' | 'video'): string | undefined {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    return undefined;
  }
  for (const candidate of RECORDER_MIME_CANDIDATES[kind]) {
    try {
      if (MediaRecorder.isTypeSupported(candidate)) return candidate;
    } catch {
      // A browser that cannot parse a candidate throws; it counts as unsupported.
    }
  }
  return undefined;
}

// mp4 is not in the ambiguous-extension map, so an audio recording is named .m4a whatever
// container type the recorder reports.
function recordingFileName(mime: string, kind: 'audio' | 'video'): string {
  const base = mime.split(';')[0].trim().toLowerCase();
  const ext =
    base === 'audio/mp4' || base === 'video/mp4'
      ? kind === 'audio'
        ? 'm4a'
        : 'mp4'
      : base === 'audio/ogg' || base === 'video/ogg'
        ? 'ogg'
        : 'webm';
  return `recording.${ext}`;
}

// A MediaRecorder blob runs a little longer than start() to stop() (muxer flush, frame-end
// duration, late timers) and both duration gates are exact, so recording stops before the cap.
const AUTO_STOP_SAFETY_MARGIN_MS = 750;

export function autoStopDelayMs(maxRecordDurationSec: number): number {
  const capMs = Math.floor(maxRecordDurationSec * 1000);
  return Math.max(capMs - AUTO_STOP_SAFETY_MARGIN_MS, Math.ceil(capMs / 2));
}

interface RecordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialKind: 'audio' | 'video';
  canPhoto: boolean;
  canRecVideo: boolean;
  canRecAudio: boolean;
  cameraFacingMode?: 'user' | 'environment';
  maxRecordDurationSec?: number;
  disabled?: boolean;
  isLoading?: boolean;
  onRecorded: (
    file: File,
    previewUrl: string,
    recordedKind: 'audio' | 'video',
  ) => void | Promise<void>;
  onRequestPhoto?: () => void;
}

function formatDuration(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function RecordDialog({
  open,
  onOpenChange,
  initialKind,
  canPhoto,
  canRecVideo,
  canRecAudio,
  cameraFacingMode,
  maxRecordDurationSec,
  disabled = false,
  isLoading = false,
  onRecorded,
  onRequestPhoto,
}: RecordDialogProps) {
  const [recordKind, setRecordKind] = useState<'audio' | 'video'>(initialKind);
  const [recorderState, setRecorderState] = useState<RecorderState>('idle');
  const [recordPreviewUrl, setRecordPreviewUrl] = useState<string | null>(null);
  const [recordedFile, setRecordedFile] = useState<File | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acquiring, setAcquiring] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordStreamRef = useRef<MediaStream | null>(null);
  const liveStreamKindRef = useRef<'audio' | 'video' | null>(null);
  const recordChunksRef = useRef<BlobPart[]>([]);
  const lastRecordUrlRef = useRef<string | null>(null);
  const livePreviewRef = useRef<HTMLVideoElement | null>(null);
  const autoStopTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // An acquisition that resolves after a teardown belongs to nobody and is never attached.
  const acquireGenRef = useRef(0);
  const previewReqRef = useRef(0);

  const startedAtRef = useRef<number>(0);
  const elapsedIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const audioAnalyserRef = useRef<AnalyserNode | null>(null);
  const audioSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const waveformStopRef = useRef<(() => void) | null>(null);
  const waveformCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (open) {
      setRecordKind(initialKind);
      setRecorderState('idle');
      setRecordedFile(null);
      setRecordPreviewUrl(null);
      setElapsedMs(0);
      setDiscardConfirmOpen(false);
      setError(null);
    }
  }, [open, initialKind]);

  const revokeLastRecordUrl = useCallback(() => {
    if (!lastRecordUrlRef.current) return;
    releaseObjectUrl(lastRecordUrlRef.current);
    lastRecordUrlRef.current = null;
  }, []);

  const makeRecordUrl = useCallback(
    (blob: Blob) => {
      revokeLastRecordUrl();
      const url = URL.createObjectURL(blob);
      lastRecordUrlRef.current = url;
      return url;
    },
    [revokeLastRecordUrl],
  );

  const stopElapsedTimer = useCallback(() => {
    if (elapsedIntervalRef.current) {
      clearInterval(elapsedIntervalRef.current);
      elapsedIntervalRef.current = null;
    }
  }, []);

  const startElapsedTimer = useCallback(() => {
    stopElapsedTimer();
    startedAtRef.current = Date.now();
    setElapsedMs(0);
    elapsedIntervalRef.current = setInterval(() => {
      setElapsedMs(Date.now() - startedAtRef.current);
    }, 100);
  }, [stopElapsedTimer]);

  const stopWaveform = useCallback(() => {
    waveformStopRef.current?.();
    waveformStopRef.current = null;
    try {
      audioSourceRef.current?.disconnect();
    } catch {
      // A node that is already disconnected throws, and there is nothing left to tear down.
    }
    audioSourceRef.current = null;
    audioAnalyserRef.current = null;
    const ctx = audioContextRef.current;
    audioContextRef.current = null;
    if (ctx && ctx.state !== 'closed') {
      // Closing a context the browser is already closing rejects; the context is released either way.
      ctx.close().catch(() => {});
    }
  }, []);

  const startWaveform = useCallback(
    (stream: MediaStream) => {
      stopWaveform();
      try {
        // lib.dom does not declare Safari's prefixed webkitAudioContext.
        const prefixed = window as Window & { webkitAudioContext?: typeof AudioContext };
        const AudioCtx: typeof AudioContext | undefined =
          window.AudioContext || prefixed.webkitAudioContext;
        if (!AudioCtx) return;

        const ctx = new AudioCtx();
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);

        audioContextRef.current = ctx;
        audioSourceRef.current = source;
        audioAnalyserRef.current = analyser;

        waveformStopRef.current = startWaveformLoop({
          analyser,
          getCanvas: () => waveformCanvasRef.current,
          mode: 'line',
        });
      } catch {
        // The waveform is decoration: a browser that refuses an audio graph records without one.
      }
    },
    [stopWaveform],
  );

  const teardownCapture = useCallback(() => {
    acquireGenRef.current += 1;
    if (autoStopTimeoutRef.current) {
      clearTimeout(autoStopTimeoutRef.current);
      autoStopTimeoutRef.current = null;
    }
    mediaRecorderRef.current = null;

    const s = recordStreamRef.current;
    recordStreamRef.current = null;
    liveStreamKindRef.current = null;
    if (s) s.getTracks().forEach((t) => t.stop());

    if (livePreviewRef.current) {
      livePreviewRef.current.srcObject = null;
    }

    recordChunksRef.current = [];

    stopElapsedTimer();
    stopWaveform();
  }, [stopElapsedTimer, stopWaveform]);

  const acquireStream = useCallback(
    async (kind: 'audio' | 'video') => {
      const wantVideo = kind === 'video';
      const facingMode = cameraFacingMode ?? 'user';
      const gen = acquireGenRef.current;
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: wantVideo ? { facingMode } : false,
      });
      if (gen !== acquireGenRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return null;
      }
      recordStreamRef.current = stream;
      liveStreamKindRef.current = kind;
      setError(null);
      if (wantVideo && livePreviewRef.current) {
        livePreviewRef.current.srcObject = stream;
        livePreviewRef.current.muted = true;
        try {
          await livePreviewRef.current.play();
        } catch {
          // A browser that blocks preview playback rejects; recording does not depend on it.
        }
      } else if (!wantVideo) {
        startWaveform(stream);
      }
      return stream;
    },
    [cameraFacingMode, startWaveform],
  );

  const startLivePreview = useCallback(
    async (kind: 'audio' | 'video') => {
      teardownCapture();
      const req = ++previewReqRef.current;
      setAcquiring(true);
      try {
        await acquireStream(kind);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Camera/microphone access denied.');
      } finally {
        if (req === previewReqRef.current) setAcquiring(false);
      }
    },
    [teardownCapture, acquireStream],
  );

  useEffect(() => {
    if (open) {
      void startLivePreview(initialKind);
    }
    return () => {
      teardownCapture();
      revokeLastRecordUrl();
    };
  }, [open, initialKind, startLivePreview, teardownCapture, revokeLastRecordUrl]);

  const startRecording = useCallback(
    async (kind: 'audio' | 'video') => {
      revokeLastRecordUrl();
      setRecordPreviewUrl(null);
      setRecordedFile(null);
      setRecordKind(kind);

      const wantVideo = kind === 'video';

      let stream = recordStreamRef.current;
      if (!stream || liveStreamKindRef.current !== kind) {
        try {
          stream = await acquireStream(kind);
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Camera/microphone access denied.');
          return;
        }
      }
      if (!stream) return;

      const preferredMimeType = pickRecorderMimeType(kind);
      let mr: MediaRecorder;
      try {
        mr = preferredMimeType
          ? new MediaRecorder(stream, { mimeType: preferredMimeType })
          : new MediaRecorder(stream);
      } catch {
        mr = new MediaRecorder(stream);
      }
      mediaRecorderRef.current = mr;
      recordChunksRef.current = [];

      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) recordChunksRef.current.push(e.data);
      };

      mr.onstop = () => {
        const blob = new Blob(recordChunksRef.current, {
          type: mr.mimeType || preferredMimeType || (wantVideo ? 'video/webm' : 'audio/webm'),
        });

        const rawFile = new File([blob], recordingFileName(blob.type, kind), { type: blob.type });
        const file = ensureFileWithContentType(rawFile, wantVideo ? 'video' : 'audio');
        const url = makeRecordUrl(file);

        setRecordedFile(file);
        setRecordPreviewUrl(url);
        setRecorderState('preview');

        teardownCapture();
      };

      mr.start();
      setRecorderState('recording');
      startElapsedTimer();

      if (maxRecordDurationSec && maxRecordDurationSec > 0) {
        autoStopTimeoutRef.current = setTimeout(
          () => stopIfRecording(mediaRecorderRef.current),
          autoStopDelayMs(maxRecordDurationSec),
        );
      }
    },
    [
      acquireStream,
      maxRecordDurationSec,
      makeRecordUrl,
      revokeLastRecordUrl,
      teardownCapture,
      startElapsedTimer,
    ],
  );

  const stopRecording = useCallback(() => {
    const mr = mediaRecorderRef.current;
    if (mr && mr.state === 'recording') {
      try {
        mr.stop();
      } catch {
        teardownCapture();
        setRecorderState('idle');
      }
    } else {
      teardownCapture();
      setRecorderState('idle');
    }
  }, [teardownCapture]);

  const handleReRecord = useCallback(() => {
    revokeLastRecordUrl();
    setRecordPreviewUrl(null);
    setRecordedFile(null);
    setElapsedMs(0);
    setError(null);
    setRecorderState('idle');
    void startLivePreview(recordKind);
  }, [revokeLastRecordUrl, startLivePreview, recordKind]);

  const handleSelectKind = useCallback(
    (kind: 'audio' | 'video') => {
      setRecordKind(kind);
      setError(null);
      void startLivePreview(kind);
    },
    [startLivePreview],
  );

  const reportError = useCallback((e: unknown) => {
    setError(e instanceof Error ? e.message : 'Something went wrong with the recording.');
  }, []);

  const start = useAsyncAction((kind: 'audio' | 'video') => startRecording(kind), {
    onError: reportError,
  });

  const save = useAsyncAction(
    async () => {
      if (!recordedFile || !recordPreviewUrl) return;
      await onRecorded(recordedFile, recordPreviewUrl, recordKind);
      onOpenChange(false);
    },
    { onError: reportError },
  );

  const closeDialogImmediately = useCallback(() => {
    stopIfRecording(mediaRecorderRef.current);
    teardownCapture();
    revokeLastRecordUrl();
    setRecordedFile(null);
    setRecordPreviewUrl(null);
    setElapsedMs(0);
    setRecorderState('idle');
    setDiscardConfirmOpen(false);
    onOpenChange(false);
  }, [teardownCapture, revokeLastRecordUrl, onOpenChange]);

  const handleDialogOpenChange = useCallback(
    (v: boolean) => {
      if (v) return;
      if (save.pending) return;
      if (recorderState === 'preview') {
        setDiscardConfirmOpen(true);
        return;
      }
      closeDialogImmediately();
    },
    [recorderState, save.pending, closeDialogImmediately],
  );

  const isRecording = recorderState === 'recording';
  const isPreview = recorderState === 'preview';
  const isIdle = recorderState === 'idle';

  const elapsedLabel = maxRecordDurationSec
    ? `${formatDuration(elapsedMs)} / ${formatDuration(maxRecordDurationSec * 1000)}`
    : formatDuration(elapsedMs);

  return (
    <>
      <Dialog open={open} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record</DialogTitle>
            <DialogDescription>
              {isIdle && 'Choose audio or video, then press Start.'}
              {isRecording && 'Recording…'}
              {isPreview && 'Review your recording. Save to upload, or Re-record to try again.'}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap gap-2">
            {canRecVideo && (
              <Button
                type="button"
                variant={recordKind === 'video' ? 'default' : 'secondary'}
                aria-pressed={recordKind === 'video'}
                onClick={() => handleSelectKind('video')}
                disabled={!isIdle || acquiring}
                icon={<Video className="icon-xs" />}
              >
                Video
              </Button>
            )}
            {canRecAudio && (
              <Button
                type="button"
                variant={recordKind === 'audio' ? 'default' : 'secondary'}
                aria-pressed={recordKind === 'audio'}
                onClick={() => handleSelectKind('audio')}
                disabled={!isIdle || acquiring}
                icon={<Mic className="icon-xs" />}
              >
                Audio
              </Button>
            )}
            {canPhoto && onRequestPhoto && (
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  onRequestPhoto();
                  onOpenChange(false);
                }}
                disabled={!isIdle}
                icon={<Camera className="icon-xs" />}
              >
                Photo
              </Button>
            )}
          </div>

          {recordKind === 'video' && !isPreview && (
            <div className="relative mt-2 rounded-md overflow-hidden bg-[hsl(var(--neutral-black))] aspect-video">
              <video
                ref={livePreviewRef}
                className="w-full h-full object-contain"
                playsInline
                muted
              />
              {acquiring && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Spinner size="lg" label="Starting camera" />
                </div>
              )}
            </div>
          )}

          {recordKind === 'audio' && !isPreview && (
            <div className="relative mt-2 rounded-md bg-muted p-2 text-primary">
              <canvas
                ref={waveformCanvasRef}
                width={480}
                height={80}
                className="w-full h-20"
                aria-label="Audio waveform"
              />
              {acquiring && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Spinner size="lg" label="Starting microphone" />
                </div>
              )}
            </div>
          )}

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          {isRecording && (
            <div className="flex items-center gap-2 text-sm" aria-live="polite">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full bg-[color:var(--recording-indicator)] animate-pulse"
                aria-label="Recording"
              />
              <span className="tabular-nums">{elapsedLabel}</span>
            </div>
          )}

          {isPreview && recordPreviewUrl && (
            <div className="mt-2">
              <MediaPreview
                url={recordPreviewUrl}
                type={recordKind}
                controls
                priority
                className="w-full rounded-md"
              />
            </div>
          )}

          <DialogFooter className="flex-row justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleDialogOpenChange(false)}
              disabled={save.pending}
              icon={<X className="icon-xs" />}
            >
              Close
            </Button>

            {isIdle && (
              <Button
                type="button"
                variant="default"
                onClick={() => void start.run(recordKind)}
                disabled={disabled || isLoading || acquiring}
                pending={start.pending}
                icon={
                  recordKind === 'video' ? (
                    <Video className="icon-xs" />
                  ) : (
                    <Mic className="icon-xs" />
                  )
                }
              >
                Start
              </Button>
            )}

            {isRecording && (
              <Button type="button" variant="default" onClick={stopRecording}>
                Stop
              </Button>
            )}

            {isPreview && (
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleReRecord}
                  disabled={save.pending}
                  icon={<RotateCcw className="icon-xs" />}
                >
                  Re-record
                </Button>
                <Button
                  type="button"
                  variant="default"
                  onClick={() => void save.run()}
                  disabled={disabled || isLoading}
                  pending={save.pending}
                  icon={<Check className="icon-xs" />}
                >
                  Save
                </Button>
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={discardConfirmOpen} onOpenChange={setDiscardConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard recording?</AlertDialogTitle>
            <AlertDialogDescription>
              You have a recorded clip that hasn't been saved. Closing now will discard it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep recording</AlertDialogCancel>
            <AlertDialogAction onClick={closeDialogImmediately}>Discard</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
