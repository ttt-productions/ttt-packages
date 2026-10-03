import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import type { ChatMessageV1, ChatNameResolution } from "@ttt-productions/chat-core";
import { ChatNameResolverProvider, type UnresolvedChatName } from "../src/context/ChatNameResolverContext.js";
import { MessageItemDefault } from "../src/ui/MessageItemDefault.js";

const message: ChatMessageV1 = {
  messageId: "1",
  threadId: "t",
  createdAt: 1720000000000,
  senderId: "u-sender",
  text: "hello",
};

function renderWith(resolution: ChatNameResolution, renderUnresolvedName?: (r: UnresolvedChatName) => React.ReactNode) {
  return render(
    <ChatNameResolverProvider resolveName={() => resolution} renderUnresolvedName={renderUnresolvedName}>
      <MessageItemDefault m={message} currentUserId="u-me" isAdmin={false} />
    </ChatNameResolverProvider>,
  );
}

describe("a sender's name is the resolved name, or the app's own state — never a made-up name", () => {
  it("renders the resolved name", () => {
    const { getByText } = renderWith({ status: "resolved", name: "Ada" });
    expect(getByText("Ada")).toBeTruthy();
  });

  it("hands pending, unavailable, and failed to the app's slot instead of calling the sender \"User\"", () => {
    const slot = (r: UnresolvedChatName) => <span>{`app:${r.status}`}</span>;
    for (const status of ["pending", "unavailable"] as const) {
      const { getByText, queryByText, unmount } = renderWith({ status }, slot);
      expect(getByText(`app:${status}`)).toBeTruthy();
      expect(queryByText("User")).toBeNull();
      unmount();
    }
    const { getByText, queryByText } = renderWith({ status: "failed", retry: () => undefined }, slot);
    expect(getByText("app:failed")).toBeTruthy();
    expect(queryByText("User")).toBeNull();
  });

  it("a failed name read carries its retry to the app's slot", () => {
    const retry = vi.fn();
    const slot = (r: UnresolvedChatName) =>
      r.status === "failed" ? (
        <button type="button" onClick={r.retry}>
          Retry name
        </button>
      ) : null;
    const { getByRole } = renderWith({ status: "failed", retry }, slot);
    fireEvent.click(getByRole("button", { name: "Retry name" }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("with no slot, an unresolved sender renders no name at all", () => {
    const { queryByText, container } = renderWith({ status: "pending" });
    expect(queryByText("User")).toBeNull();
    expect(container.textContent).toContain("hello");
  });

  it("a sender click hands the app the sender id", () => {
    const onSenderClick = vi.fn();
    const { getByRole } = render(
      <ChatNameResolverProvider resolveName={() => ({ status: "resolved", name: "Ada" })}>
        <MessageItemDefault m={message} currentUserId="u-me" isAdmin={false} onSenderClick={onSenderClick} />
      </ChatNameResolverProvider>,
    );
    fireEvent.click(getByRole("button", { name: "Ada" }));
    expect(onSenderClick).toHaveBeenCalledWith("u-sender");
  });
});

describe("the app's unresolved state is never nested inside the sender click target", () => {
  it("a failed name renders the app's Retry, and pressing it does not count as a sender click", () => {
    const onSenderClick = vi.fn();
    const retry = vi.fn();
    const { getByRole, queryByRole } = render(
      <ChatNameResolverProvider
        resolveName={() => ({ status: "failed", retry })}
        renderUnresolvedName={(r) =>
          r.status === "failed" ? (
            <button type="button" onClick={r.retry}>
              Retry name
            </button>
          ) : null
        }
      >
        <MessageItemDefault m={message} currentUserId="u-me" isAdmin={false} onSenderClick={onSenderClick} />
      </ChatNameResolverProvider>,
    );
    fireEvent.click(getByRole("button", { name: "Retry name" }));
    expect(retry).toHaveBeenCalledTimes(1);
    expect(onSenderClick).not.toHaveBeenCalled();
    // No sender button wraps it.
    expect(queryByRole("button", { name: /retry name/i })?.closest('[role="button"]')).toBeNull();
  });
});
