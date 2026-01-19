"use client";

import React, { useCallback, useId, useMemo, useRef, useState } from "react";
import type { MediaCropSpec, MediaProcessingSpec, VideoOrientation } from "@ttt-productions/media-contracts";
import { getSimplifiedMediaType } from "@ttt-productions/media-contracts";
import { Info, Camera, Mic, Video, Upload, X } from "lucide-react";

import {
  Alert,
  AlertDescription,
  Button,
  Card,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  cn,
} from "@ttt-productions/ui-core";

import type { FileInputError, MediaInputProps, SelectedMediaMeta } from "../types";
import { AutoFormatModal } from "./auto-format-modal";
import { ImageCropperModal } from "./image-cropper-modal";
import { MediaConstraintsHint } from "./media-constraints-hint";
import { readMediaMeta } from "../lib/read-media-meta";
import { validateMediaDuration } from "../lib/validate-media-duration";

function err(code: FileInputError["code"], message: string, details?: Record<string, unknown>): FileInputError {
  return { code, message, details };
}

function hasConstraints(spec: MediaProcessingSpec): boolean {
  return Boolean(
    spec.accept?.kinds?.length ||
      spec.accept?.mimes?.length ||
      spec.maxBytes ||
      spec.maxDurationSec ||
      spec.video?.maxDurationSec ||
      spec.audio?.maxDurationSec ||
      (spec.videoOrientation && spec.videoOrientation !== "any") ||
      spec.requiredAspectRatio ||
      (spec.requiredWidth && spec.requiredHeight) ||
      spec.imageCrop ||
      spec.allowAutoFormat
  );
}

function matchMime(accepted: string, actual: string): boolean {
  const a = accepted.trim().toLowerCase();
  const m = actual.trim().toLowerCase();
  if (!a) return true;
  if (a === "*/*") return true;
  if (a.endsWith("/*")) return m.startsWith(a.slice(0, -1));
  return a === m;
}

function accepts(spec: MediaProcessingSpec, file: File): boolean {
  const accept = spec.accept;
  if (!accept) return true;

  const kinds = accept.kinds?.filter(Boolean) ?? [];
  const mimes = accept.mimes?.filter(Boolean) ?? [];

  const simplified = getSimplifiedMediaType(file);
  const kind: "image" | "video" | "audio" | "file" =
    simplified === "image" || simplified === "video" || simplified === "audio" ? simplified : "file";

  const kindOk = kinds.length === 0 ? true : kinds.includes(kind);
  if (!kindOk) return false;

  // If mimes list is empty, accept anything (including unknown file.type)
  if (mimes.length === 0) return true;

  // If mimes list exists but browser doesn't know type, reject
  if (!file.type) return false;

  return mimes.some((a) => matchMime(a, file.type));
}

function computeAspect(width?: number, height?: number): number | undefined {
  if (!width || !height) return undefined;
  return width / height;
}

function orientationOk(required: VideoOrientation | undefined, actual: VideoOrientation | undefined): boolean {
  if (!required || required === "any") return true;
  if (!actual || actual === "any") return true; // treat square/unknown as ok
  return required === actual;
}

function aspectOk(required: number | undefined, actual: number | undefined): boolean {
  if (!required) return true;
  if (!actual) return false;
  return Math.abs(actual - required) <= 0.02; // ~2% tolerance
}

export function MediaInput(props: MediaInputProps) {
  const { spec, cropOverride, disabled = false, isLoading = false, className, buttonLabel = "Select file", onChange } =
    props;

  const id = useId();
  const pickerRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);

  const cropSpec: MediaCropSpec | undefined = cropOverride ?? spec.imageCrop;

  const [localError, setLocalError] = useState<FileInputError | null>(null);

  const [showInfo, setShowInfo] = useState(false);
  const showInfoToggle = hasConstraints(spec);

  const [cropOpen, setCropOpen] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [pendingCropFile, setPendingCropFile] = useState<File | null>(null);

  const [autoOpen, setAutoOpen] = useState(false);
  const [pendingAutoFile, setPendingAutoFile] = useState<{ file: File; meta: SelectedMediaMeta } | null>(null);

  const [recordOpen, setRecordOpen] = useState(false);
  const [recordKind, setRecordKind] = useState<"audio" | "video">("video");
  const [recording, setRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordStreamRef = useRef<MediaStream | null>(null);
  const recordChunksRef = useRef<BlobPart[]>([]);
  const [recordPreviewUrl, setRecordPreviewUrl] = useState<string | null>(null);

  // Prevent memory leaks from object URLs
  const lastObjectUrlRef = useRef<string | null>(null);
  const lastRecordUrlRef = useRef<string | null>(null);

  React.useEffect(() => {
    return () => {
      if (lastObjectUrlRef.current) URL.revokeObjectURL(lastObjectUrlRef.current);
      if (lastRecordUrlRef.current) URL.revokeObjectURL(lastRecordUrlRef.current);
    };
  }, []);

  const acceptAttr = useMemo(() => {
    const m = spec.accept?.mimes?.filter(Boolean) ?? [];
    const k = spec.accept?.kinds?.filter(Boolean) ?? [];
    if (m.length) return m.join(", ");
    if (k.includes("image") && k.length === 1) return "image/*";
    if (k.includes("video") && k.length === 1) return "video/*";
    if (k.includes("audio") && k.length === 1) return "audio/*";
    return undefined; // accept anything
  }, [spec]);

  const emit = useCallback(
    (payload: {
      file?: File;
      previewUrl?: string;
      meta?: SelectedMediaMeta;
      autoFormat?: boolean;
      croppedBlob?: Blob;
      error?: FileInputError;
    }) => {
      onChange({ spec, ...payload });
    },
    [onChange, spec]
  );

  const fail = useCallback(
    (e: FileInputError) => {
      setLocalError(e);
      emit({ error: e });
    },
    [emit]
  );

  const resetRecordState = useCallback(() => {
    setRecording(false);
    mediaRecorderRef.current = null;

    const s = recordStreamRef.current;
    recordStreamRef.current = null;
    if (s) s.getTracks().forEach((t) => t.stop());

    recordChunksRef.current = [];
  }, []);

  const stopRecording = useCallback(() => {
    try {
      const mr = mediaRecorderRef.current;
      if (mr && mr.state === "recording") mr.stop();
    } finally {
      resetRecordState();
    }
  }, [resetRecordState]);

  const handleSelected = useCallback(
    async (file: File, previewUrl?: string) => {
      setLocalError(null);

      if (!accepts(spec, file)) {
        fail(err("invalid_type", "Invalid file type for this upload."));
        return;
      }

      const meta = await readMediaMeta(file);

      // bytes
      if (spec.maxBytes && file.size > spec.maxBytes) {
        fail(
          err("too_large", `File too large. Max ${Math.round(spec.maxBytes / 1024 / 1024)}MB.`, {
            size: file.size,
            maxBytes: spec.maxBytes,
          })
        );
        return;
      }

      // duration
      const maxDur = spec.maxDurationSec ?? spec.video?.maxDurationSec ?? spec.audio?.maxDurationSec;
      if ((meta.kind === "video" || meta.kind === "audio") && maxDur) {
        const ok = await validateMediaDuration(file, maxDur);
        if (!ok) {
          fail(err("too_long", `Media too long. Max ${maxDur} seconds.`));
          return;
        }
      }

      // image crop enforcement
      if (meta.kind === "image" && cropSpec) {
        const reader = new FileReader();
        reader.onload = () => {
          setPendingCropFile(file);
          setCropSrc(reader.result as string);
          setCropOpen(true);
        };
        reader.onerror = () => fail(err("read_failed", "Failed to read image for cropping."));
        reader.readAsDataURL(file);
        return;
      }

      // video uniform enforcement (orientation/aspect/dimensions)
      if (meta.kind === "video") {
        const requiredOri = spec.videoOrientation;
        const requiredAspect = spec.requiredAspectRatio;
        const requiredW = spec.requiredWidth;
        const requiredH = spec.requiredHeight;

        const actualOri = meta.orientation;
        const actualAspect = computeAspect(meta.width, meta.height);

        const okOri = orientationOk(requiredOri, actualOri);
        const okAspect = aspectOk(requiredAspect, actualAspect);
        const okDims = !requiredW || !requiredH ? true : meta.width === requiredW && meta.height === requiredH;

        if (!okOri || !okAspect || !okDims) {
          if (spec.allowAutoFormat) {
            setPendingAutoFile({ file, meta });
            setAutoOpen(true);
            return;
          }

          if (!okOri) {
            fail(
              err("orientation_mismatch", "Video orientation does not match the required format.", {
                requiredOri,
                actualOri,
              })
            );
            return;
          }
          if (!okAspect) {
            fail(
              err("aspect_ratio_mismatch", "Video aspect ratio does not match the required format.", {
                requiredAspect,
                actualAspect,
              })
            );
            return;
          }
          if (!okDims) {
            fail(
              err("dimensions_mismatch", "Video dimensions do not match the required format.", {
                requiredW,
                requiredH,
                width: meta.width,
                height: meta.height,
              })
            );
            return;
          }
        }
      }

      emit({ file, previewUrl, meta });
    },
    [spec, cropSpec, emit, fail]
  );

  const onPick = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;

      if (lastObjectUrlRef.current) URL.revokeObjectURL(lastObjectUrlRef.current);
      const url = URL.createObjectURL(file);
      lastObjectUrlRef.current = url;

      await handleSelected(file, url);
    },
    [handleSelected]
  );

  const onCropComplete = useCallback(
    (blob: Blob | null) => {
      setCropOpen(false);

      const original = pendingCropFile;
      setPendingCropFile(null);

      if (!blob || !original) {
        fail(err("crop_failed", "Cropping failed."));
        setCropSrc(null);
        return;
      }

      const type = blob.type || "image/jpeg";
      const name = original.name?.replace(/\.[^/.]+$/, "") || "image";
      const ext = type.includes("png")
        ? "png"
        : type.includes("webp")
          ? "webp"
          : type.includes("avif")
            ? "avif"
            : "jpg";

      const croppedFile = new File([blob], `${name}.cropped.${ext}`, { type });

      if (lastObjectUrlRef.current) URL.revokeObjectURL(lastObjectUrlRef.current);
      const url = URL.createObjectURL(croppedFile);
      lastObjectUrlRef.current = url;

      readMediaMeta(croppedFile).then((meta) => emit({ file: croppedFile, previewUrl: url, meta, croppedBlob: blob }));

      setCropSrc(null);
    },
    [emit, fail, pendingCropFile]
  );

  const proceedAuto = useCallback(() => {
    const p = pendingAutoFile;
    setAutoOpen(false);
    setPendingAutoFile(null);
    if (!p) return;

    if (lastObjectUrlRef.current) URL.revokeObjectURL(lastObjectUrlRef.current);
    const url = URL.createObjectURL(p.file);
    lastObjectUrlRef.current = url;

    emit({ file: p.file, previewUrl: url, meta: p.meta, autoFormat: true });
  }, [emit, pendingAutoFile]);

  const cancelAuto = useCallback(() => {
    setAutoOpen(false);
    setPendingAutoFile(null);
  }, []);

  const startRecording = useCallback(
    async (kind: "audio" | "video") => {
      setLocalError(null);
      setRecordPreviewUrl(null);
      setRecordKind(kind);

      const wantVideo = kind === "video";
      const facingMode = spec.client?.cameraFacingMode ?? "user";

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: wantVideo ? { facingMode } : false,
      });

      recordStreamRef.current = stream;

      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      recordChunksRef.current = [];

      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) recordChunksRef.current.push(e.data);
      };

      mr.onstop = async () => {
        const blob = new Blob(recordChunksRef.current, {
          type: mr.mimeType || (wantVideo ? "video/webm" : "audio/webm"),
        });

        const file = new File([blob], `recording.webm`, { type: blob.type });

        if (lastRecordUrlRef.current) URL.revokeObjectURL(lastRecordUrlRef.current);
        const url = URL.createObjectURL(file);
        lastRecordUrlRef.current = url;

        setRecordPreviewUrl(url);
        await handleSelected(file, url);
      };

      mr.start();
      setRecording(true);

      const max = spec.client?.maxRecordDurationSec;
      if (max && max > 0) {
        setTimeout(() => {
          try {
            if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
              mediaRecorderRef.current.stop();
            }
          } catch {}
        }, Math.floor(max * 1000));
      }
    },
    [spec, handleSelected]
  );

  const canPick = spec.client?.allowPick ?? true;
  const canPhoto = spec.client?.allowCapturePhoto ?? true;
  const canRecVideo = spec.client?.allowRecordVideo ?? true;
  const canRecAudio = spec.client?.allowRecordAudio ?? true;

  return (
    <Card className={cn("p-3", className)}>
      <div className="flex flex-wrap gap-2">
        {canPick && (
          <>
            <Input
              id={`media-pick-${id}`}
              ref={pickerRef}
              type="file"
              accept={acceptAttr}
              className="hidden"
              onChange={onPick}
              disabled={disabled || isLoading}
            />
            <Button variant="default" onClick={() => pickerRef.current?.click()} disabled={disabled || isLoading}>
              <Upload className="mr-2 icon-xs" />
              {buttonLabel}
            </Button>
          </>
        )}

        {canPhoto && (
          <>
            <Input
              id={`media-photo-${id}`}
              ref={photoRef}
              type="file"
              accept="image/*"
              capture={spec.client?.cameraFacingMode ?? "user"}
              className="hidden"
              onChange={onPick}
              disabled={disabled || isLoading}
            />
            <Button variant="secondary" onClick={() => photoRef.current?.click()} disabled={disabled || isLoading}>
              <Camera className="mr-2 icon-xs" />
              Take photo
            </Button>
          </>
        )}

        {(canRecVideo || canRecAudio) && (
          <Button variant="secondary" onClick={() => setRecordOpen(true)} disabled={disabled || isLoading}>
            <Video className="mr-2 icon-xs" />
            Record
          </Button>
        )}

        {showInfoToggle ? (
          <Button variant="outline" onClick={() => setShowInfo((v) => !v)} disabled={disabled || isLoading}>
            <Info className="mr-2 icon-xs" />
            {showInfo ? "Hide info" : "Info"}
          </Button>
        ) : null}
      </div>

      {showInfo && showInfoToggle ? <MediaConstraintsHint spec={spec} className="mt-3" /> : null}

      {localError && (
        <Alert variant="destructive" className="mt-3">
          <AlertDescription>{localError.message}</AlertDescription>
        </Alert>
      )}

      {cropSpec && (
        <ImageCropperModal
          isOpen={cropOpen}
          onClose={() => {
            setCropOpen(false);
            setCropSrc(null);
          }}
          imageSrc={cropSrc}
          aspectRatio={cropSpec.aspectRatio}
          shape={"rect"}
          outputWidth={cropSpec.outputWidth}
          outputHeight={cropSpec.outputHeight}
          onCropComplete={onCropComplete}
        />
      )}

      <AutoFormatModal open={autoOpen} onProceed={proceedAuto} onCancel={cancelAuto} />

      <Dialog
        open={recordOpen}
        onOpenChange={(v) => {
          if (!v) {
            stopRecording();
            setRecordOpen(false);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record</DialogTitle>
            <DialogDescription>Record audio or video.</DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap gap-2">
            {canRecVideo && (
              <Button
                variant={recordKind === "video" ? "default" : "secondary"}
                onClick={() => setRecordKind("video")}
                disabled={recording}
              >
                <Video className="mr-2 icon-xs" />
                Video
              </Button>
            )}
            {canRecAudio && (
              <Button
                variant={recordKind === "audio" ? "default" : "secondary"}
                onClick={() => setRecordKind("audio")}
                disabled={recording}
              >
                <Mic className="mr-2 icon-xs" />
                Audio
              </Button>
            )}
          </div>

          {recordPreviewUrl && (
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
              onClick={() => {
                stopRecording();
                setRecordOpen(false);
              }}
              disabled={false}
            >
              <X className="mr-2 icon-xs" />
              Close
            </Button>

            {!recording ? (
              <Button variant="default" onClick={() => startRecording(recordKind)} disabled={disabled || isLoading}>
                {recordKind === "video" ? <Video className="mr-2 icon-xs" /> : <Mic className="mr-2 icon-xs" />}
                Start
              </Button>
            ) : (
              <Button variant="default" onClick={stopRecording}>
                Stop
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
