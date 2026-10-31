'use client';

import { useCallback, useId, useMemo, useState } from 'react';
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
} from './alert-dialog.js';
import { Button } from './button.js';
import { Textarea } from './textarea.js';
import { Input } from './input.js';
import { Label } from './label.js';
import {
  checkInputFormat,
  defineInputFormat,
  type DeclaredInputFormat,
} from '@ttt-productions/input-format-core';
import { Zap, Clock, RotateCcw } from 'lucide-react';

export interface ConsequenceDialogReason {
  inputFormat: DeclaredInputFormat;
  placeholder?: string;
  label?: React.ReactNode;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  hint?: (id: string) => React.ReactNode;
}

export interface ConsequenceDialogTypedConfirmation {
  phrase: string;
  label?: React.ReactNode;
}

export interface ConsequenceDialogProps {
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;

  title: React.ReactNode;

  immediateEffect?: React.ReactNode;
  delayedEffect?: React.ReactNode;
  reversibility?: React.ReactNode;

  reason?: ConsequenceDialogReason;
  typedConfirmation?: ConsequenceDialogTypedConfirmation;

  confirmLabel: React.ReactNode;
  cancelLabel?: React.ReactNode;
  destructive?: boolean;
  confirmHeld?: React.ReactNode;

  onConfirm: () => void | Promise<void>;

  onCloseAutoFocus?: (event: Event) => void;
}

const SLOT_ICON_CLASS = 'icon-xs mt-0.5 shrink-0 text-muted-foreground';

/** Every element is a block: the `stack-*` spacing is a vertical margin, which an inline element ignores. */
function ConsequenceRow({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Zap;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className={SLOT_ICON_CLASS} aria-hidden="true" />
      <div className="stack-1 min-w-0">
        <div className="text-caption font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        <div className="text-small text-foreground">{children}</div>
      </div>
    </div>
  );
}

/** The confirm is a plain `Button`, not `AlertDialogAction`, so Radix does not close the dialog on click. */
export function ConsequenceDialog({
  trigger,
  open,
  onOpenChange,
  title,
  immediateEffect,
  delayedEffect,
  reversibility,
  reason,
  typedConfirmation,
  confirmLabel,
  cancelLabel = 'Cancel',
  destructive = false,
  confirmHeld,
  onConfirm,
  onCloseAutoFocus,
}: ConsequenceDialogProps) {
  const isControlled = open !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const [typedValue, setTypedValue] = useState('');
  const [pending, setPending] = useState(false);

  const actualOpen = isControlled ? open : internalOpen;

  const reasonId = useId();
  const reasonHintId = useId();
  const typedId = useId();
  const heldId = useId();
  const held = confirmHeld !== undefined && confirmHeld !== null && confirmHeld !== false;

  const setOpenState = useCallback(
    (next: boolean) => {
      if (isControlled) onOpenChange?.(next);
      else setInternalOpen(next);
    },
    [isControlled, onOpenChange],
  );

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (pending) return;
      setTypedValue('');
      setOpenState(next);
    },
    [pending, setOpenState],
  );

  const handleConfirm = useCallback(async () => {
    if (pending || held) return;
    setPending(true);
    try {
      await onConfirm();
      setTypedValue('');
      setOpenState(false);
    } catch {
      // The caller's onConfirm owns its failure's surface; a rejection only keeps the dialog open.
    } finally {
      setPending(false);
    }
  }, [pending, held, onConfirm, setOpenState]);

  const reasonOk = !reason || checkInputFormat(reason.value, reason.inputFormat).ok;

  const typedOk = !typedConfirmation ? true : typedValue === typedConfirmation.phrase;
  const phrase = typedConfirmation?.phrase ?? '';
  const typedFormat = useMemo(
    () =>
      phrase.length > 0
        ? defineInputFormat({ format: 'singleLine', min: 1, max: phrase.length })
        : null,
    [phrase],
  );

  return (
    <AlertDialog open={actualOpen} onOpenChange={handleOpenChange}>
      {trigger ? <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger> : null}
      <AlertDialogContent
        onEscapeKeyDown={(e) => {
          if (pending) e.preventDefault();
        }}
        onCloseAutoFocus={onCloseAutoFocus}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {/* A div, not the primitive's default <p>: the rows are blocks, which a <p> cannot hold. */}
          <AlertDialogDescription asChild>
            <div className="stack-3 text-left">
              {immediateEffect ? (
                <ConsequenceRow icon={Zap} label="Immediately">
                  {immediateEffect}
                </ConsequenceRow>
              ) : null}
              {delayedEffect ? (
                <ConsequenceRow icon={Clock} label="Afterward">
                  {delayedEffect}
                </ConsequenceRow>
              ) : null}
              {reversibility ? (
                <ConsequenceRow icon={RotateCcw} label="Reversibility">
                  {reversibility}
                </ConsequenceRow>
              ) : null}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        {reason ? (
          <div className="stack-2">
            <Label htmlFor={reasonId}>{reason.label ?? 'Reason'}</Label>
            <Textarea
              id={reasonId}
              value={reason.value}
              onChange={(e) => reason.onChange(e.target.value)}
              placeholder={reason.placeholder}
              inputFormat={reason.inputFormat}
              rows={reason.rows ?? 3}
              disabled={pending}
              aria-describedby={reason.hint ? reasonHintId : undefined}
            />
            {reason.hint ? reason.hint(reasonHintId) : null}
          </div>
        ) : null}

        {typedConfirmation && typedFormat ? (
          <div className="stack-2">
            <Label htmlFor={typedId}>
              {typedConfirmation.label ?? (
                <>
                  Type <span className="font-mono">{typedConfirmation.phrase}</span> to confirm
                </>
              )}
            </Label>
            <Input
              id={typedId}
              value={typedValue}
              onChange={(e) => setTypedValue(e.target.value)}
              placeholder={typedConfirmation.phrase}
              inputFormat={typedFormat}
              disabled={pending}
              autoComplete="off"
            />
          </div>
        ) : null}

        {held ? (
          <div id={heldId} role="status" className="text-small text-muted-foreground">
            {confirmHeld}
          </div>
        ) : null}

        <AlertDialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={pending}>
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? 'destructive' : 'default'}
            onClick={handleConfirm}
            disabled={!reasonOk || !typedOk || held}
            aria-describedby={held ? heldId : undefined}
            pending={pending}
          >
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
