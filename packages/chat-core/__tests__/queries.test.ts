import { describe, it, expect } from "vitest";
import { threadDocPath, messagesColPath } from "../src/firestore/queries.js";

describe("threadDocPath", () => {
  it("string path", () => {
    expect(threadDocPath("chats", "thread1")).toEqual(["chats", "thread1"]);
  });

  it("array path", () => {
    expect(threadDocPath(["projects", "p1", "chatChannels"], "thread1")).toEqual([
      "projects",
      "p1",
      "chatChannels",
      "thread1",
    ]);
  });
});

describe("messagesColPath", () => {
  it("string path with default subcollection", () => {
    expect(messagesColPath("chats", "thread1")).toEqual(["chats", "thread1", "messages"]);
  });

  it("string path with custom subcollection", () => {
    expect(messagesColPath("chats", "thread1", "channelMessages")).toEqual([
      "chats",
      "thread1",
      "channelMessages",
    ]);
  });

  it("array path", () => {
    expect(messagesColPath(["projects", "p1", "chatChannels"], "thread1")).toEqual([
      "projects",
      "p1",
      "chatChannels",
      "thread1",
      "messages",
    ]);
  });
});
