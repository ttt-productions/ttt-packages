"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useId } from "react";
import { getSimplifiedMediaType, type SimplifiedMediaType } from "@ttt-productions/media-contracts";
import { Alert, AlertDescription, Button, Card, Input, Progress, cn } from "@ttt-productions/ui-core";
import { Info, X, Upload, Film, Music, Paperclip, AlertTriangle, Loader2 } from "lucide-react";

import type { FileInputError, FileInputProps } from "../types";
import { validateMediaDuration } from "../lib/validate-media-duration";
import { ImageCropperModal } from "./image-cropper-modal";

const MIME_MAP: Record<SimplifiedMediaType, string> = {
  image: "image/jpeg, image/png, image/gif, image/webp, image/svg+xml, image/bmp, image/avif",
  video: "video/*, .mkv",
  audio: "audio/*",
  other: ".pdf, .doc, .docx"
};

function err(code: FileInputError["code"], message: string, details?: Record<string, unknown>): FileInputError {
  return { code, message, details };
}

export function FileInput(props: FileInputProps) {
  const {
    acceptTypes,
    maxSizeMB,
    selectedFile,
    onChange,
    onError,
    isLoading = false,
    disabled = false,
    buttonLabel = "Upload File",
    className,
    uploadProgress = null,
    variant = "default",
    size = "default",
    cropConfig,
    videoMaxDurationSec,
    audioMaxDurationSec,
    defaultShowDetails = false,
  } = props;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastPreviewUrlRef = useRef<string | null>(null);

  const revokeLastPreviewUrl = useCallback(() => {
    if (!lastPreviewUrlRef.current) return;
    try {
      URL.revokeObjectURL(lastPreviewUrlRef.current);
    } catch {}
    lastPreviewUrlRef.current = null;
  }, []);

  const makePreviewUrl = useCallback((blob: Blob) => {
    revokeLastPreviewUrl();
    const url = URL.createObjectURL(blob);
    lastPreviewUrlRef.current = url;
    return url;
  }, [revokeLastPreviewUrl]);

  useEffect(() => {
    return () => revokeLastPreviewUrl();
  }, [revokeLastPreviewUrl]);
  const uniqueId = useId();
  const inputId = `file-input-${uniqueId}`;

  const [internalSelected, setInternalSelected] = useState<File | null>(null);
  const fileValue = selectedFile !== undefined ? selectedFile : internalSelected;

  const [localError, setLocalError] = useState<FileInputError | null>(null);

  const [isCropperOpen, setIsCropperOpen] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);

  const [showDetails, setShowDetails] = useState(defaultShowDetails);

  const acceptString = useMemo(
    () => (acceptTypes.length ? acceptTypes.map((t) => MIME_MAP[t]).join(", ") : undefined),
    [acceptTypes]
  );

  const detailsDescriptionParts = useMemo(() => {
    const parts: string[] = [];

    if (cropConfig) {
      const ratioDisplay = cropConfig.aspectRatioDisplay || `${cropConfig.aspectRatio.toFixed(2)}:1`;
      parts.push(`Image will be cropped to a ${ratioDisplay} rect (${cropConfig.outputWidth}x${cropConfig.outputHeight}px).`);
    }

    const sizeParts = acceptTypes
      .map((t) => (maxSizeMB[t] ? `${t.charAt(0).toUpperCase() + t.slice(1)} (${maxSizeMB[t]}MB)` : null))
      .filter(Boolean) as string[];

    if (sizeParts.length) parts.push(`Max sizes: ${sizeParts.join(", ")}.`);

    if (videoMaxDurationSec) parts.push(`Max video duration: ${videoMaxDurationSec}s.`);
    if (audioMaxDurationSec) parts.push(`Max audio duration: ${audioMaxDurationSec}s.`);

    return parts;
  }, [acceptTypes, maxSizeMB, cropConfig, videoMaxDurationSec, audioMaxDurationSec]);

  const getUploadIcon = () => {
    if (acceptTypes.includes("image")) return <Upload className="mr-2 icon-xs" />;
    if (acceptTypes.includes("video")) return <Film className="mr-2 icon-xs" />;
    if (acceptTypes.includes("audio")) return <Music className="mr-2 icon-xs" />;
    return <Upload className="mr-2 icon-xs" />;
  };

  const clearNative = () => {
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const emitError = (e: FileInputError, type: SimplifiedMediaType = "other") => {
    setLocalError(e);
    onError?.(e);
    onChange({ type, error: e });
  };

  const handleClear = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    e.preventDefault();
    setLocalError(null);
    setInternalSelected(null);
    clearNative();
    onChange({ type: "other" });
  };

  const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    clearNative();
    setLocalError(null);

    if (!file) {
      setInternalSelected(null);
      onChange({ type: "other" });
      return;
    }

    const fileType = getSimplifiedMediaType(file);
    if (acceptTypes.length && !acceptTypes.includes(fileType)) {
      emitError(err("invalid_type", `Invalid file type. Allowed: ${acceptTypes.join(", ")}.`), fileType);
      return;
    }

    const maxBytes = (maxSizeMB[fileType] ?? Infinity) * 1024 * 1024;
    if (file.size > maxBytes) {
      emitError(err("too_large", `File too large. Max ${maxSizeMB[fileType]}MB for ${fileType}.`, { size: file.size, maxBytes }), fileType);
      return;
    }

    if (fileType === "video" && videoMaxDurationSec) {
      const ok = await validateMediaDuration(file, videoMaxDurationSec);
      if (!ok) {
        emitError(err("too_long", `Video too long. Max ${videoMaxDurationSec} seconds.`), fileType);
        return;
      }
    }

    if (fileType === "audio" && audioMaxDurationSec) {
      const ok = await validateMediaDuration(file, audioMaxDurationSec);
      if (!ok) {
        emitError(err("too_long", `Audio too long. Max ${audioMaxDurationSec} seconds.`), fileType);
        return;
      }
    }

    // cropping path
    if (cropConfig && fileType === "image") {
      const reader = new FileReader();
      reader.onload = () => {
        setImageToCrop(reader.result as string);
        setIsCropperOpen(true);
      };
      reader.onerror = () => {
        emitError(err("read_failed", "Failed to read image for cropping."));
      };
      reader.readAsDataURL(file);
      setInternalSelected(file);
      return;
    }

    // normal selection
    setInternalSelected(file);
    const previewUrl = makePreviewUrl(file);
    onChange({ type: fileType, file, previewUrl, revokePreviewUrl: revokeLastPreviewUrl });
  }, [acceptTypes, maxSizeMB, cropConfig, videoMaxDurationSec, audioMaxDurationSec]);

  const handleCropComplete = (blob: Blob | null) => {
    setIsCropperOpen(false);

    const original = internalSelected;
    setImageToCrop(null);

    if (!blob) {
      emitError(err("crop_failed", "Cropping failed."), "image");
      return;
    }

    onChange({
      type: "image",
      file: original ?? undefined,
      blob,
      previewUrl: makePreviewUrl(blob),
      revokePreviewUrl: revokeLastPreviewUrl,
    });
  };

  const isUploading = typeof uploadProgress === "number" && isLoading;

  return (
    <div className={cn("relative w-full", className)}>
      {localError && (
        <Alert variant="destructive" className="mb-2">
          <AlertTriangle className="icon-xs" />
          <AlertDescription>{localError.message}</AlertDescription>
        </Alert>
      )}

      <Input
        id={inputId}
        type="file"
        accept={acceptString}
        onChange={handleFileChange}
        className="hidden"
        disabled={disabled || isLoading}
        ref={fileInputRef}
      />

      <div className="flex items-center gap-2">
        <label htmlFor={inputId} className="w-full flex-grow">
          <Button
            asChild
            disabled={disabled || isLoading}
            variant={variant}
            size={size}
            className={cn("w-full relative overflow-hidden cursor-pointer", { "icon-xl p-0": size === "icon" })}
          >
            <span className="relative w-full h-full center-row">
              {isUploading && (
                <Progress value={uploadProgress ?? 0} className="absolute left-0 top-0 h-full w-full z-0 bg-accent" />
              )}

              <span className="z-10 center-row w-full">
                {isLoading ? (
                  <><Loader2 className="mr-2 spinner-xs" /> {isUploading ? `${(uploadProgress ?? 0).toFixed(0)}%` : "Processing..."}</>
                ) : fileValue ? (
                  <span className="flex items-center justify-between w-full">
                    <span className="truncate pr-2">{fileValue.name}</span>
                    <Button variant="ghost" size="icon" className="icon-sm hover:bg-destructive/20 shrink-0" onClick={handleClear}>
                      <X className="icon-xs" />
                    </Button>
                  </span>
                ) : (
                  <>
                    {buttonLabel === "Attach"
                      ? <><Paperclip className="mr-2 icon-xs" /> {buttonLabel}</>
                      : <>{getUploadIcon()} {buttonLabel}</>}
                  </>
                )}
              </span>
            </span>
          </Button>
        </label>

        {detailsDescriptionParts.length > 0 && size !== "icon" && (
          <Button
            type="button"
            variant="default"
            size="icon"
            onClick={() => setShowDetails((p) => !p)}
            aria-label="Show file processing details"
            className="flex-shrink-0 icon-xl"
          >
            <Info className="icon-sm" />
          </Button>
        )}
      </div>

      {showDetails && detailsDescriptionParts.length > 0 && size !== "icon" && (
        <Card className="page-card w-full mt-2">
          <div className="text-center p-2 space-y-0.5">
            {detailsDescriptionParts.map((part, i) => (
              <p key={i} className="text-small font-bold">{part}</p>
            ))}
          </div>
        </Card>
      )}

      {cropConfig && imageToCrop && (
        <ImageCropperModal
          isOpen={isCropperOpen}
          onClose={() => {
            setIsCropperOpen(false);
            setImageToCrop(null);
          }}
          imageSrc={imageToCrop}
          aspectRatio={cropConfig.aspectRatio}
          shape={cropConfig.shape}
          outputWidth={cropConfig.outputWidth}
          outputHeight={cropConfig.outputHeight}
          onCropComplete={handleCropComplete}
        />
      )}
    </div>
  );
}
