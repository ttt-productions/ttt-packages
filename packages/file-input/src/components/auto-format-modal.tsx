"use client";

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@ttt-productions/ui-core";

export interface AutoFormatModalProps {
  open: boolean;
  title?: string;
  description?: string;
  proceedLabel?: string;
  cancelLabel?: string;
  onProceed: () => void;
  onCancel: () => void;
}

export function AutoFormatModal(props: AutoFormatModalProps) {
  const {
    open,
    title = "We’ll auto-format this video",
    description = "This video doesn’t match the required format. We can auto-crop/resize/transcode after upload. This may take longer.",
    proceedLabel = "Proceed (Auto-format)",
    cancelLabel = "Cancel",
    onProceed,
    onCancel,
  } = props;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex-row justify-end gap-2">
          <Button variant="destructive" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant="default" onClick={onProceed}>
            {proceedLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
