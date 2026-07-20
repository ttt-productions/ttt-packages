import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import type { ChatCoreConfig } from "../src/types.js";
import type { UseRealtimeChatMessagesResult } from "../src/realtime/useRealtimeChatMessages.js";

// Drive the realtime data hook's result directly so we exercise the ChatShell
// `isInitialLoading` branch deterministically. Two contracts are under test:
//   F4.1 — the consumer's header + the three render-slots (renderAboveMessages /
//     renderBelowMessages / renderFooter) MUST still render while the message list
//     region is replaced (critical guild-invite agreement controls hang off them).
//   Initial-load — that region shows an honest "Opening chat…" indicator in a
//     polite live region, and the reconnect banner must NOT compete with it.
// `mock`-prefixed so vitest allows referencing it inside the hoisted factory.
const mockRealtimeResult: { current: Partial<UseRealtimeChatMessagesResult> } = { current: {} };
vi.mock("../src/realtime/useRealtimeChatMessages.js", () => ({
  useRealtimeChatMessages: () => mockRealtimeResult.current,
}));

import { ChatShell } from "../src/ui/ChatShell.js";

function loadingResult(status: UseRealtimeChatMessagesResult["status"]): Partial<UseRealtimeChatMessagesResult> {
  return {
    allowed: true,
    isInitialLoading: true,
    messages: [],
    fetchOlder: async () => {},
    hasOlder: false,
    isFetchingOlder: false,
    send: () => true,
    readAck: () => true,
    status,
    typing: [],
    signalTyping: () => {},
  };
}

function realtimeConfig(): ChatCoreConfig {
  return {
    transport: "realtime",
    chatCollectionPath: "guildChatChannels",
    threadId: "ch1",
    currentUserId: "u1",
    isAdmin: false,
    accessMode: "firestore-rules",
    realtime: {
      channelRef: { scope: "channel", workProjectId: "wp1", guildChatChannelId: "ch1" },
      client: { subscribe: () => {}, send: () => {} },
    },
  };
}

beforeEach(() => {
  mockRealtimeResult.current = loadingResult("connecting");
});

describe("ChatShell — initial-loading state", () => {
  it("renders the header + above/below/footer slots while the realtime socket is still connecting (F4.1)", () => {
    const { getByText, getByRole } = render(
      <ChatShell
        config={realtimeConfig()}
        header={<span>INVITE HEADER</span>}
        renderAboveMessages={() => <div>BINDING NOTICE</div>}
        renderBelowMessages={() => <button>Agree to Terms</button>}
        renderFooter={() => <div>FINAL FOOTER</div>}
      />,
    );
    // The critical agreement controls must be present even though the message list is loading.
    expect(getByText("INVITE HEADER")).toBeTruthy();
    expect(getByText("BINDING NOTICE")).toBeTruthy();
    expect(getByRole("button", { name: "Agree to Terms" })).toBeTruthy();
    expect(getByText("FINAL FOOTER")).toBeTruthy();
    // The honest working state is shown in place of the message list.
    expect(getByText(/Opening chat/i)).toBeTruthy();
  });

  it('shows an "Opening chat…" indicator in a polite live region and NOT a reconnect banner', () => {
    // Even while the transport is 'reconnecting' during INITIAL loading, the opening
    // indicator wins — the reconnect/disconnected banner must not compete with it.
    mockRealtimeResult.current = loadingResult("reconnecting");
    const { getByText, getByRole, queryByText } = render(<ChatShell config={realtimeConfig()} />);

    const status = getByRole("status");
    expect(status).toHaveTextContent(/Opening chat/i);
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(getByText(/Opening chat/i)).toBeTruthy();

    // The reconnect/disconnected banner copy must be absent during initial opening.
    expect(queryByText(/Reconnecting/i)).toBeNull();
    expect(queryByText(/Disconnected/i)).toBeNull();
  });
});
