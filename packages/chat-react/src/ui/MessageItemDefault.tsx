'use client';

import type { ReactNode } from 'react';
import type { ChatMessageV1, ModerationHandlers } from '@ttt-productions/chat-core';
import { MessageText } from './MessageText.js';
import { cn } from '@ttt-productions/ui-core';
import { Button, Spinner } from '@ttt-productions/ui-core/react';
import { AlertTriangle } from 'lucide-react';
import { MessageActions } from './menus.js';
import { SenderName } from './SenderName.js';
import { useSenderNameResolution } from '../context/ChatNameResolverContext.js';

const SEND_FAILURE_COPY: Record<string, string> = {
  'blocked-word': 'Message contains blocked language',
  archived: 'This channel is read-only',
  deleted: 'This channel is read-only',
  'membership-pending': 'Chat is still preparing',
  'wordlist-unavailable': 'Chat safety check is temporarily unavailable',
  flood: 'Please wait before sending again',
  'slow-mode': 'Please wait before sending again',
};

function sendFailureCopy(code: string | null): string {
  return (code && SEND_FAILURE_COPY[code]) || "Couldn't send";
}

function isRetryableFailure(meta: Record<string, unknown> | undefined): boolean {
  return meta?.sendRetryable !== false;
}

function SystemMessage({ m }: { m: ChatMessageV1 }) {
  return (
    <div className="chat-system-message">
      {m.text && <span>{m.text}</span>}
      <span className="chat-system-message-time">
        {new Date(m.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
      </span>
    </div>
  );
}

export type MessageItemDefaultProps = {
  m: ChatMessageV1;
  currentUserId: string;
  handlers?: ModerationHandlers;

  isContinuation?: boolean;

  onSenderClick?: (senderId: string) => void;
  senderAdornment?: ReactNode;

  onRetrySend?: (clientMessageId: string) => void;
};

export function MessageItemDefault(props: MessageItemDefaultProps) {
  const {
    m,
    currentUserId,
    handlers,
    isContinuation,
    onSenderClick: senderClick,
    senderAdornment,
    onRetrySend,
  } = props;
  const nameResolved = useSenderNameResolution(m.senderId).status === 'resolved';
  const onSenderClick = nameResolved ? senderClick : undefined;

  if (m.isSystemMessage) {
    return <SystemMessage m={m} />;
  }

  const mine = m.senderId === currentUserId;

  const sendFailed = m.meta?.sendFailed === true;
  const sendPending = m.meta?.optimistic === true && !sendFailed;
  const clientMessageId =
    typeof m.meta?.clientMessageId === 'string' ? m.meta.clientMessageId : null;
  const sendFailureCode =
    typeof m.meta?.sendFailureCode === 'string' ? m.meta.sendFailureCode : null;
  const showRetry = sendFailed && isRetryableFailure(m.meta);

  return (
    <div
      className={cn(
        'flex flex-col w-fit max-w-[85%]',
        mine ? 'ml-auto items-end' : 'mr-auto items-start',
        isContinuation ? 'chat-continuation-gap' : 'chat-group-gap',
      )}
    >
      <div
        className={cn(
          'chat-bubble',
          mine ? 'chat-bubble--mine' : 'chat-bubble--theirs',
          sendPending && 'chat-bubble--pending',
          sendFailed && 'chat-bubble--failed',
        )}
      >
        {!isContinuation && (
          <div className="flex items-center gap-2 text-xs opacity-80 mb-1">
            <span
              className={cn('font-medium', onSenderClick && 'cursor-pointer hover:underline')}
              onClick={onSenderClick ? () => onSenderClick(m.senderId) : undefined}
              role={onSenderClick ? 'button' : undefined}
              tabIndex={onSenderClick ? 0 : undefined}
              onKeyDown={
                onSenderClick
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') onSenderClick(m.senderId);
                    }
                  : undefined
              }
            >
              <SenderName senderId={m.senderId} />
            </span>
            {senderAdornment}
            <span>·</span>
            <span>
              {new Date(m.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
            </span>
          </div>
        )}

        {m.text && (
          <p className="text-sm whitespace-pre-wrap">
            <MessageText text={m.text} />
          </p>
        )}
      </div>

      {sendPending && (
        <div className="chat-send-status mt-0.5" role="status" aria-live="polite">
          <Spinner size="xs" className="shrink-0" />
          <span>Sending…</span>
        </div>
      )}
      {sendFailed && (
        <div className="chat-send-status chat-send-status--failed mt-0.5" role="alert">
          <AlertTriangle className="h-3 w-3 shrink-0" />
          <span>{sendFailureCopy(sendFailureCode)}</span>
          {showRetry && onRetrySend && clientMessageId && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-5 px-1.5 text-[0.6875rem]"
              onClick={() => onRetrySend(clientMessageId)}
            >
              Retry
            </Button>
          )}
        </div>
      )}

      {!isContinuation && (
        <div className="mt-1">
          <MessageActions messageId={m.messageId} handlers={handlers} />
        </div>
      )}
    </div>
  );
}
