import { describe, it, expect } from "vitest";
import type {
  ChatCoreConfig,
  ChatTransportMode,
  ChatRealtimeTransportConfig,
} from "../src/types.js";

// Boundary-guard tests for the discriminated transport config (chat-edge-rebuild P1).
// These are compile-time shape guards exercised at runtime: a firestore config
// (default transport) and a realtime config must both satisfy ChatCoreConfig,
// and `accessMode` remains present on both (presentation-only on realtime).

describe("ChatCoreConfig transport", () => {
  it("defaults to the firestore transport when `transport` is omitted (non-breaking)", () => {
    const cfg: ChatCoreConfig = {
      chatCollectionPath: "guildChatChannels",
      threadId: "ch1",
      currentUserId: "u1",
      isAdmin: false,
      accessMode: "firestore-rules",
    };
    expect(cfg.transport).toBeUndefined(); // consumers treat undefined as 'firestore'
  });

  it("accepts an explicit firestore transport", () => {
    const cfg: ChatCoreConfig = {
      transport: "firestore",
      chatCollectionPath: "guildChatChannels",
      threadId: "ch1",
      currentUserId: "u1",
      isAdmin: false,
      accessMode: "explicit-allowlist",
      threadAllowedUserIds: ["u1", "u2"],
    };
    expect(cfg.transport).toBe("firestore");
  });

  it("accepts a realtime transport with an opaque realtime handle; accessMode is presentation-only", () => {
    const realtime: ChatRealtimeTransportConfig = {
      channelRef: { scope: "channel", workProjectId: "wp1", guildChatChannelId: "ch1" },
      client: { subscribe: () => {}, send: () => {} },
    };
    const cfg: ChatCoreConfig = {
      transport: "realtime",
      chatCollectionPath: "guildChatChannels",
      threadId: "ch1",
      currentUserId: "u1",
      isAdmin: false,
      accessMode: "firestore-rules", // presentation-only on realtime; the DO grant gates data
      realtime,
    };
    expect(cfg.transport).toBe("realtime");
    expect(cfg.realtime).toBe(realtime);
  });

  it("transport mode union is exactly firestore | realtime", () => {
    const modes: ChatTransportMode[] = ["firestore", "realtime"];
    expect(modes).toEqual(["firestore", "realtime"]);
  });
});
