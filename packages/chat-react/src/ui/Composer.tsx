'use client';

import * as React from 'react';
import { Button, Textarea } from '@ttt-productions/ui-core/react';
import { cn } from '@ttt-productions/ui-core';
import { useOptionalLocalUploadGuard } from '@ttt-productions/upload-ui/react/guard';
import {
  CHAT_MESSAGE_TEXT_INPUT,
  CHAT_MESSAGE_TEXT_MAX_LENGTH,
  judgeChatMessageText,
} from '@ttt-productions/chat-schemas';

function genId(): string {
  return `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

export type ComposerProps = {
  onSend: (text: string) => Promise<void>;

  onTyping?: () => void;

  disabled?: boolean;
  autoFocus?: boolean;
  placeholder?: string;
};

export function Composer(props: ComposerProps) {
  const {
    onSend,
    onTyping,
    disabled,
    autoFocus = false,
    placeholder = 'Type a message...',
  } = props;

  const [text, setText] = React.useState('');
  const [isSending, setIsSending] = React.useState(false);
  const [sendError, setSendError] = React.useState<string | null>(null);
  const ref = React.useRef<HTMLTextAreaElement>(null);
  const navigationGuard = useOptionalLocalUploadGuard();
  const counterId = React.useId();

  React.useEffect(() => {
    if (!autoFocus) return;
    ref.current?.focus();
  }, [autoFocus]);

  const judged = judgeChatMessageText(text);

  const send = async () => {
    if (!judged.ok) return;

    setIsSending(true);
    setSendError(null);
    const sendGuardId = `chat-send-${genId()}`;
    navigationGuard?.registerUpload(sendGuardId);

    try {
      await onSend(judged.text);
      setText('');
    } catch (err) {
      console.error('[Composer] Send failed:', err);
      setSendError("Couldn't send. Check your connection and try again.");
    } finally {
      navigationGuard?.unregisterUpload(sendGuardId);
      setIsSending(false);
    }
  };

  const isDisabled = disabled || isSending;

  return (
    <div className="chat-composer">
      {sendError && (
        <div className="px-1 pb-1 text-sm text-destructive" role="alert">
          {sendError}
        </div>
      )}

      <div className="flex items-end gap-2">
        <Textarea
          ref={ref}
          value={text}
          inputFormat={CHAT_MESSAGE_TEXT_INPUT}
          aria-describedby={text.length > 0 ? counterId : undefined}
          onChange={(e) => {
            setText(e.target.value);
            if (sendError) setSendError(null);
            if (onTyping && e.target.value.trim().length > 0) onTyping();
          }}
          placeholder={placeholder}
          disabled={isDisabled}
          rows={1}
          className={cn('min-h-[40px] resize-none')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        <Button
          type="button"
          variant="default"
          disabled={isDisabled || !judged.ok}
          pending={isSending}
          onClick={send}
        >
          Send
        </Button>
      </div>
      {text.length > 0 && (
        <div id={counterId} className="px-1 pt-1 text-xs text-right text-muted-foreground">
          {text.length}/{CHAT_MESSAGE_TEXT_MAX_LENGTH}
        </div>
      )}
    </div>
  );
}
