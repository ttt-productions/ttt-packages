import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import type { ChatCoreConfig } from "../src/types.js";
import type { ChatLoadFailure } from "../src/ui/ChatShell.js";
import type { UseRealtimeChatMessagesResult } from "../src/realtime/useRealtimeChatMessages.js";
import type { UseChatMessagesResult } from "../src/hooks/useChatMessages.js";
import { ChatNameResolverProvider } from "../src/context/ChatNameResolverContext.js";

// Drive both transports' data hooks directly so each failure seat is exercised
// deterministically. `mock`-prefixed so vitest allows referencing them inside the factories.
const mockRealtime: { current: Partial<UseRealtimeChatMessagesResult> } = { current: {} };
const mockFirestore: { current: Partial<UseChatMessagesResult> } = { current: {} };
vi.mock("../src/realtime/useRealtimeChatMessages.js", () => ({
  useRealtimeChatMessages: () => mockRealtime.current,
}));
vi.mock("../src/hooks/useChatMessages.js", () => ({
  useChatMessages: () => mockFirestore.current,
}));

import { ChatShell } from "../src/ui/ChatShell.js";

const message = (id: string) => ({ messageId: id, threadId: "t", createdAt: 1, senderId: "s", text: `text ${id}` });

function realtimeConfig(allowed = true): ChatCoreConfig {
  return {
    transport: "realtime",
    chatCollectionPath: "c",
    threadId: "t",
    currentUserId: "u1",
    isAdmin: false,
    allowed,
    realtime: { channelRef: { kind: "room", id: "r1" }, client: {} },
  };
}

function firestoreConfig(): ChatCoreConfig {
  return { chatCollectionPath: "c", threadId: "t", currentUserId: "u1", isAdmin: false, allowed: true };
}

function realtimeResult(over: Partial<UseRealtimeChatMessagesResult>): Partial<UseRealtimeChatMessagesResult> {
  return {
    allowed: true,
    isInitialLoading: true,
    initialLoadFailed: false,
    retry: vi.fn(),
    messages: [],
    fetchOlder: async () => {},
    hasOlder: false,
    isFetchingOlder: false,
    send: () => true,
    readAck: () => true,
    status: "reconnecting",
    typing: [],
    signalTyping: () => {},
    ...over,
  };
}

function firestoreResult(over: Partial<UseChatMessagesResult>): Partial<UseChatMessagesResult> {
  return {
    allowed: true,
    isInitialLoading: false,
    messages: [],
    fetchOlder: async () => {},
    hasOlder: false,
    isFetchingOlder: false,
    sourceState: "live",
    error: null,
    olderError: null,
    retry: vi.fn(),
    ...over,
  };
}

/** The app's error seat: records every failure it was handed and offers its retry. */
function seat() {
  const seen: ChatLoadFailure[] = [];
  const renderLoadError = (failure: ChatLoadFailure) => {
    seen.push(failure);
    return (
      <div data-testid={`load-error-${failure.scope}`}>
        <button type="button" onClick={failure.retry}>
          Retry {failure.scope}
        </button>
      </div>
    );
  };
  return { seen, renderLoadError };
}

function shell(config: ChatCoreConfig, renderLoadError: (f: ChatLoadFailure) => React.ReactNode) {
  return render(
    <ChatNameResolverProvider resolveName={() => ({ status: "resolved", name: "Sam" })}>
      <ChatShell config={config} renderLoadError={renderLoadError} renderFooter={() => <div>FOOTER</div>} />
    </ChatNameResolverProvider>,
  );
}

beforeEach(() => {
  mockRealtime.current = realtimeResult({});
  mockFirestore.current = firestoreResult({});
});

describe("ChatShell — one failure seat for a chat that cannot load", () => {
  it("realtime: after the first-open budget fails, the app's error replaces the opening state, with Retry", () => {
    const retry = vi.fn();
    mockRealtime.current = realtimeResult({ initialLoadFailed: true, retry });
    const { seen, renderLoadError } = seat();
    const { getByTestId, queryByText, getByRole, getByText } = shell(realtimeConfig(), renderLoadError);
    expect(getByTestId("load-error-initial")).toBeTruthy();
    expect(queryByText(/Opening chat/i)).toBeNull();
    expect(seen.at(-1)).toMatchObject({ scope: "initial", error: null });
    fireEvent.click(getByRole("button", { name: "Retry initial" }));
    expect(retry).toHaveBeenCalledTimes(1);
    // The consumer's other slots still render around the failure.
    expect(getByText("FOOTER")).toBeTruthy();
  });

  it("realtime: before the budget is spent it stays an honest opening state", () => {
    const { renderLoadError } = seat();
    const { getByText, queryByTestId } = shell(realtimeConfig(), renderLoadError);
    expect(getByText(/Opening chat/i)).toBeTruthy();
    expect(queryByTestId("load-error-initial")).toBeNull();
  });

  it("Firestore: a listener that fails before any message shows the same initial seat with the read's error", () => {
    const error = new Error("denied");
    const retry = vi.fn();
    mockFirestore.current = firestoreResult({ error, retry, sourceState: "error" });
    const { seen, renderLoadError } = seat();
    const { getByTestId, queryByText, getByRole } = shell(firestoreConfig(), renderLoadError);
    expect(getByTestId("load-error-initial")).toBeTruthy();
    expect(queryByText("No messages yet")).toBeNull();
    expect(seen.at(-1)).toMatchObject({ scope: "initial", error });
    fireEvent.click(getByRole("button", { name: "Retry initial" }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("Firestore: a listener that fails after messages loaded keeps them, with the failure in a band", () => {
    mockFirestore.current = firestoreResult({ error: new Error("lost"), messages: [message("m1")] });
    const { renderLoadError } = seat();
    const { getByTestId, getByText } = shell(firestoreConfig(), renderLoadError);
    expect(getByTestId("load-error-live")).toBeTruthy();
    expect(getByText("text m1")).toBeTruthy();
  });

  it("Firestore: a failed older page renders its error row at the top of the kept messages", () => {
    const retry = vi.fn();
    mockFirestore.current = firestoreResult({
      olderError: new Error("older"),
      retry,
      hasOlder: true,
      messages: [message("m1")],
    });
    const { renderLoadError } = seat();
    const { getByTestId, getByText, getByRole } = shell(firestoreConfig(), renderLoadError);
    expect(getByTestId("load-error-older")).toBeTruthy();
    expect(getByText("text m1")).toBeTruthy();
    fireEvent.click(getByRole("button", { name: "Retry older" }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("an older-page Retry stays visibly pending while the page is read again", () => {
    mockFirestore.current = firestoreResult({
      olderError: new Error("older"),
      isFetchingOlder: true,
      hasOlder: true,
      messages: [message("m1")],
    });
    const { seen, renderLoadError } = seat();
    shell(firestoreConfig(), renderLoadError);
    expect(seen.at(-1)).toMatchObject({ scope: "older", retrying: true });
    mockFirestore.current = firestoreResult({ olderError: new Error("older"), hasOlder: true, messages: [message("m1")] });
    shell(firestoreConfig(), renderLoadError);
    expect(seen.at(-1)).toMatchObject({ scope: "older", retrying: false });
  });

  it("a conversation the app says the user may not read renders the no-access state and no failure", () => {
    mockRealtime.current = realtimeResult({ initialLoadFailed: true });
    const { seen, renderLoadError } = seat();
    const { getByText } = shell(realtimeConfig(false), renderLoadError);
    expect(getByText(/have access/i)).toBeTruthy();
    expect(seen).toHaveLength(0);
  });
});
