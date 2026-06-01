import { describe, it, expect } from "vitest";
import { threadDocPath, messagesColPath } from "../src/firestore/queries.js";

describe("threadDocPath", () => {
  it("string path", () => {
    expect(threadDocPath("chats", "thread1")).toEqual(["chats", "thread1"]);
  });

  it("array path", () => {
    expect(threadDocPath(["entities", "e1", "channels"], "thread1")).toEqual([
      "entities",
      "e1",
      "channels",
      "thread1",
    ]);
  });
});

describe("messagesColPath", () => {
  it("string path with default subcollection", () => {
    expect(messagesColPath("chats", "thread1")).toEqual(["chats", "thread1", "messages"]);
  });

  it("string path with custom subcollection", () => {
    expect(messagesColPath("chats", "thread1", "messages")).toEqual([
      "chats",
      "thread1",
      "messages",
    ]);
  });

  it("array path", () => {
    expect(messagesColPath(["entities", "e1", "channels"], "thread1")).toEqual([
      "entities",
      "e1",
      "channels",
      "thread1",
      "messages",
    ]);
  });
});
