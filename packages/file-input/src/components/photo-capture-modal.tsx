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
} from "@ttt-productions/ui-core";
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleFlip = useCallback(() => {
    const next = activeFacing === "user" ? "environment" : "user";
    setActiveFacing(next);
    startStream(next);
  }, [activeFacing, startStream]);

  const handleCapture = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `photo-${Date.now()}.jpg`, { type: "image/jpeg" });
        stopStream();
        onCapture(file);
      },
      "image/jpeg",
      0.9,
    );
  }, [onCapture, stopStream]);

  const handleClose = useCallback(() => {
    stopStream();
    onClose();
  }, [stopStream, onClose]);

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
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="h-full w-full object-cover"
            style={{ transform: activeFacing === "user" ? "scaleX(-1)" : undefined }}
          />
          {error && (
            <div className="absolute inset-0 flex items-center justify-center p-4 text-center text-sm text-destructive">
              {error}
            </div>
          )}
        </div>

        <DialogFooter className="flex-row justify-between gap-2">
          <Button variant="destructive" onClick={handleClose}>
            <X className="mr-2 icon-xs" />
            Close
          </Button>

          <div className="flex gap-2">
            <Button variant="secondary" onClick={handleFlip} disabled={!ready}>
              <SwitchCamera className="mr-2 icon-xs" />
              Flip
            </Button>

            <Button variant="default" onClick={handleCapture} disabled={!ready}>
              <Camera className="mr-2 icon-xs" />
              Capture
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
