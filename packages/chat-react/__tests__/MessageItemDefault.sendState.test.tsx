import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import type { ChatMessageV1 } from "@ttt-productions/chat-core";
import { MessageItemDefault } from "../src/ui/MessageItemDefault.js";
import { ChatNameResolverProvider } from "../src/context/ChatNameResolverContext.js";

// The realtime channel client stamps meta.optimistic / meta.sendFailed on rows;
// the DEFAULT renderer must make both states visible (a pending or failed send is
// never indistinguishable from a delivered one) and wire the retry affordance to
// the ORIGINAL clientMessageId so the DO's send-idempotency dedups the retry.

function makeMessage(meta?: Record<string, unknown>): ChatMessageV1 {
  return {
    messageId: meta?.optimistic ? `optimistic:${String(meta.clientMessageId)}` : "42",
    threadId: "t1",
    createdAt: 1720000000000,
    senderId: "u-me",
    text: "hello there",
    ...(meta ? { meta } : {}),
  };
}

function renderItem(m: ChatMessageV1, onRetrySend?: (cmid: string) => void) {
  return render(
    <ChatNameResolverProvider resolveName={() => "Me"}>
      <MessageItemDefault m={m} currentUserId="u-me" isAdmin={false} onRetrySend={onRetrySend} />
    </ChatNameResolverProvider>,
  );
}

describe("MessageItemDefault — send states", () => {
  it("renders a delivered message with no pending/failed affordance", () => {
    const { container, queryByText } = renderItem(makeMessage({ seq: 42 }));
    expect(queryByText("Sending…")).toBeNull();
    expect(queryByText("Couldn't send")).toBeNull();
    expect(container.querySelector(".chat-bubble--pending")).toBeNull();
    expect(container.querySelector(".chat-bubble--failed")).toBeNull();
  });

  it("renders an un-acked optimistic row as visibly pending", () => {
    const { container, getByText } = renderItem(
      makeMessage({ optimistic: true, clientMessageId: "c-1" }),
    );
    expect(getByText("Sending…")).toBeTruthy();
    expect(container.querySelector(".chat-bubble--pending")).toBeTruthy();
    expect(container.querySelector(".chat-bubble--failed")).toBeNull();
  });

  it("renders a failed row as visibly failed with a retry affordance", () => {
    const onRetrySend = vi.fn();
    const { container, getByText, getByRole } = renderItem(
      makeMessage({ optimistic: true, clientMessageId: "c-1", sendFailed: true }),
      onRetrySend,
    );
    expect(getByText("Couldn't send")).toBeTruthy();
    expect(container.querySelector(".chat-bubble--failed")).toBeTruthy();
    // Failed supersedes pending — no "Sending…" alongside the failure.
    expect(container.querySelector(".chat-bubble--pending")).toBeNull();

    // Retry re-uses the ORIGINAL clientMessageId.
    fireEvent.click(getByRole("button", { name: "Retry" }));
    expect(onRetrySend).toHaveBeenCalledTimes(1);
    expect(onRetrySend).toHaveBeenCalledWith("c-1");
  });

  it("shows the failed state without a retry button when no onRetrySend is wired", () => {
    const { getByText, queryByRole } = renderItem(
      makeMessage({ optimistic: true, clientMessageId: "c-1", sendFailed: true }),
    );
    expect(getByText("Couldn't send")).toBeTruthy();
    expect(queryByRole("button", { name: "Retry" })).toBeNull();
  });
});

describe("MessageItemDefault — correlated send-rejection copy + retry policy", () => {
  const CASES: Array<{ code: string; copy: string; retry: boolean }> = [
    { code: "blocked-word", copy: "Message contains blocked language", retry: false },
    { code: "archived", copy: "This channel is read-only", retry: false },
    { code: "deleted", copy: "This channel is read-only", retry: false },
    { code: "membership-pending", copy: "Chat is still preparing", retry: true },
    { code: "wordlist-unavailable", copy: "Chat safety check is temporarily unavailable", retry: true },
    { code: "flood", copy: "Please wait before sending again", retry: true },
    { code: "slow-mode", copy: "Please wait before sending again", retry: true },
  ];

  it.each(CASES)("maps $code to its copy and %s retry affordance", ({ code, copy, retry }) => {
    const onRetrySend = vi.fn();
    const { getByText, queryByRole } = renderItem(
      makeMessage({ optimistic: true, clientMessageId: "c-1", sendFailed: true, sendFailureCode: code, sendRetryable: retry }),
      onRetrySend,
    );
    expect(getByText(copy)).toBeTruthy();
    if (retry) {
      expect(queryByRole("button", { name: "Retry" })).toBeTruthy();
    } else {
      // Terminal codes: an unchanged resend cannot succeed, so no Retry is offered
      // even when onRetrySend IS wired.
      expect(queryByRole("button", { name: "Retry" })).toBeNull();
    }
  });

  it("keeps the rejected bubble's original text (never cleared) on a terminal failure", () => {
    const { getByText } = renderItem(
      makeMessage({ optimistic: true, clientMessageId: "c-1", sendFailed: true, sendFailureCode: "blocked-word", sendRetryable: false }),
    );
    // The user's text survives so they can copy/repurpose it — only the reason is shown.
    expect(getByText("hello there")).toBeTruthy();
    expect(getByText("Message contains blocked language")).toBeTruthy();
  });

  it("falls back to 'Couldn't send' for a failed send with no code (transport/exhausted) and offers Retry", () => {
    const onRetrySend = vi.fn();
    const { getByText, getByRole } = renderItem(
      makeMessage({ optimistic: true, clientMessageId: "c-1", sendFailed: true }),
      onRetrySend,
    );
    expect(getByText("Couldn't send")).toBeTruthy();
    fireEvent.click(getByRole("button", { name: "Retry" }));
    expect(onRetrySend).toHaveBeenCalledWith("c-1");
  });
});
