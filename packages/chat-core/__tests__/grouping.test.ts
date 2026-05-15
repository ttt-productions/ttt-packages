import { describe, it, expect } from "vitest";
import { isContinuation } from "../src/grouping.js";
import { GROUP_GAP_SEC } from "../src/types.js";
import type { ChatMessageV1 } from "../src/types.js";

function makeMsg(overrides: Partial<ChatMessageV1> & { messageId: string }): ChatMessageV1 {
  return {
    threadId: "t1",
    senderId: "userA",
    createdAt: 1_000_000,
    ...overrides,
  };
}

describe("isContinuation", () => {
  it("returns false when prev is undefined (first message in list)", () => {
    const msg = makeMsg({ messageId: "m1" });
    expect(isContinuation(undefined, msg)).toBe(false);
  });

  it("returns true when same sender within the gap", () => {
    const prev = makeMsg({ messageId: "m1", createdAt: 1_000_000 });
    const msg = makeMsg({ messageId: "m2", createdAt: 1_000_000 + 30_000 });
    expect(isContinuation(prev, msg)).toBe(true);
  });

  it("returns true exactly at the gap boundary", () => {
    const prev = makeMsg({ messageId: "m1", createdAt: 1_000_000 });
    const msg = makeMsg({
      messageId: "m2",
      createdAt: 1_000_000 + GROUP_GAP_SEC * 1000,
    });
    expect(isContinuation(prev, msg)).toBe(true);
  });

  it("returns false one millisecond past the gap boundary", () => {
    const prev = makeMsg({ messageId: "m1", createdAt: 1_000_000 });
    const msg = makeMsg({
      messageId: "m2",
      createdAt: 1_000_000 + GROUP_GAP_SEC * 1000 + 1,
    });
    expect(isContinuation(prev, msg)).toBe(false);
  });

  it("returns false when senderIds differ", () => {
    const prev = makeMsg({ messageId: "m1", senderId: "userA" });
    const msg = makeMsg({
      messageId: "m2",
      senderId: "userB",
      createdAt: 1_000_000 + 30_000,
    });
    expect(isContinuation(prev, msg)).toBe(false);
  });

  it("returns false when prev is a system message", () => {
    const prev = makeMsg({ messageId: "m1", isSystemMessage: true });
    const msg = makeMsg({
      messageId: "m2",
      createdAt: 1_000_000 + 30_000,
    });
    expect(isContinuation(prev, msg)).toBe(false);
  });

  it("returns false when msg is a system message", () => {
    const prev = makeMsg({ messageId: "m1" });
    const msg = makeMsg({
      messageId: "m2",
      createdAt: 1_000_000 + 30_000,
      isSystemMessage: true,
    });
    expect(isContinuation(prev, msg)).toBe(false);
  });

  it("returns false on negative gap (out-of-order messages)", () => {
    const prev = makeMsg({ messageId: "m1", createdAt: 1_000_000 });
    const msg = makeMsg({
      messageId: "m2",
      createdAt: 1_000_000 - 1,
    });
    expect(isContinuation(prev, msg)).toBe(false);
  });

  it("returns true at gap of zero (simultaneous timestamps)", () => {
    const prev = makeMsg({ messageId: "m1", createdAt: 1_000_000 });
    const msg = makeMsg({ messageId: "m2", createdAt: 1_000_000 });
    expect(isContinuation(prev, msg)).toBe(true);
  });
});
