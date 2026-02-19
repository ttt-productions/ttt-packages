'use client';

import { useState, useRef } from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
  Label,
  Textarea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@ttt-productions/ui-core';
import { Loader2 } from 'lucide-react';
import { useReportCoreContext } from '../context/ReportCoreProvider.js';
import { useReportSubmit } from '../hooks/useReportSubmit.js';

interface ReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemType: string;
  itemId: string;
  parentItemId?: string;
  reportedUserId?: string;
  reportedUsername?: string;
  /** Current user ID. Required for submission. */
  reporterUserId?: string;
  /** Current user display name. */
  reporterUsername?: string;
  /** Called after successful submission. */
  onSubmitSuccess?: () => void;
  /** Called on submission error. */
  onSubmitError?: (error: Error) => void;
}

/**
 * Dialog for submitting a report.
 * Renders reason picker + comment textarea + submit button.
 * Reads config from ReportCoreProvider context.
 */
export function ReportDialog({
  open,
  onOpenChange,
  itemType,
  itemId,
  parentItemId,
  reportedUserId,
  reportedUsername,
  reporterUserId,
  reporterUsername,
  onSubmitSuccess,
  onSubmitError,
}: ReportDialogProps) {
  const { config } = useReportCoreContext();
  const submitMutation = useReportSubmit();
  const [reason, setReason] = useState('');
  const [comment, setComment] = useState('');
  const _commentRef = useRef<HTMLTextAreaElement>(null);

  const maxLength = config.maxReportCommentLength;
  const displayItemType =
    config.reportableItems[itemType]?.displayName ?? itemType;

  const handleSubmit = async () => {
    if (!reporterUserId || !reason || !comment.trim()) return;

    const reportId = crypto.randomUUID();

    try {
      await submitMutation.mutateAsync({
        reportId,
        reporterUserId,
        reporterUsername: reporterUsername ?? 'Anonymous',
        itemType,
        itemId,
        parentItemId,
        reportedUserId,
        reportedUsername,
        reason,
        comment,
      });

      onOpenChange(false);
      setReason('');
      setComment('');
      onSubmitSuccess?.();
    } catch (error) {
      onSubmitError?.(error instanceof Error ? error : new Error(String(error)));
    }
  };

  const handleOpenChangeInternal = (nextOpen: boolean) => {
    if (!nextOpen) {
      setReason('');
      setComment('');
    }
    onOpenChange(nextOpen);
  };

  const commentCharCount = comment.length;
  const isOverLimit = commentCharCount > maxLength;
  const canSubmit =
    !!reason &&
    !!comment.trim() &&
    !isOverLimit &&
    !submitMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={handleOpenChangeInternal}>
      <DialogContent className="sm:max-w-[425px] rc-dialog">
        <DialogHeader>
          <DialogTitle>Report Content</DialogTitle>
          <DialogDescription>
            You are reporting a:{' '}
            <span className="text-label">{displayItemType}</span>.
            Help us understand the issue.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Reason picker */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="rc-reason" className="text-right">
              Reason
            </Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger id="rc-reason" className="col-span-3">
                <SelectValue placeholder="Select a reason" />
              </SelectTrigger>
              <SelectContent>
                {config.reportReasons.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Comment */}
          <div className="grid grid-cols-4 items-start gap-4">
            <Label htmlFor="rc-comment" className="text-right pt-2">
              Comment
            </Label>
            <div className="col-span-3 relative">
              <Textarea
                ref={_commentRef}
                id="rc-comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Provide additional details"
                className="col-span-3 pr-12"
                maxLength={maxLength}
                rows={4}
              />
              <div
                className={`absolute bottom-2 right-2 text-xs font-semibold ${
                  isOverLimit ? 'text-destructive' : ''
                }`}
              >
                {commentCharCount}/{maxLength}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="default" className="touch-target h-11">
              Cancel
            </Button>
          </DialogClose>
          <Button
            variant="default"
            type="submit"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="touch-target h-11"
          >
            {submitMutation.isPending && (
              <Loader2 className="mr-2 spinner-xs" />
            )}
            Submit Report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
