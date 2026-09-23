"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Spinner,
  useAsyncAction,
} from "@ttt-productions/ui-core/react";
import { Camera, SwitchCamera, X } from "lucide-react";

export interface PhotoCaptureModalProps {
  open: boolean;
  facingMode?: "user" | "environment";
  onCapture: (file: File) => void;
  onClose: () => void;
}

export function PhotoCaptureModal(props: PhotoCaptureModalProps) {
  const { open, facingMode = "user", onCapture, onClose } = props;

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [activeFacing, setActiveFacing] = useState(facingMode);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stopStream = useCallback(() => {
    const s = streamRef.current;
    streamRef.current = null;
    if (s) s.getTracks().forEach((t) => t.stop());
    setReady(false);
  }, []);

  const startStream = useCallback(
    async (facing: "user" | "environment") => {
      stopStream();
      setError(null);

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing },
          audio: false,
        });
        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setReady(true);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Camera access denied.";
        setError(msg);
      }
    },
    [stopStream],
  );

  useEffect(() => {
    if (open) {
      startStream(activeFacing);
    } else {
      stopStream();
    }
    return () => stopStream();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- (re)acquire only when the dialog opens; Flip restarts the stream itself
  }, [open]);

  const reportError = useCallback((e: unknown) => {
    setError(e instanceof Error ? e.message : "Camera access denied.");
  }, []);

  const flip = useAsyncAction(
    async () => {
      const next = activeFacing === "user" ? "environment" : "user";
      setActiveFacing(next);
      await startStream(next);
    },
    { onError: reportError },
  );

  // Capture is pending until the frame is encoded and handed off, and ignores a repeat
  // tap, so a double tap can never emit (and upload) two photos.
  const capture = useAsyncAction(
    async () => {
      const video = videoRef.current;
      if (!video) return;

      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not capture a photo.");

      ctx.drawImage(video, 0, 0);

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
      if (!blob) throw new Error("Could not capture a photo.");
      const file = new File([blob], `photo-${Date.now()}.jpg`, { type: "image/jpeg" });
      stopStream();
      onCapture(file);
    },
    { onError: reportError },
  );

  const handleClose = useCallback(() => {
    if (capture.pending) return;
    stopStream();
    onClose();
  }, [capture.pending, stopStream, onClose]);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) handleClose();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Take Photo</DialogTitle>
          <DialogDescription>Position yourself and tap capture.</DialogDescription>
        </DialogHeader>

        <div className="relative w-full overflow-hidden rounded-md bg-muted" style={{ aspectRatio: "4/3" }}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="h-full w-full object-cover"
            style={{ transform: activeFacing === "user" ? "scaleX(-1)" : undefined }}
          />
          {open && !ready && !error && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Spinner size="lg" label="Starting camera" />
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center p-4 text-center text-sm text-destructive">
              {error}
            </div>
          )}
        </div>

        <DialogFooter className="flex-row justify-between gap-2">
          <Button variant="destructive" onClick={handleClose} disabled={capture.pending} icon={<X className="icon-xs" />}>
            Close
          </Button>

          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => void flip.run()}
              disabled={!ready || capture.pending}
              pending={flip.pending}
              icon={<SwitchCamera className="icon-xs" />}
            >
              Flip
            </Button>

            <Button
              variant="default"
              onClick={() => void capture.run()}
              disabled={!ready || flip.pending}
              pending={capture.pending}
              icon={<Camera className="icon-xs" />}
            >
              Capture
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
