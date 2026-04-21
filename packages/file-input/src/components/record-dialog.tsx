"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Video, Mic, X, RotateCcw, Check } from "lucide-react";
import { ensureFileWithContentType } from "../lib/infer-content-type";
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
} from "@ttt-productions/ui-core";

type RecorderState = "idle" | "recording" | "preview";

interface RecordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialKind: "audio" | "video";
  canPhoto: boolean;
  canRecVideo: boolean;
  canRecAudio: boolean;
  cameraFacingMode?: "user" | "environment";
  maxRecordDurationSec?: number;
  disabled?: boolean;
  isLoading?: boolean;
  onRecorded: (file: File, previewUrl: string) => void | Promise<void>;
  onRequestPhoto?: () => void;
}

function formatDuration(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
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
  const [recordKind, setRecordKind] = useState<"audio" | "video">(initialKind);
  const [recorderState, setRecorderState] = useState<RecorderState>("idle");
  const [recordPreviewUrl, setRecordPreviewUrl] = useState<string | null>(null);
  const [recordedFile, setRecordedFile] = useState<File | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordStreamRef = useRef<MediaStream | null>(null);
  const recordChunksRef = useRef<BlobPart[]>([]);
  const lastRecordUrlRef = useRef<string | null>(null);
  const livePreviewRef = useRef<HTMLVideoElement | null>(null);
  const autoStopTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startedAtRef = useRef<number>(0);
  const elapsedIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const audioAnalyserRef = useRef<AnalyserNode | null>(null);
  const audioSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const waveformRafRef = useRef<number | null>(null);
  const waveformCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Reset all transient state whenever the dialog opens.
  useEffect(() => {
    if (open) {
      setRecordKind(initialKind);
      setRecorderState("idle");
      setRecordedFile(null);
      setRecordPreviewUrl(null);
      setElapsedMs(0);
      setDiscardConfirmOpen(false);
    }
  }, [open, initialKind]);

  const revokeLastRecordUrl = useCallback(() => {
    if (!lastRecordUrlRef.current) return;
    try {
      URL.revokeObjectURL(lastRecordUrlRef.current);
    } catch {}
    lastRecordUrlRef.current = null;
  }, []);

  const makeRecordUrl = useCallback(
    (blob: Blob) => {
      revokeLastRecordUrl();
      const url = URL.createObjectURL(blob);
      lastRecordUrlRef.current = url;
      return url;
    },
    [revokeLastRecordUrl]
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
    if (waveformRafRef.current !== null) {
      cancelAnimationFrame(waveformRafRef.current);
      waveformRafRef.current = null;
    }
    try {
      audioSourceRef.current?.disconnect();
    } catch {}
    audioSourceRef.current = null;
    audioAnalyserRef.current = null;
    const ctx = audioContextRef.current;
    audioContextRef.current = null;
    if (ctx && ctx.state !== "closed") {
      ctx.close().catch(() => {});
    }
  }, []);

  const startWaveform = useCallback(
    (stream: MediaStream) => {
      stopWaveform();
      try {
        const AudioCtx: typeof AudioContext =
          (window as any).AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtx) return;

        const ctx = new AudioCtx();
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);

        audioContextRef.current = ctx;
        audioSourceRef.current = source;
        audioAnalyserRef.current = analyser;

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const draw = () => {
          const canvas = waveformCanvasRef.current;
          const currAnalyser = audioAnalyserRef.current;
          if (!canvas || !currAnalyser) {
            waveformRafRef.current = null;
            return;
          }
          currAnalyser.getByteTimeDomainData(dataArray);

          const canvasCtx = canvas.getContext("2d");
          if (!canvasCtx) {
            waveformRafRef.current = null;
            return;
          }

          const { width, height } = canvas;
          canvasCtx.clearRect(0, 0, width, height);

          canvasCtx.lineWidth = 2;
          canvasCtx.strokeStyle = "currentColor";
          canvasCtx.beginPath();

          const sliceWidth = width / bufferLength;
          let x = 0;
          for (let i = 0; i < bufferLength; i++) {
            const v = dataArray[i] / 128.0; // 0..2 centered on 1.0
            const y = (v * height) / 2;
            if (i === 0) canvasCtx.moveTo(x, y);
            else canvasCtx.lineTo(x, y);
            x += sliceWidth;
          }
          canvasCtx.lineTo(width, height / 2);
          canvasCtx.stroke();

          waveformRafRef.current = requestAnimationFrame(draw);
        };

        waveformRafRef.current = requestAnimationFrame(draw);
      } catch {
        // Waveform is best-effort; silent failures are acceptable.
      }
    },
    [stopWaveform]
  );

  // Teardown MediaRecorder / MediaStream / auto-stop timeout / timer / waveform.
  // Leaves recorderState alone — callers decide the next state.
  const teardownCapture = useCallback(() => {
    if (autoStopTimeoutRef.current) {
      clearTimeout(autoStopTimeoutRef.current);
      autoStopTimeoutRef.current = null;
    }
    mediaRecorderRef.current = null;

    const s = recordStreamRef.current;
    recordStreamRef.current = null;
    if (s) s.getTracks().forEach((t) => t.stop());

    if (livePreviewRef.current) {
      livePreviewRef.current.srcObject = null;
    }

    recordChunksRef.current = [];

    stopElapsedTimer();
    stopWaveform();
  }, [stopElapsedTimer, stopWaveform]);

  useEffect(() => {
    return () => {
      revokeLastRecordUrl();
      teardownCapture();
    };
  }, [revokeLastRecordUrl, teardownCapture]);

  const startRecording = useCallback(
    async (kind: "audio" | "video") => {
      // Discard any previous preview before starting fresh.
      revokeLastRecordUrl();
      setRecordPreviewUrl(null);
      setRecordedFile(null);
      setRecordKind(kind);

      const wantVideo = kind === "video";
      const facingMode = cameraFacingMode ?? "user";

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: wantVideo ? { facingMode } : false,
      });

      recordStreamRef.current = stream;

      if (wantVideo && livePreviewRef.current) {
        livePreviewRef.current.srcObject = stream;
        livePreviewRef.current.muted = true;
        try {
          await livePreviewRef.current.play();
        } catch {}
      } else {
        // Audio kind: start waveform analysis on the same stream.
        startWaveform(stream);
      }

      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      recordChunksRef.current = [];

      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) recordChunksRef.current.push(e.data);
      };

      mr.onstop = () => {
        const blob = new Blob(recordChunksRef.current, {
          type: mr.mimeType || (wantVideo ? "video/webm" : "audio/webm"),
        });

        const rawFile = new File([blob], "recording.webm", { type: blob.type });
        // Defense-in-depth: ensure a valid media MIME even if MediaRecorder returned ""
        const file = ensureFileWithContentType(rawFile, wantVideo ? "video" : "audio");
        const url = makeRecordUrl(file);

        setRecordedFile(file);
        setRecordPreviewUrl(url);
        setRecorderState("preview");

        // Release devices but keep the recorded file/url in state.
        teardownCapture();
      };

      mr.start();
      setRecorderState("recording");
      startElapsedTimer();

      if (maxRecordDurationSec && maxRecordDurationSec > 0) {
        autoStopTimeoutRef.current = setTimeout(() => {
          try {
            if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
              mediaRecorderRef.current.stop();
            }
          } catch {}
        }, Math.floor(maxRecordDurationSec * 1000));
      }
    },
    [
      cameraFacingMode,
      maxRecordDurationSec,
      makeRecordUrl,
      revokeLastRecordUrl,
      teardownCapture,
      startElapsedTimer,
      startWaveform,
    ]
  );

  const stopRecording = useCallback(() => {
    const mr = mediaRecorderRef.current;
    if (mr && mr.state === "recording") {
      try {
        mr.stop();
      } catch {
        teardownCapture();
        setRecorderState("idle");
      }
    } else {
      teardownCapture();
      setRecorderState("idle");
    }
  }, [teardownCapture]);

  const handleReRecord = useCallback(() => {
    revokeLastRecordUrl();
    setRecordPreviewUrl(null);
    setRecordedFile(null);
    setElapsedMs(0);
    setRecorderState("idle");
  }, [revokeLastRecordUrl]);

  const handleSave = useCallback(async () => {
    if (!recordedFile || !recordPreviewUrl) return;
    await onRecorded(recordedFile, recordPreviewUrl);
    onOpenChange(false);
  }, [recordedFile, recordPreviewUrl, onRecorded, onOpenChange]);

  // Close the dialog for real (no confirmation). Used for idle/recording
  // states and as the "Discard" action in the confirm AlertDialog.
  const closeDialogImmediately = useCallback(() => {
    const mr = mediaRecorderRef.current;
    if (mr && mr.state === "recording") {
      try {
        mr.stop();
      } catch {}
    }
    teardownCapture();
    revokeLastRecordUrl();
    setRecordedFile(null);
    setRecordPreviewUrl(null);
    setElapsedMs(0);
    setRecorderState("idle");
    setDiscardConfirmOpen(false);
    onOpenChange(false);
  }, [teardownCapture, revokeLastRecordUrl, onOpenChange]);

  // Dialog close requests. In "preview" state we ask for confirmation
  // (the user has unsaved work). Other states close immediately.
  const handleDialogOpenChange = useCallback(
    (v: boolean) => {
      if (v) return; // opening is parent-driven via the `open` prop
      if (recorderState === "preview") {
        setDiscardConfirmOpen(true);
        return;
      }
      closeDialogImmediately();
    },
    [recorderState, closeDialogImmediately]
  );

  const isRecording = recorderState === "recording";
  const isPreview = recorderState === "preview";
  const isIdle = recorderState === "idle";

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
              {isIdle && "Choose audio or video, then press Start."}
              {isRecording && "Recording…"}
              {isPreview && "Review your recording. Save to upload, or Re-record to try again."}
            </DialogDescription>
          </DialogHeader>

          {/* Kind toggle — only active in idle state */}
          <div className="flex flex-wrap gap-2">
            {canRecVideo && (
              <Button
                variant={recordKind === "video" ? "default" : "secondary"}
                onClick={() => setRecordKind("video")}
                disabled={!isIdle}
              >
                <Video className="mr-2 icon-xs" />
                Video
              </Button>
            )}
            {canRecAudio && (
              <Button
                variant={recordKind === "audio" ? "default" : "secondary"}
                onClick={() => setRecordKind("audio")}
                disabled={!isIdle}
              >
                <Mic className="mr-2 icon-xs" />
                Audio
              </Button>
            )}
            {canPhoto && onRequestPhoto && (
              <Button
                variant="secondary"
                onClick={() => {
                  onRequestPhoto();
                  onOpenChange(false);
                }}
                disabled={!isIdle}
              >
                <Camera className="mr-2 icon-xs" />
                Photo
              </Button>
            )}
          </div>

          {/* Live video preview — rendered in idle+recording states for video kind */}
          {recordKind === "video" && !isPreview && (
            <div className="mt-2 rounded-md overflow-hidden bg-black aspect-video">
              <video
                ref={livePreviewRef}
                className="w-full h-full object-contain"
                playsInline
                muted
              />
            </div>
          )}

          {/* Audio waveform — rendered in recording state for audio kind */}
          {recordKind === "audio" && isRecording && (
            <div className="mt-2 rounded-md bg-muted p-2 text-primary">
              <canvas
                ref={waveformCanvasRef}
                width={480}
                height={80}
                className="w-full h-20"
                aria-label="Audio waveform"
              />
            </div>
          )}

          {/* Recording indicator + elapsed timer */}
          {isRecording && (
            <div className="flex items-center gap-2 text-sm" aria-live="polite">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse"
                aria-label="Recording"
              />
              <span className="tabular-nums">{elapsedLabel}</span>
            </div>
          )}

          {/* Recorded preview — only in preview state */}
          {isPreview && recordPreviewUrl && (
            <div className="mt-2">
              {recordKind === "video" ? (
                <video src={recordPreviewUrl} controls className="w-full rounded-md" />
              ) : (
                <audio src={recordPreviewUrl} controls className="w-full" />
              )}
            </div>
          )}

          <DialogFooter className="flex-row justify-between gap-2">
            <Button
              variant="destructive"
              onClick={() => handleDialogOpenChange(false)}
            >
              <X className="mr-2 icon-xs" />
              Close
            </Button>

            {isIdle && (
              <Button
                variant="default"
                onClick={() => startRecording(recordKind)}
                disabled={disabled || isLoading}
              >
                {recordKind === "video" ? <Video className="mr-2 icon-xs" /> : <Mic className="mr-2 icon-xs" />}
                Start
              </Button>
            )}

            {isRecording && (
              <Button variant="default" onClick={stopRecording}>
                Stop
              </Button>
            )}

            {isPreview && (
              <div className="flex gap-2">
                <Button variant="secondary" onClick={handleReRecord}>
                  <RotateCcw className="mr-2 icon-xs" />
                  Re-record
                </Button>
                <Button variant="default" onClick={handleSave} disabled={disabled || isLoading}>
                  <Check className="mr-2 icon-xs" />
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
            <AlertDialogAction onClick={closeDialogImmediately}>
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
