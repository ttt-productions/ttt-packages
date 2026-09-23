"use client";

import React, { useState, useCallback } from "react";
import Cropper, { type Area } from "react-easy-crop";
 
const CropperComponent = Cropper as unknown as React.ComponentType<any>;
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, Slider, useAsyncAction } from "@ttt-productions/ui-core/react";
import { getCroppedImg } from "../../lib/image-utils.js";

export interface ImageCropperModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageSrc: string | null;
  aspectRatio: number;
  shape: "rect" | "round";
  outputWidth: number;
  outputHeight: number;
  onCropComplete: (croppedBlob: Blob | null) => void;
}

export function ImageCropperModal(props: ImageCropperModalProps) {
  const { isOpen, onClose, imageSrc, aspectRatio, shape, outputWidth, outputHeight, onCropComplete } = props;

  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const handleCropComplete = useCallback((_a: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  // Confirm renders the crop, then emits it. It is pending for that whole window and
  // ignores a repeat click, so a double click can never emit (and upload) twice.
  const confirm = useAsyncAction(
    async () => {
      if (!imageSrc || !croppedAreaPixels) return;
      const blob = await getCroppedImg(imageSrc, croppedAreaPixels, 0, { horizontal: false, vertical: false }, outputWidth, outputHeight);
      onCropComplete(blob);
      onClose();
    },
    { onError: () => onCropComplete(null) },
  );

  if (!imageSrc) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !confirm.pending && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Crop Image</DialogTitle>
          <DialogDescription>Adjust the crop area and zoom level to select the desired portion of your image.</DialogDescription>
        </DialogHeader>

        <div className="relative h-64 w-full bg-muted">
          <CropperComponent
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={aspectRatio}
            cropShape={shape}
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={handleCropComplete}
          />
        </div>

        <div className="stack-2">
          <label htmlFor="zoom" className="text-small">Zoom</label>
          <Slider id="zoom" min={1} max={3} step={0.1} value={[zoom]} onValueChange={(v) => setZoom(v[0])} />
        </div>

        <DialogFooter className="flex-row justify-end gap-2">
          <Button variant="destructive" onClick={onClose} disabled={confirm.pending}>Cancel</Button>
          <Button variant="default" onClick={() => void confirm.run()} pending={confirm.pending}>Confirm</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
