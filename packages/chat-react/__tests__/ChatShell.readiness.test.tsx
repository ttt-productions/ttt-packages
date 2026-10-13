import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import type { ChatCoreConfig } from "../src/types.js";
import type { UseRealtimeChatMessagesResult } from "../src/realtime/useRealtimeChatMessages.js";

// `onReadinessChange` tells a consumer whether the conversation can be acted on: allowed, its
// initial data loaded with no failure, and the realtime channel current since its socket last
// opened. A socket that is merely open, or data loaded before a disconnect, is not ready.
const mockRealtimeResult: { current: Partial<UseRealtimeChatMessagesResult> } = { current: {} };
vi.mock("../src/realtime/useRealtimeChatMessages.js", () => ({
  useRealtimeChatMessages: () => mockRealtimeResult.current,
}));

import { ChatShell } from "../src/ui/ChatShell.js";

function result(overrides: Partial<UseRealtimeChatMessagesResult>): Partial<UseRealtimeChatMessagesResult> {
  return {
    allowed: true,
    isInitialLoading: false,
    initialLoadFailed: false,
    isSynced: true,
    retry: () => {},
    messages: [],
    fetchOlder: async () => {},
    hasOlder: false,
    isFetchingOlder: false,
    send: () => true,
    readAck: () => true,
    status: "open",
    typing: [],
    signalTyping: () => {},
    ...overrides,
  };
}

const config = (allowed = true): ChatCoreConfig => ({
  transport: "realtime",
  chatCollectionPath: "guildInviteConversations",
  threadId: "inv1",
  currentUserId: "u1",
  isAdmin: false,
  allowed,
  realtime: { channelRef: { kind: "invite", id: "inv1" }, client: { subscribe: () => {}, send: () => {} } },
});

const lastReadiness = (spy: ReturnType<typeof vi.fn>) => spy.mock.calls.at(-1)?.[0];

beforeEach(() => {
  mockRealtimeResult.current = result({});
});

describe("ChatShell — onReadinessChange", () => {
  it.each([
    ["still opening", { isInitialLoading: true, isSynced: false, status: "connecting" as const }],
    ["open but not resynced", { isSynced: false }],
    ["the first open failed", { isInitialLoading: true, initialLoadFailed: true, isSynced: false }],
    ["loaded before a disconnect", { isSynced: false, status: "reconnecting" as const }],
    ["denied by the grant", { allowed: false, isSynced: false }],
  ])("is not ready while %s", (_case, overrides) => {
    mockRealtimeResult.current = result(overrides);
    const onReadinessChange = vi.fn();
    render(<ChatShell config={config()} renderLoadError={() => null} onReadinessChange={onReadinessChange} />);
    expect(lastReadiness(onReadinessChange)).toBe(false);
  });

  it("is not ready when the app has not allowed the conversation", () => {
    const onReadinessChange = vi.fn();
    render(<ChatShell config={config(false)} renderLoadError={() => null} onReadinessChange={onReadinessChange} />);
    expect(lastReadiness(onReadinessChange)).toBe(false);
  });

  it("is ready once loaded and current — an empty conversation included — and not ready again after a drop", () => {
    const onReadinessChange = vi.fn();
    const view = render(<ChatShell config={config()} renderLoadError={() => null} onReadinessChange={onReadinessChange} />);
    expect(lastReadiness(onReadinessChange)).toBe(true);

    mockRealtimeResult.current = result({ isSynced: false, status: "reconnecting" });
    view.rerender(<ChatShell config={config()} renderLoadError={() => null} onReadinessChange={onReadinessChange} />);
    expect(lastReadiness(onReadinessChange)).toBe(false);
  });

  it("reports not ready when the shell goes away", () => {
    const onReadinessChange = vi.fn();
    const view = render(<ChatShell config={config()} renderLoadError={() => null} onReadinessChange={onReadinessChange} />);
    view.unmount();
    expect(lastReadiness(onReadinessChange)).toBe(false);
  });
});
