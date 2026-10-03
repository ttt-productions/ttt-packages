import { describe, it, expect } from "vitest";
import type {
  ChatCoreConfig,
  ChatTransportMode,
  ChatRealtimeTransportConfig,
} from "../src/types.js";

// Shape guards for the discriminated transport config, exercised at runtime: a firestore
// config (the default transport) and a realtime config must both satisfy ChatCoreConfig,
// and both carry the app's one access fact, `allowed`.

describe("ChatCoreConfig transport", () => {
  it("defaults to the firestore transport when `transport` is omitted (non-breaking)", () => {
    const cfg: ChatCoreConfig = {
      chatCollectionPath: "guildChatChannels",
      threadId: "ch1",
      currentUserId: "u1",
      isAdmin: false,
      allowed: true,
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
      allowed: false,
    };
    expect(cfg.transport).toBe("firestore");
  });

  it("accepts a realtime transport with a neutral conversation reference and an opaque client", () => {
    const realtime: ChatRealtimeTransportConfig = {
      channelRef: { kind: "room", id: "wp1/ch1" },
      client: { subscribe: () => {}, send: () => {} },
    };
    const cfg: ChatCoreConfig = {
      transport: "realtime",
      chatCollectionPath: "guildChatChannels",
      threadId: "ch1",
      currentUserId: "u1",
      isAdmin: false,
      allowed: true,
      realtime,
    };
    expect(cfg.transport).toBe("realtime");
    expect(cfg.realtime).toBe(realtime);
  });

  it("carries no package-side access mode or member list — access is the app's one fact", () => {
    const cfg: ChatCoreConfig = {
      chatCollectionPath: "c",
      threadId: "t",
      currentUserId: "u",
      isAdmin: false,
      allowed: true,
    };
    // @ts-expect-error — the allowlist mode and its member list are gone from the config.
    const legacy: ChatCoreConfig = { ...cfg, accessMode: "explicit-allowlist", threadAllowedUserIds: ["u"] };
    expect(legacy.allowed).toBe(true);
  });

  it("transport mode union is exactly firestore | realtime", () => {
    const modes: ChatTransportMode[] = ["firestore", "realtime"];
    expect(modes).toEqual(["firestore", "realtime"]);
  });
});
