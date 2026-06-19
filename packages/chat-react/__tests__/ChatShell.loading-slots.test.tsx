import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import type { ChatCoreConfig } from "../src/types.js";

// F4.1 regression: force the realtime data hook into its initial-loading state so we
// exercise the ChatShell `isInitialLoading` early-return. The consumer's header + the three
// render-slots (renderAboveMessages / renderBelowMessages / renderFooter) MUST still render
// while only the message list is skeletonized — otherwise a socket sitting in 'connecting'
// (WS URL baked but Worker unreachable) hides critical controls (e.g. the guild-invite
// binding-agreement Agree/Decline/stake-share controls) for the entire connect window.
vi.mock("../src/realtime/useRealtimeChatMessages.js", () => ({
  useRealtimeChatMessages: () => ({
    allowed: true,
    isInitialLoading: true,
    messages: [],
    fetchOlder: async () => {},
    hasOlder: false,
    isFetchingOlder: false,
    send: () => true,
    readAck: () => true,
    status: "connecting",
    typing: [],
    signalTyping: () => {},
  }),
}));

import { ChatShell } from "../src/ui/ChatShell.js";

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

describe("ChatShell — loading state preserves consumer slots (F4.1)", () => {
  it("renders the header + above/below/footer slots while the realtime socket is still connecting", () => {
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
  });
});
