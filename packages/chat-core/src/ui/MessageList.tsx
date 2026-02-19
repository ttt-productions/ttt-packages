"use client";

import * as React from "react";
import type { ChatMessageV1, MessageRendererRegistry, ModerationHandlers } from "../types";
import { GROUP_GAP_SEC } from "../types";
import { Button } from "@ttt-productions/ui-core";
import { MessageItemDefault } from "./MessageItemDefault";

/**
 * Determine if msg is a "continuation" of prev (same sender, within GROUP_GAP_SEC, no system break).
 */
function isContinuation(prev: ChatMessageV1 | undefined, msg: ChatMessageV1): boolean {
  if (!prev) return false;
  if (msg.isSystemMessage || prev.isSystemMessage) return false;
  if (msg.senderId !== prev.senderId) return false;
  const gapMs = msg.createdAt - prev.createdAt;
  return gapMs >= 0 && gapMs <= GROUP_GAP_SEC * 1000;
}

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
  onSenderClick?: (senderId: string, displayName: string) => void;
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
    handlers,
    onSenderClick,
  } = props;

  const scrollRef = React.useRef<HTMLDivElement>(null);
  const topSentinelRef = React.useRef<HTMLDivElement>(null);

  const isAtBottomRef = React.useRef(true);
  const prevScrollHeightRef = React.useRef<number | null>(null);
  const prevCountRef = React.useRef(0);

  // IntersectionObserver for infinite scroll (older messages)
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

  // Scroll management — FIXES accordion scroll jump
  React.useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const count = messages.length;
    const prev = prevCountRef.current;

    if (prev === 0 && count > 0) {
      // Initial load — scroll to bottom WITHOUT triggering parent scroll
      requestAnimationFrame(() => {
        const savedScrollY = window.scrollY;
        el.scrollTop = el.scrollHeight;
        // Restore page scroll if the browser moved it
        if (window.scrollY !== savedScrollY) {
          window.scrollTo({ top: savedScrollY, behavior: "instant" as ScrollBehavior });
        }
      });
      isAtBottomRef.current = true;
    } else if (count > prev && prevScrollHeightRef.current != null) {
      // Older messages prepended — maintain scroll position
      const diff = el.scrollHeight - prevScrollHeightRef.current;
      el.scrollTop += diff;
      prevScrollHeightRef.current = null;
    } else if (count > prev && isAtBottomRef.current) {
      // New message at bottom, user is at bottom — scroll down
      // Use scrollTop assignment, NOT scrollTo with behavior:"smooth" (causes parent scroll jump)
      requestAnimationFrame(() => {
        const savedScrollY = window.scrollY;
        el.scrollTop = el.scrollHeight;
        if (window.scrollY !== savedScrollY) {
          window.scrollTo({ top: savedScrollY, behavior: "instant" as ScrollBehavior });
        }
      });
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
          <div className="flex flex-col">
            {messages.map((m, idx) => {
              const day = new Date(m.createdAt).toDateString();
              const showDay = day !== lastDay;
              lastDay = day;

              const prevMsg = idx > 0 ? messages[idx - 1] : undefined;
              // Date separators always break grouping
              const continuation = showDay ? false : isContinuation(prevMsg, m);

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
                    isContinuation={continuation}
                    onSenderClick={onSenderClick}
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
