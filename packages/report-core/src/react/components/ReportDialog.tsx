'use client';

import { useId, useState } from 'react';
import {
  Button,
  ConsequenceDialog,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Label,
  Textarea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  useAsyncAction,
} from '@ttt-productions/ui-core/react';
import { checkInputFormat } from '@ttt-productions/input-format-core';
import { useReportCoreContext } from '../context/ReportCoreProvider.js';
import { useReportSubmit } from '../hooks/useReportSubmit.js';
import type { SubmitReportResult } from '../../schemas/requests.js';
import type { ReportDialogProps, ReportTargetRef } from '../types-ui-props.js';

const ACTION_PREFIX = '__rc_action__:';

type DialogView =
  { kind: 'form' } | { kind: 'upgrade'; reason: string } | { kind: 'alreadyReported' };

interface DialogDraft {
  reporterUserId: string | undefined;
  reason: string;
  comment: string;
  view: DialogView;
}

function emptyDraft(reporterUserId: string | undefined): DialogDraft {
  return { reporterUserId, reason: '', comment: '', view: { kind: 'form' } };
}

export function ReportDialog({
  open,
  onOpenChange,
  itemType,
  itemId,
  parentItemId,
  reportedUserId,
  reporterUserId,
  copy,
  onSubmitSuccess,
  onSubmitError,
}: ReportDialogProps) {
  const { config, additionalReportActions } = useReportCoreContext();
  const submitMutation = useReportSubmit();
  const fieldId = useId();

  const [storedDraft, setStoredDraft] = useState<DialogDraft>(() => emptyDraft(reporterUserId));
  const draft =
    storedDraft.reporterUserId === reporterUserId ? storedDraft : emptyDraft(reporterUserId);
  const updateDraft = (patch: Partial<Omit<DialogDraft, 'reporterUserId'>>) =>
    setStoredDraft((prev) => ({
      ...(prev.reporterUserId === reporterUserId ? prev : emptyDraft(reporterUserId)),
      ...patch,
    }));

  const target: ReportTargetRef = { itemType, itemId, parentItemId, reportedUserId };
  const itemTypeLabel = config.reportableItems[itemType]?.displayName ?? itemType;
  const commentInput = config.reportCommentInput;
  const selectedAction = additionalReportActions.find(
    (a) => `${ACTION_PREFIX}${a.id}` === draft.reason,
  );
  const isHandOff = selectedAction?.kind === 'handOff';

  const closeAndReset = () => {
    onOpenChange(false);
    setStoredDraft(emptyDraft(reporterUserId));
  };

  const applyOutcome = (result: SubmitReportResult) => {
    switch (result.outcome) {
      case 'filed':
      case 'upgraded':
        closeAndReset();
        onSubmitSuccess(result);
        return;
      case 'alreadyReported':
        updateDraft({ view: { kind: 'alreadyReported' } });
        return;
      case 'upgradeAvailable':
        updateDraft({ view: { kind: 'upgrade', reason: result.reason } });
        return;
      default: {
        const unhandled: never = result;
        throw new Error(`Unhandled report outcome: ${JSON.stringify(unhandled)}`);
      }
    }
  };

  const commentLength = draft.comment.length;
  const checkedComment = checkInputFormat(draft.comment, commentInput);
  const isOverLimit = !checkedComment.ok && checkedComment.issue === 'tooLong';
  const commentOk = isHandOff || checkedComment.ok;
  const canSubmit = !!reporterUserId && !!draft.reason && commentOk;

  const submit = useAsyncAction(
    async () => {
      if (!canSubmit) return;
      if (selectedAction?.kind === 'handOff') {
        await selectedAction.handler(target);
        closeAndReset();
        return;
      }
      if (selectedAction) {
        await selectedAction.handler(target, checkedComment.value);
        closeAndReset();
        onSubmitSuccess({ outcome: 'actionCompleted', actionId: selectedAction.id });
        return;
      }
      applyOutcome(
        await submitMutation.mutateAsync({
          ...target,
          reason: draft.reason,
          comment: checkedComment.value,
        }),
      );
    },
    { onError: onSubmitError },
  );

  const upgrade = useAsyncAction(
    async () => {
      if (!reporterUserId || draft.view.kind !== 'upgrade') return;
      applyOutcome(
        await submitMutation.mutateAsync({
          ...target,
          reason: draft.view.reason,
          comment: checkedComment.value,
          confirmUpgrade: true,
        }),
      );
    },
    { onError: onSubmitError },
  );

  const isPending = submit.pending || upgrade.pending;

  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const hasUnsentComment = draft.comment.trim().length > 0 && draft.view.kind !== 'alreadyReported';

  const discardAndClose = () => {
    setConfirmingDiscard(false);
    closeAndReset();
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && isPending) return;
    if (!nextOpen && hasUnsentComment) {
      setConfirmingDiscard(true);
      return;
    }
    if (!nextOpen) setStoredDraft(emptyDraft(reporterUserId));
    onOpenChange(nextOpen);
  };

  const reasonId = `${fieldId}-reason`;
  const commentId = `${fieldId}-comment`;
  const counterId = `${fieldId}-comment-count`;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px] rc-dialog">
        {draft.view.kind === 'form' && (
          <>
            <DialogHeader>
              <DialogTitle>{copy.formTitle}</DialogTitle>
              <DialogDescription>{copy.formDescription(itemTypeLabel)}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor={reasonId} className="text-right">
                  {copy.reasonLabel}
                </Label>
                <Select value={draft.reason} onValueChange={(reason) => updateDraft({ reason })}>
                  <SelectTrigger id={reasonId} className="col-span-3">
                    <SelectValue placeholder={copy.reasonPlaceholder} />
                  </SelectTrigger>
                  <SelectContent>
                    {config.reportReasons.map((reason) => (
                      <SelectItem key={reason} value={reason}>
                        {reason}
                      </SelectItem>
                    ))}
                    {additionalReportActions.map((action) => (
                      <SelectItem key={action.id} value={`${ACTION_PREFIX}${action.id}`}>
                        {action.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {!isHandOff && (
                <div className="grid grid-cols-4 items-start gap-4">
                  <Label htmlFor={commentId} className="text-right pt-2">
                    {copy.commentLabel}
                  </Label>
                  <div className="col-span-3 relative">
                    <Textarea
                      id={commentId}
                      value={draft.comment}
                      onChange={(event) => updateDraft({ comment: event.target.value })}
                      placeholder={copy.commentPlaceholder}
                      aria-describedby={counterId}
                      className="col-span-3 pr-12"
                      inputFormat={commentInput}
                      rows={4}
                    />
                    <div
                      id={counterId}
                      className={`absolute bottom-2 right-2 text-xs font-semibold ${isOverLimit ? 'text-destructive' : ''}`}
                    >
                      {commentLength}/{commentInput.max}
                    </div>
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="default"
                onClick={() => handleOpenChange(false)}
                disabled={isPending}
                className="touch-target h-11"
              >
                {copy.cancelLabel}
              </Button>
              <Button
                type="button"
                variant="default"
                onClick={() => void submit.run()}
                disabled={!canSubmit}
                pending={submit.pending}
                className="touch-target h-11"
              >
                {selectedAction ? selectedAction.label : copy.submitLabel}
              </Button>
            </DialogFooter>
          </>
        )}

        {draft.view.kind === 'upgrade' && (
          <>
            <DialogHeader>
              <DialogTitle>{copy.upgradeTitle}</DialogTitle>
              <DialogDescription>
                {copy.upgradeDescription({ itemTypeLabel, reason: draft.view.reason })}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                type="button"
                variant="default"
                onClick={() => updateDraft({ view: { kind: 'form' } })}
                disabled={isPending}
                className="touch-target h-11"
              >
                {copy.upgradeBackLabel}
              </Button>
              <Button
                type="button"
                variant="default"
                onClick={() => void upgrade.run()}
                pending={upgrade.pending}
                className="touch-target h-11"
              >
                {copy.upgradeConfirmLabel}
              </Button>
            </DialogFooter>
          </>
        )}

        <ConsequenceDialog
          open={open && confirmingDiscard}
          onOpenChange={setConfirmingDiscard}
          title={copy.discardTitle}
          immediateEffect={copy.discardDescription}
          confirmLabel={copy.discardConfirmLabel}
          cancelLabel={copy.discardKeepLabel}
          destructive
          onConfirm={discardAndClose}
        />

        {draft.view.kind === 'alreadyReported' && (
          <>
            <DialogHeader>
              <DialogTitle>{copy.alreadyReportedTitle}</DialogTitle>
              <DialogDescription>{copy.alreadyReportedDescription}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                type="button"
                variant="default"
                onClick={closeAndReset}
                className="touch-target h-11"
              >
                {copy.alreadyReportedCloseLabel}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
