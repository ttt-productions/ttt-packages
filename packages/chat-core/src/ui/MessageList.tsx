"use client";

import * as React from "react";
import type { ChatMessageV1, MessageRendererRegistry, ModerationHandlers } from "../types";
import { Button } from "@ttt-productions/ui-core";
import { MessageItemDefault } from "./MessageItemDefault";

export function MessageList(props: {
  messages: ChatMessageV1[];
  currentUserId: string;
  isAdmin: boolean;

  isFetchingOlder?: boolean;
  hasOlder?: boolean;
  onLoadOlder?: () => void;

  renderMessage?: (m: ChatMessageV1) => React.ReactNode;
  messageRenderers?: MessageRendererRegistry;

  showScrollToBottom?: boolean;
  onScrollToBottom?: () => void;

  handlers?: ModerationHandlers;
}) {
  const {
    messages,
    currentUserId,
    isAdmin,
    isFetchingOlder,
    hasOlder,
    onLoadOlder,
    renderMessage,
    messageRenderers,
    showScrollToBottom,
    onScrollToBottom,
    handlers
  } = props;

  const scrollRef = React.useRef<HTMLDivElement>(null);
  const topSentinelRef = React.useRef<HTMLDivElement>(null);

  const isAtBottomRef = React.useRef(true);
  const prevScrollHeightRef = React.useRef<number | null>(null);
  const prevCountRef = React.useRef(0);

  React.useEffect(() => {
    const root = scrollRef.current;
    const target = topSentinelRef.current;
    if (!root || !target) return;
    if (typeof IntersectionObserver === "undefined") return;

    const io = new IntersectionObserver(
      (entries) => {
        const e = entries[0];
        if (!e?.isIntersecting) return;
        if (!hasOlder || isFetchingOlder) return;

        prevScrollHeightRef.current = root.scrollHeight;
        onLoadOlder?.();
      },
      { root, threshold: 0 }
    );

    io.observe(target);
    return () => io.disconnect();
  }, [hasOlder, isFetchingOlder, onLoadOlder]);

  React.useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const count = messages.length;
    const prev = prevCountRef.current;

    if (prev === 0 && count > 0) {
      el.scrollTop = el.scrollHeight;
      isAtBottomRef.current = true;
    } else if (count > prev && prevScrollHeightRef.current != null) {
      const diff = el.scrollHeight - prevScrollHeightRef.current;
      el.scrollTop += diff;
      prevScrollHeightRef.current = null;
    } else if (count > prev && isAtBottomRef.current) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }

    prevCountRef.current = count;
  }, [messages]);

  const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    isAtBottomRef.current = scrollHeight - (scrollTop + clientHeight) < 50;
  };

  let lastDay: string | null = null;

  return (
    <div className="relative">
      <div ref={scrollRef} className="h-[400px] overflow-y-auto p-4" onScroll={onScroll}>
        {isFetchingOlder && <div className="text-center text-xs opacity-70 mb-2">Loading…</div>}

        <div ref={topSentinelRef} />

        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-sm opacity-70">No messages yet</div>
        ) : (
          <div className="flex flex-col gap-3">
            {messages.map((m) => {
              const day = new Date(m.createdAt).toDateString();
              const showDay = day !== lastDay;
              lastDay = day;

              const byType =
                m.type && messageRenderers?.[m.type] ? messageRenderers[m.type]!(m) : null;

              const body =
                renderMessage?.(m) ??
                byType ?? (
                  <MessageItemDefault
                    m={m}
                    currentUserId={currentUserId}
                    isAdmin={isAdmin}
                    handlers={handlers}
                  />
                );

              return (
                <React.Fragment key={m.messageId}>
                  {showDay && (
                    <div className="my-2 flex justify-center">
                      {/* theme-core: components.css */}
                      <div className="chat-date-separator">
                        {new Date(m.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  )}
                  {body}
                </React.Fragment>
              );
            })}
          </div>
        )}
      </div>

      {showScrollToBottom && (
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full shadow-sm"
          onClick={onScrollToBottom}
        >
          ↓
        </Button>
      )}
    </div>
  );
}
