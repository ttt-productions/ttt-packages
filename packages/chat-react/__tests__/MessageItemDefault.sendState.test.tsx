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
