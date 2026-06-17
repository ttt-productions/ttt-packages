"use client";

import * as React from "react";
import type { ChatMessageV1, ModerationHandlers } from "@ttt-productions/chat-core";
import { isContinuation } from "@ttt-productions/chat-core";
import type { MessageRendererRegistry } from "../types.js";
import { Button } from "@ttt-productions/ui-core/react";
import { MessageItemDefault } from "./MessageItemDefault.js";

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
  /** Reports whether the list is scrolled to the bottom so the consumer can advance
   *  authoritative read state only when the latest message is actually in view (C-B6). */
  onAtBottomChange?: (atBottom: boolean) => void;
  /** Class for the scrollable message region. Overrides the default. The default is
   *  `h-[400px]` (fixed-height card) unless `fillHeight` is set, in which case it is
   *  `flex-1 min-h-0`. */
  scrollClassName?: string;
  /** Fill the parent's height instead of a fixed `h-[400px]`. Makes the list a flex-col
   *  that flexes to fill its container, so a bounded-height page panel scrolls inside.
   *  The consuming layout must give MessageList's ancestor a bounded height (ChatShell's
   *  `fillHeight` wires Card → CardContent → MessageList for this). */
  fillHeight?: boolean;

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
    onAtBottomChange,
    scrollClassName,
    fillHeight = false,
    handlers,
    onSenderClick,
  } = props;

  const scrollClass = scrollClassName ?? (fillHeight ? "flex-1 min-h-0" : "h-[400px]");
  const outerClass = fillHeight ? "relative flex flex-col flex-1 min-h-0" : "relative";

  const scrollRef = React.useRef<HTMLDivElement>(null);
  const topSentinelRef = React.useRef<HTMLDivElement>(null);

  const isAtBottomRef = React.useRef(true);
  const prevScrollHeightRef = React.useRef<number | null>(null);
  const prevCountRef = React.useRef(0);

  // Count of messages that arrived while the user was scrolled up — drives the
  // "new messages" pill. Reset when the user returns to the bottom.
  const [unseenCount, setUnseenCount] = React.useState(0);

  const scrollToBottom = React.useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    isAtBottomRef.current = true;
    setUnseenCount(0);
    onAtBottomChange?.(true);
  }, [onAtBottomChange]);

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
    } else if (count > prev) {
      // New message(s) arrived while the user was scrolled up — surface the pill
      // instead of yanking their scroll position.
      setUnseenCount((c) => c + (count - prev));
    }

    prevCountRef.current = count;
  }, [messages]);

  const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const atBottom = scrollHeight - (scrollTop + clientHeight) < 50;
    if (atBottom !== isAtBottomRef.current) onAtBottomChange?.(atBottom);
    isAtBottomRef.current = atBottom;
    if (atBottom && unseenCount !== 0) setUnseenCount(0);
  };

  let lastDay: string | null = null;

  return (
    <div className={outerClass}>
      <div ref={scrollRef} className={`${scrollClass} overflow-y-auto p-4`} onScroll={onScroll}>
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

      {(unseenCount > 0 || showScrollToBottom) && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label={unseenCount > 0 ? `${unseenCount} new messages, scroll to latest` : "Scroll to latest"}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full shadow-sm gap-1"
          onClick={() => {
            scrollToBottom();
            onScrollToBottom?.();
          }}
        >
          {unseenCount > 0
            ? `${unseenCount} new message${unseenCount > 1 ? "s" : ""} ↓`
            : "↓"}
        </Button>
      )}
    </div>
  );
}
