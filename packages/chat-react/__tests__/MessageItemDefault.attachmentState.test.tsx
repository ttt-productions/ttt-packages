import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import type { ChatMessageV1, ChatAttachment } from "@ttt-productions/chat-core";
import { MessageItemDefault } from "../src/ui/MessageItemDefault.js";
import { ChatNameResolverProvider } from "../src/context/ChatNameResolverContext.js";
import { ChatAttachmentUrlProvider } from "../src/context/ChatAttachmentUrlContext.js";

// Attachment pending/failed presentation:
//  - pending = bytes uploaded, backend processing → "Processing…" in a polite live
//    region (never "Sending…"/"Loading…"), no filename;
//  - failed  = terminal → a SAFE per-kind copy (never the internal failureReason),
//    alert semantics, and an "Attach again" action for the SENDER only, and only
//    when a retry handler is wired.

vi.mock("react-intersection-observer", () => ({
  useInView: () => ({ ref: () => {}, inView: false }),
}));

// A realistic internal diagnostic that must NEVER reach the UI.
const INTERNAL_REASON = "moderation_pipeline_error: vision.SAFE_SEARCH code=13 asset=abc123";

function makeAttachment(type: ChatAttachment["type"], overrides: Partial<ChatAttachment> = {}): ChatAttachment {
  return {
    id: "att-1",
    name: `secret-filename.${type}`,
    type,
    size: 123,
    storagePath: "uploads/chat/u-me/att-1",
    ...overrides,
  };
}

function makeMessage(attachment: ChatAttachment, senderId = "u-me"): ChatMessageV1 {
  return {
    messageId: "42",
    threadId: "t1",
    createdAt: 1720000000000,
    senderId,
    text: "with attachment",
    attachment,
  };
}

function renderItem(
  m: ChatMessageV1,
  opts: { currentUserId?: string; onRetryAttachment?: () => void } = {},
) {
  const { currentUserId = "u-me", onRetryAttachment } = opts;
  return render(
    <ChatNameResolverProvider resolveName={() => "Me"}>
      <ChatAttachmentUrlProvider resolveAttachmentUrl={() => "https://media.test/x"}>
        <MessageItemDefault
          m={m}
          currentUserId={currentUserId}
          isAdmin={false}
          onRetryAttachment={onRetryAttachment}
        />
      </ChatAttachmentUrlProvider>
    </ChatNameResolverProvider>,
  );
}

describe("MessageItemDefault — pending attachment", () => {
  it('says "Processing…" in a polite live region, never "Sending…" or "Loading…"', () => {
    const att = makeAttachment("image", { status: "pending" });
    const { getByText, queryByText, container } = renderItem(makeMessage(att));
    expect(getByText("Processing…")).toBeInTheDocument();
    expect(queryByText("Sending…")).toBeNull();
    expect(queryByText("Loading…")).toBeNull();

    const region = container.querySelector(".chat-attachment-pending");
    expect(region).toHaveAttribute("role", "status");
    expect(region).toHaveAttribute("aria-live", "polite");
  });

  it("keeps the semantic kind label and discloses no filename", () => {
    const att = makeAttachment("audio", { status: "pending" });
    const { getByText, container } = renderItem(makeMessage(att));
    expect(getByText("Audio attachment")).toBeInTheDocument();
    expect(container.textContent).not.toContain("secret-filename");
  });
});

describe("MessageItemDefault — failed attachment", () => {
  it("maps the internal failureReason to safe generic copy and NEVER renders the raw reason", () => {
    const att = makeAttachment("image", { status: "failed", failureReason: INTERNAL_REASON });
    const { getByText, queryByText, container } = renderItem(makeMessage(att));

    expect(getByText("This image could not be processed.")).toBeInTheDocument();
    expect(queryByText(INTERNAL_REASON)).toBeNull();
    expect(container.textContent).not.toContain("moderation_pipeline_error");
    // Semantic kind label preserved; filename never disclosed.
    expect(getByText("Image attachment")).toBeInTheDocument();
    expect(container.textContent).not.toContain("secret-filename");
    // Alert semantics without the destructive full-bubble treatment.
    expect(container.querySelector(".chat-attachment-rejected")).toHaveAttribute("role", "alert");
  });

  it.each([
    ["image", "This image could not be processed."],
    ["video", "This video could not be processed."],
    ["audio", "This audio could not be processed."],
    ["text", "This file could not be processed."],
  ] as const)("uses safe per-kind failure copy for a %s attachment", (type, copy) => {
    const att = makeAttachment(type, { status: "failed", failureReason: INTERNAL_REASON });
    const { getByText, queryByText } = renderItem(makeMessage(att));
    expect(getByText(copy)).toBeInTheDocument();
    expect(queryByText(INTERNAL_REASON)).toBeNull();
  });

  it("offers 'Attach again' to the sender when a retry handler is wired; clicking it calls the handler once", () => {
    const onRetryAttachment = vi.fn();
    const att = makeAttachment("image", { status: "failed", failureReason: INTERNAL_REASON });
    const { getByRole } = renderItem(makeMessage(att), { onRetryAttachment });
    fireEvent.click(getByRole("button", { name: "Attach again" }));
    expect(onRetryAttachment).toHaveBeenCalledTimes(1);
  });

  it("does NOT offer 'Attach again' when no retry handler is wired (attachment support absent)", () => {
    const att = makeAttachment("image", { status: "failed" });
    const { queryByRole } = renderItem(makeMessage(att));
    expect(queryByRole("button", { name: "Attach again" })).toBeNull();
  });

  it("does NOT offer 'Attach again' to a non-sender even when a retry handler is wired", () => {
    const onRetryAttachment = vi.fn();
    const att = makeAttachment("image", { status: "failed" });
    const { queryByRole } = renderItem(makeMessage(att, "u-other"), {
      currentUserId: "u-me",
      onRetryAttachment,
    });
    expect(queryByRole("button", { name: "Attach again" })).toBeNull();
  });
});
