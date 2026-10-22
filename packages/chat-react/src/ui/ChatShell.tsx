'use client';

import * as React from 'react';
import type {
  ChatMessageGroupKey,
  ChatMessageV1,
  ModerationHandlers,
} from '@ttt-productions/chat-core';
import type { ChatCoreConfig, MessageRendererRegistry } from '../types.js';
import {
  Card,
  CardHeader,
  CardContent,
  CardFooter,
  Skeleton,
  Spinner,
} from '@ttt-productions/ui-core/react';
import { KeyboardAvoidingView } from '@ttt-productions/mobile-core/react';
import { useChatMessages } from '../hooks/useChatMessages.js';
import { useRealtimeChatMessages } from '../realtime/useRealtimeChatMessages.js';
import type { RealtimeChatClient } from '../realtime/transport.js';
import { MessageList, type ChatScrollContainerProps } from './MessageList.js';
import { Composer } from './Composer.js';
import { ThreadActions } from './menus.js';

export type ChatLoadFailure = {
  scope: 'initial' | 'live' | 'older';
  error: Error | null;
  retry: () => void;
  retrying: boolean;
};

export type ChatShellProps = {
  config: ChatCoreConfig;

  renderLoadError: (failure: ChatLoadFailure) => React.ReactNode;

  header?: React.ReactNode;

  onSend?: (text: string) => Promise<void>;

  renderMessage?: (m: any) => React.ReactNode;
  messageRenderers?: MessageRendererRegistry;
  handlers?: ModerationHandlers;

  composerPlaceholder?: string;
  autoFocus?: boolean;

  renderAboveMessages?: () => React.ReactNode;
  renderBelowMessages?: () => React.ReactNode;
  renderFooter?: () => React.ReactNode;

  onSenderClick?: (senderId: string) => void;
  messageGroupKey?: ChatMessageGroupKey;
  renderSenderAdornment?: (m: ChatMessageV1) => React.ReactNode;

  composerDisabled?: boolean;

  fillHeight?: boolean;
  onReadinessChange?: (ready: boolean) => void;
  scrollClassName?: string;
  scrollContainer?: React.ComponentType<ChatScrollContainerProps>;
};

type ResolvedChat = {
  allowed: boolean;
  isInitialLoading: boolean;
  transportCurrent: boolean;
  messages: ChatMessageV1[];
  fetchOlder: () => Promise<void>;
  hasOlder: boolean;
  isFetchingOlder: boolean;
  loadFailure: ChatLoadFailure | null;
  olderFailure: ChatLoadFailure | null;
  send: (text: string) => Promise<void>;
  retrySend?: (clientMessageId: string) => void;
  readAck?: (latestSeq: number, focused: boolean) => boolean;
  status?: string;
  typing?: string[];
  signalTyping?: () => void;
};

// Hooks must be unconditional, so each transport is a separate component with one data hook.
export function ChatShell(props: ChatShellProps) {
  if (props.config.transport === 'realtime') {
    return <RealtimeChatShell {...props} />;
  }
  return <FirestoreChatShell {...props} />;
}

function FirestoreChatShell(props: ChatShellProps) {
  const { config, onSend } = props;
  const r = useChatMessages(config);
  const send = React.useCallback(
    async (text: string) => {
      if (onSend) await onSend(text);
    },
    [onSend],
  );
  const { error, olderError, retry, messages, isFetchingOlder } = r;
  const loadFailure = React.useMemo<ChatLoadFailure | null>(
    () =>
      error
        ? { scope: messages.length > 0 ? 'live' : 'initial', error, retry, retrying: false }
        : null,
    [error, messages.length, retry],
  );
  const olderFailure = React.useMemo<ChatLoadFailure | null>(
    () =>
      olderError ? { scope: 'older', error: olderError, retry, retrying: isFetchingOlder } : null,
    [olderError, retry, isFetchingOlder],
  );
  return (
    <ChatShellView
      {...props}
      resolved={{
        allowed: r.allowed,
        isInitialLoading: r.isInitialLoading,
        transportCurrent: true,
        messages: r.messages,
        fetchOlder: r.fetchOlder,
        hasOlder: r.hasOlder,
        isFetchingOlder: r.isFetchingOlder,
        loadFailure,
        olderFailure,
        send,
      }}
    />
  );
}

function RealtimeChatShell(props: ChatShellProps) {
  const { config, onSend } = props;
  const client = config.realtime?.client as RealtimeChatClient | undefined;
  if (!client) {
    throw new Error(
      "[ChatShell] transport 'realtime' requires config.realtime.client (createRealtimeChatClient(...))",
    );
  }
  const r = useRealtimeChatMessages(client);
  const { initialLoadFailed, retry } = r;
  const loadFailure = React.useMemo<ChatLoadFailure | null>(
    () => (initialLoadFailed ? { scope: 'initial', error: null, retry, retrying: false } : null),
    [initialLoadFailed, retry],
  );
  const send = React.useCallback(
    async (text: string) => {
      const ok = r.send(text);
      if (!ok) throw new Error('chat-send-failed');
      if (onSend) await onSend(text);
    },
    [r, onSend],
  );
  return (
    <ChatShellView
      {...props}
      resolved={{
        allowed: config.allowed && r.allowed,
        isInitialLoading: r.isInitialLoading,
        transportCurrent: r.isSynced,
        messages: r.messages,
        fetchOlder: r.fetchOlder,
        hasOlder: r.hasOlder,
        isFetchingOlder: r.isFetchingOlder,
        loadFailure,
        olderFailure: null,
        send,
        retrySend: r.retrySend,
        readAck: r.readAck,
        status: r.status,
        typing: r.typing,
        signalTyping: r.signalTyping,
      }}
    />
  );
}

function ChatShellView(props: ChatShellProps & { resolved: ResolvedChat }) {
  const {
    config,
    header,
    renderMessage,
    messageRenderers,
    handlers,
    composerPlaceholder,
    autoFocus = false,
    renderAboveMessages,
    renderBelowMessages,
    renderFooter,
    onSenderClick,
    messageGroupKey,
    renderSenderAdornment,
    composerDisabled,
    fillHeight = false,
    scrollClassName,
    scrollContainer,
    renderLoadError,
    onReadinessChange,
    resolved,
  } = props;

  const {
    allowed,
    isInitialLoading,
    messages,
    fetchOlder,
    hasOlder,
    isFetchingOlder,
    loadFailure,
    olderFailure,
    send,
    retrySend,
    readAck,
    status,
    typing,
    signalTyping,
  } = resolved;
  const initialFailure = loadFailure?.scope === 'initial' ? loadFailure : null;

  const ready = allowed && !isInitialLoading && loadFailure === null && resolved.transportCurrent;
  const readinessListener = React.useRef(onReadinessChange);
  React.useEffect(() => {
    readinessListener.current = onReadinessChange;
  });
  React.useEffect(() => {
    readinessListener.current?.(ready);
  }, [ready]);
  React.useEffect(() => () => readinessListener.current?.(false), []);

  const [showScrollToBottom, setShowScrollToBottom] = React.useState(false);
  const [atBottom, setAtBottom] = React.useState(true);
  const [focused, setFocused] = React.useState(true);
  const lastAckedRef = React.useRef(0);
  const leaseHeldRef = React.useRef(false);

  const latestSeq = React.useMemo(() => {
    let max = 0;
    for (const m of messages) {
      const seq = typeof m.meta?.seq === 'number' ? (m.meta?.seq as number) : 0;
      if (seq > max) max = seq;
    }
    return max;
  }, [messages]);

  React.useEffect(() => {
    const compute = () =>
      typeof document === 'undefined' ||
      (document.visibilityState !== 'hidden' &&
        (typeof document.hasFocus !== 'function' || document.hasFocus()));
    setFocused(compute());
    const onChange = () => setFocused(compute());
    window.addEventListener('focus', onChange);
    window.addEventListener('blur', onChange);
    document.addEventListener('visibilitychange', onChange);
    return () => {
      window.removeEventListener('focus', onChange);
      window.removeEventListener('blur', onChange);
      document.removeEventListener('visibilitychange', onChange);
    };
  }, []);

  React.useEffect(() => {
    if (!readAck || latestSeq <= 0) return;
    if (focused && atBottom) {
      leaseHeldRef.current = true;
      if (latestSeq > lastAckedRef.current) {
        if (readAck(latestSeq, true)) lastAckedRef.current = latestSeq;
      }
    } else if (leaseHeldRef.current) {
      leaseHeldRef.current = false;
      readAck(latestSeq, false);
    }
  }, [readAck, latestSeq, atBottom, focused]);

  const cardClassName = fillHeight ? 'w-full flex flex-col h-full min-h-0' : 'w-full';
  const contentClassName = fillHeight ? 'p-0 flex-1 min-h-0 flex flex-col' : 'p-0';

  if (!allowed) {
    return <div className="p-4 text-sm opacity-70">You don&apos;t have access to this thread.</div>;
  }

  if (isInitialLoading || initialFailure) {
    return (
      <Card className={cardClassName}>
        {(header || handlers) && (
          <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
            <div>{header}</div>
            <div className="flex flex-col items-end gap-2">
              <ThreadActions
                threadId={config.threadId}
                isAdmin={config.isAdmin}
                handlers={handlers}
              />
            </div>
          </CardHeader>
        )}
        {(() => {
          const aboveMessages = renderAboveMessages?.() ?? null;
          return aboveMessages != null && aboveMessages !== false ? (
            <div className="border-b">{aboveMessages}</div>
          ) : null;
        })()}
        <CardContent className={contentClassName}>
          {initialFailure ? (
            renderLoadError(initialFailure)
          ) : (
            <div
              className="flex flex-col items-center justify-center gap-2 py-12 text-sm text-muted-foreground"
              role="status"
              aria-live="polite"
            >
              <Spinner size="sm" />
              <span>Opening chat…</span>
            </div>
          )}
        </CardContent>
        {renderBelowMessages && <div className="border-t">{renderBelowMessages()}</div>}
        {renderFooter ? (
          <CardFooter className="border-t">{renderFooter()}</CardFooter>
        ) : (
          <CardFooter className="border-t">
            <Skeleton className="h-10 w-full" />
          </CardFooter>
        )}
      </Card>
    );
  }

  return (
    <Card className={cardClassName}>
      {(header || handlers) && (
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div>{header}</div>
          <div className="flex flex-col items-end gap-2">
            <ThreadActions
              threadId={config.threadId}
              isAdmin={config.isAdmin}
              handlers={handlers}
            />
          </div>
        </CardHeader>
      )}

      <ChatConnectionBanner status={status} />

      {renderAboveMessages && <div className="border-b">{renderAboveMessages()}</div>}

      {loadFailure?.scope === 'live' && (
        <div className="border-b">{renderLoadError(loadFailure)}</div>
      )}

      <CardContent className={contentClassName}>
        <MessageList
          messages={messages}
          currentUserId={config.currentUserId}
          isAdmin={config.isAdmin}
          isFetchingOlder={isFetchingOlder}
          hasOlder={hasOlder}
          onLoadOlder={() => fetchOlder()}
          renderMessage={renderMessage}
          messageRenderers={messageRenderers}
          showScrollToBottom={showScrollToBottom}
          onScrollToBottom={() => setShowScrollToBottom(false)}
          onAtBottomChange={setAtBottom}
          fillHeight={fillHeight}
          scrollClassName={scrollClassName}
          scrollContainer={scrollContainer}
          handlers={handlers}
          onSenderClick={onSenderClick}
          messageGroupKey={messageGroupKey}
          renderSenderAdornment={renderSenderAdornment}
          onRetrySend={retrySend}
          olderLoadErrorRow={olderFailure ? renderLoadError(olderFailure) : null}
        />
      </CardContent>

      {renderBelowMessages && <div className="border-t">{renderBelowMessages()}</div>}

      {renderFooter ? (
        <CardFooter className="border-t">{renderFooter()}</CardFooter>
      ) : (
        <CardFooter className="border-t flex-col items-stretch gap-1">
          <TypingIndicator typing={typing} />
          <KeyboardAvoidingView padding offset={8} className="w-full">
            <Composer
              onSend={send}
              onTyping={signalTyping}
              disabled={composerDisabled}
              autoFocus={autoFocus}
              placeholder={composerPlaceholder}
            />
          </KeyboardAvoidingView>
        </CardFooter>
      )}
    </Card>
  );
}

function ChatConnectionBanner({ status }: { status?: string }) {
  if (status !== 'reconnecting' && status !== 'closed') return null;
  return (
    <div
      className="px-3 py-1.5 text-xs text-center bg-muted text-muted-foreground border-b"
      role="status"
      aria-live="polite"
    >
      {status === 'reconnecting'
        ? 'Reconnecting… messages may be delayed.'
        : 'Disconnected — messages may be out of date.'}
    </div>
  );
}

function TypingIndicator({ typing }: { typing?: string[] }) {
  if (!typing || typing.length === 0) return null;
  return (
    <div className="text-xs italic text-muted-foreground" aria-live="polite">
      {typing.length === 1 ? 'Someone is typing…' : 'Several people are typing…'}
    </div>
  );
}
