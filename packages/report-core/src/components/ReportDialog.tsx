'use client';

import { useState } from 'react';
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
} from '@ttt-productions/ui-core/react';
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
  /** Current user ID. Required for submission. */
  reporterUserId?: string;
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
  reporterUserId,
  onSubmitSuccess,
  onSubmitError,
}: ReportDialogProps) {
  const { config, additionalReportActions } = useReportCoreContext();
  const submitMutation = useReportSubmit();
  const [reason, setReason] = useState('');
  const [comment, setComment] = useState('');
  const [actionPending, setActionPending] = useState(false);

  const maxLength = config.maxReportCommentLength;
  const displayItemType =
    config.reportableItems[itemType]?.displayName ?? itemType;

  // The picker value for a consumer-supplied additional action is its id, prefixed so it can never
  // collide with a real report reason.
  const ACTION_PREFIX = '__rc_action__:';
  const selectedAction = additionalReportActions.find((a) => `${ACTION_PREFIX}${a.id}` === reason);

  const handleSubmit = async () => {
    if (!reporterUserId || !reason || !comment.trim()) return;

    try {
      if (selectedAction) {
        // A consumer action (e.g. an admin "mark as NCII evidence") — call ITS handler, never submitReport.
        setActionPending(true);
        await selectedAction.handler({ itemType, itemId, parentItemId, reportedUserId }, comment);
      } else {
        // reporterUserId is NOT sent — the submitReport callable derives the reporter
        // from request.auth.uid; it is only used here to gate submission on being signed in.
        await submitMutation.mutateAsync({
          itemType,
          itemId,
          parentItemId,
          reportedUserId,
          reason,
          comment,
        });
      }

      onOpenChange(false);
      setReason('');
      setComment('');
      onSubmitSuccess?.();
    } catch (error) {
      onSubmitError?.(error instanceof Error ? error : new Error(String(error)));
    } finally {
      setActionPending(false);
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
    !submitMutation.isPending &&
    !actionPending;

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
                {additionalReportActions.map((a) => (
                  <SelectItem key={a.id} value={`${ACTION_PREFIX}${a.id}`}>
                    {a.label}
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
            {(submitMutation.isPending || actionPending) && (
              <Loader2 className="mr-2 spinner-xs" />
            )}
            {selectedAction ? selectedAction.label : 'Submit Report'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
