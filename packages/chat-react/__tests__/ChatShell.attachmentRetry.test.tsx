import * as React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import type { ChatCoreConfig } from "../src/types.js";
import type { ChatMessageV1 } from "@ttt-productions/chat-core";
import type { UseRealtimeChatMessagesResult } from "../src/realtime/useRealtimeChatMessages.js";

// End-to-end wiring: a terminally-failed attachment bubble's "Attach again" action
// runs onRetryAttachment (ChatShell) → composerRef.openAttachmentSelector →
// MediaInput.openSelection — the canonical picker. The action is offered only when
// attachment support is configured.

const openSelectionSpy = vi.fn();

const mockRealtimeResult: { current: Partial<UseRealtimeChatMessagesResult> } = { current: {} };
vi.mock("../src/realtime/useRealtimeChatMessages.js", () => ({
  useRealtimeChatMessages: () => mockRealtimeResult.current,
}));

vi.mock("@ttt-productions/file-input/react", () => ({
  MediaInput: React.forwardRef(function MediaInput(
    _props: unknown,
    ref: React.Ref<{ openSelection: () => void }>,
  ) {
    React.useImperativeHandle(ref, () => ({ openSelection: openSelectionSpy }), []);
    return <div data-testid="media-input" />;
  }),
}));
vi.mock("@ttt-productions/file-input", () => ({ ensureFileWithContentType: (f: File) => f }));
vi.mock("@ttt-productions/upload-ui/react/upload", () => ({
  useGuardedUpload: () => vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@ttt-productions/upload-ui/react/guard", () => ({
  useOptionalLocalUploadGuard: () => null,
}));
vi.mock("../src/mentions/use-mention-autocomplete.js", () => ({
  useMentionAutocomplete: () => ({
    state: { open: false },
    getValueWithTokens: () => "",
    close: vi.fn(),
    insertMention: vi.fn(),
    handleKeyDown: () => false,
  }),
}));
vi.mock("../src/mentions/MentionAutocomplete.js", () => ({
  MentionAutocomplete: () => null,
}));

import { ChatShell } from "../src/ui/ChatShell.js";
import { ChatNameResolverProvider } from "../src/context/ChatNameResolverContext.js";
import { ChatAttachmentUrlProvider } from "../src/context/ChatAttachmentUrlContext.js";

function failedAttachmentMessage(): ChatMessageV1 {
  return {
    messageId: "m1",
    threadId: "ch1",
    createdAt: 1720000000000,
    senderId: "u1", // == currentUserId → the sender
    text: "here",
    attachment: {
      id: "att-1",
      name: "secret.png",
      type: "image",
      size: 10,
      storagePath: "uploads/chat/u1/att-1",
      status: "failed",
      failureReason: "internal_moderation_error",
    },
  };
}

function loadedResult(messages: ChatMessageV1[]): Partial<UseRealtimeChatMessagesResult> {
  return {
    allowed: true,
    isInitialLoading: false,
    messages,
    fetchOlder: async () => {},
    hasOlder: false,
    isFetchingOlder: false,
    send: () => true,
    readAck: () => true,
    status: "open",
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

function attachmentConfig() {
  return {
    storage: {} as never,
    userId: "u1",
    uploadAdapter: { buildUploadPath: () => "uploads/chat/u1/x" },
    attachmentSpec: {} as never,
  } as never;
}

function renderShell(props: Record<string, unknown>) {
  return render(
    <ChatNameResolverProvider resolveName={() => "Me"}>
      <ChatAttachmentUrlProvider resolveAttachmentUrl={() => null}>
        <ChatShell config={realtimeConfig()} {...props} />
      </ChatAttachmentUrlProvider>
    </ChatNameResolverProvider>,
  );
}

beforeEach(() => {
  openSelectionSpy.mockClear();
  mockRealtimeResult.current = loadedResult([failedAttachmentMessage()]);
});

describe("ChatShell — failed-attachment 'Attach again' wiring", () => {
  it("offers 'Attach again' with attachments configured and re-opens the canonical picker exactly once", () => {
    const { getByRole } = renderShell({
      attachmentConfig: attachmentConfig(),
      sendAttachment: vi.fn().mockResolvedValue(undefined),
    });
    fireEvent.click(getByRole("button", { name: "Attach again" }));
    expect(openSelectionSpy).toHaveBeenCalledTimes(1);
  });

  it("does NOT offer 'Attach again' when attachment support is not configured", () => {
    const { queryByRole } = renderShell({});
    expect(queryByRole("button", { name: "Attach again" })).toBeNull();
  });
});
