'use client';

import { useCallback, useId, useState } from 'react';
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
import { Loader2, Zap, Clock, RotateCcw } from 'lucide-react';

/**
 * The inline required-reason config. The caller OWNS the reason value/onChange (draft state lives at
 * the call site). Any `minLength`/`maxLength` the caller supplies MUST come from a caller-owned
 * constant — this component declares no business numbers and no copy; it only derives the gate + the
 * Textarea `maxLength` from the values it is handed.
 */
export interface ConsequenceDialogReason {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  placeholder?: string;
  label?: React.ReactNode;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}

/**
 * The exact-match typed-confirmation gate. `phrase` is business copy owned by the CALLER; the
 * component only compares the typed value against it.
 */
export interface ConsequenceDialogTypedConfirmation {
  phrase: string;
  label?: React.ReactNode;
}

export interface ConsequenceDialogProps {
  /** Uncontrolled open model: the element that opens the dialog (rendered `asChild`). */
  trigger?: React.ReactNode;
  /** Controlled open model. Provide with `onOpenChange`. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;

  /** Heading — a string or node so callers can interpolate amounts / names. */
  title: React.ReactNode;

  /** SLOT 1 — what happens right now (e.g. "initiates a Stripe refund of $X now"). */
  immediateEffect?: React.ReactNode;
  /** SLOT 2 — what settles later, out of band (webhook / worker / async confirmation). */
  delayedEffect?: React.ReactNode;
  /** SLOT 3 — whether/how this can be undone or superseded. */
  reversibility?: React.ReactNode;

  /** Inline required-reason field. Optional. */
  reason?: ConsequenceDialogReason;
  /** Exact-phrase typed-confirmation gate. Optional. */
  typedConfirmation?: ConsequenceDialogTypedConfirmation;

  confirmLabel: React.ReactNode;
  cancelLabel?: React.ReactNode;
  /** `true` styles the confirm button with `bg-destructive`. */
  destructive?: boolean;

  /**
   * Runs on confirm. May be async — while it is pending the dialog STAYS OPEN, both buttons disable,
   * and a `Loader2` spins in the confirm button. Closes on resolve. If it rejects the dialog
   * stays open so the caller's own surface (error toast, TOTP step-up) can show and the operator can
   * retry or cancel. This component takes no Sentry/monitoring dependency — every error path
   * belongs to the caller's `onConfirm`.
   */
  onConfirm: () => void | Promise<void>;
}

const SLOT_ICON_CLASS = 'icon-xs mt-0.5 shrink-0 text-muted-foreground';

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
    <span className="flex items-start gap-2">
      <Icon className={SLOT_ICON_CLASS} aria-hidden="true" />
      <span className="stack-1 min-w-0">
        <span className="text-caption font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <span className="text-small text-foreground">{children}</span>
      </span>
    </span>
  );
}

/**
 * A reusable confirm-before-a-consequential-action dialog. Three optional, consistently-styled
 * consequence slots (immediate / afterward / reversibility), an optional inline required-reason field,
 * and an optional exact-phrase typed-confirmation gate. Composes the ui-core AlertDialog primitives
 * (Radix) — it never re-implements them. Supports BOTH a `trigger` (uncontrolled) and `open` /
 * `onOpenChange` (controlled).
 *
 * Pending model: the confirm button is a plain `Button` (NOT `AlertDialogAction`), so Radix does not
 * auto-close on click; open state is managed here so the dialog stays open with a visible spinner
 * until `onConfirm` resolves.
 */
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
  onConfirm,
}: ConsequenceDialogProps) {
  const isControlled = open !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const [typedValue, setTypedValue] = useState('');
  const [pending, setPending] = useState(false);

  const actualOpen = isControlled ? open : internalOpen;

  const reasonId = useId();
  const typedId = useId();

  const setOpenState = useCallback(
    (next: boolean) => {
      if (isControlled) onOpenChange?.(next);
      else setInternalOpen(next);
    },
    [isControlled, onOpenChange],
  );

  // Never allow an open-state change (Escape, cancel, controlled parent) to fight the pending action.
  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (pending) return;
      setTypedValue(''); // reset the typed gate on every open/close
      setOpenState(next);
    },
    [pending, setOpenState],
  );

  const handleConfirm = useCallback(async () => {
    if (pending) return;
    setPending(true);
    try {
      await onConfirm();
      setTypedValue('');
      setOpenState(false);
    } catch {
      // Keep the dialog open — the caller's onConfirm surfaced the error (toast / step-up). The
      // operator can retry or cancel. Never rethrow, never monitor here.
    } finally {
      setPending(false);
    }
  }, [pending, onConfirm, setOpenState]);

  const reasonTrimmedLength = reason ? reason.value.trim().length : 0;
  const reasonProvided = reasonTrimmedLength > 0;
  const reasonOk = !reason
    ? true
    : reason.required && !reasonProvided
      ? false
      : !reasonProvided
        ? true // optional + empty is fine
        : (reason.minLength === undefined || reasonTrimmedLength >= reason.minLength) &&
          (reason.maxLength === undefined || reason.value.length <= reason.maxLength);

  const typedOk = !typedConfirmation ? true : typedValue === typedConfirmation.phrase;
  const confirmDisabled = pending || !reasonOk || !typedOk;

  return (
    <AlertDialog open={actualOpen} onOpenChange={handleOpenChange}>
      {trigger ? <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger> : null}
      <AlertDialogContent
        onEscapeKeyDown={(e) => {
          if (pending) e.preventDefault();
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <span className="stack-3">
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
            </span>
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
              maxLength={reason.maxLength}
              rows={reason.rows ?? 3}
              disabled={pending}
            />
          </div>
        ) : null}

        {typedConfirmation ? (
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
              disabled={pending}
              autoComplete="off"
            />
          </div>
        ) : null}

        <AlertDialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={pending}
          >
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? 'destructive' : 'default'}
            onClick={handleConfirm}
            disabled={confirmDisabled}
            aria-busy={pending}
          >
            {pending ? <Loader2 className="mr-2 spinner-xs" aria-hidden="true" /> : null}
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
