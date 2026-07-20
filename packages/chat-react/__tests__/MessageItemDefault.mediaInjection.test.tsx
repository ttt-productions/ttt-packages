import * as React from "react";
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import type { ChatMessageV1, ChatAttachment } from "@ttt-productions/chat-core";
import type { MediaPreviewProps } from "@ttt-productions/media-viewer";
import { MessageItemDefault } from "../src/ui/MessageItemDefault.js";
import { ChatNameResolverProvider } from "../src/context/ChatNameResolverContext.js";
import { ChatAttachmentUrlProvider } from "../src/context/ChatAttachmentUrlContext.js";
import { ChatAttachmentMediaProvider } from "../src/context/ChatAttachmentMediaContext.js";

// Attachment media rides the app-injected display component when a
// ChatAttachmentMediaProvider is present (the app's one-display-path wrapper —
// recovery adapter, custom audio player) and falls back to the package's own
// MediaViewer when absent — the pre-injection behavior, unchanged.

vi.mock("react-intersection-observer", () => ({
  useInView: () => ({ ref: () => {}, inView: false }),
}));

function makeAttachment(type: ChatAttachment["type"]): ChatAttachment {
  return {
    id: "att-1",
    name: `file.${type}`,
    type,
    size: 123,
    mediaAssetId: "asset-1",
    storagePath: "uploads/chat/u-me/att-1",
    status: "ready",
  };
}

function makeMessage(attachment: ChatAttachment): ChatMessageV1 {
  return {
    messageId: "42",
    threadId: "t1",
    createdAt: 1720000000000,
    senderId: "u-me",
    text: "with attachment",
    attachment,
  };
}

function renderWithProviders(
  m: ChatMessageV1,
  mediaComponent?: React.ComponentType<MediaPreviewProps>,
  resolveAttachmentUrl: (att: ChatAttachment) => string | null = (att) => `https://media.test/${att.mediaAssetId}`,
) {
  const tree = (
    <ChatNameResolverProvider resolveName={() => "Me"}>
      <ChatAttachmentUrlProvider resolveAttachmentUrl={resolveAttachmentUrl}>
        {mediaComponent ? (
          <ChatAttachmentMediaProvider mediaComponent={mediaComponent}>
            <MessageItemDefault m={m} currentUserId="u-me" isAdmin={false} />
          </ChatAttachmentMediaProvider>
        ) : (
          <MessageItemDefault m={m} currentUserId="u-me" isAdmin={false} />
        )}
      </ChatAttachmentUrlProvider>
    </ChatNameResolverProvider>
  );
  return render(tree);
}

describe("MessageItemDefault — attachment media injection", () => {
  it.each(["image", "video", "audio"] as const)(
    "renders a %s attachment through the injected media component with the resolved URL",
    (type) => {
      const seen: MediaPreviewProps[] = [];
      const FakeMedia = (props: MediaPreviewProps) => {
        seen.push(props);
        return <div data-testid="injected-media" data-type={String(props.type)} />;
      };

      const { getByTestId } = renderWithProviders(makeMessage(makeAttachment(type)), FakeMedia);
      expect(getByTestId("injected-media")).toHaveAttribute("data-type", type);
      expect(seen[0]?.url).toBe("https://media.test/asset-1");
      expect(seen[0]?.className).toBe("chat-attachment-media");
      if (type === "image") expect(seen[0]?.alt).toBe("Image attachment");
      expect(JSON.stringify(seen[0])).not.toContain(`file.${type}`);
    },
  );

  it("falls back to the package MediaViewer when no provider is present", () => {
    const { container, queryByTestId } = renderWithProviders(makeMessage(makeAttachment("image")));
    expect(queryByTestId("injected-media")).toBeNull();
    // MediaViewer's wrapper div renders with the passed className.
    expect(container.querySelector(".chat-attachment-media")).toBeTruthy();
  });

  it("does not use the injected component for text attachments (download link)", () => {
    const FakeMedia = vi.fn(() => <div data-testid="injected-media" />);
    const { queryByTestId, container } = renderWithProviders(
      makeMessage(makeAttachment("text")),
      FakeMedia as unknown as React.ComponentType<MediaPreviewProps>,
    );
    expect(queryByTestId("injected-media")).toBeNull();
    const link = container.querySelector(".chat-attachment-text-link");
    expect(link).toHaveTextContent("Download attachment");
    expect(link).not.toHaveTextContent("file.text");
    expect(link).toHaveAttribute("download", "file.text");
    expect(FakeMedia).not.toHaveBeenCalled();
  });

  it.each(["pending", "failed"] as const)(
    "uses a semantic label for a %s attachment without displaying its filename",
    (status) => {
      const attachment = { ...makeAttachment("audio"), status };
      const { getByText, queryByText } = renderWithProviders(makeMessage(attachment));
      expect(getByText("Audio attachment")).toBeInTheDocument();
      expect(queryByText("file.audio")).toBeNull();
    },
  );

  it("keeps a pending attachment on the sender-only 'Sending…' state (unchanged by the ready placeholder)", () => {
    // A pending recipient/sender attachment must still say "Sending…", NEVER "Loading…" —
    // the ready-URL-settling placeholder is a distinct state and must not bleed into it.
    const attachment = { ...makeAttachment("image"), status: "pending" as const };
    const { getByText, queryByText } = renderWithProviders(makeMessage(attachment));
    expect(getByText("Sending…")).toBeInTheDocument();
    expect(queryByText("Loading…")).toBeNull();
  });
});

describe("MessageItemDefault — ready attachment with a settling (null) authorized URL", () => {
  it.each(["image", "video", "audio", "text"] as const)(
    "renders a neutral loading placeholder for a ready %s attachment and does NOT mount the media renderer",
    (type) => {
      const FakeMedia = vi.fn(() => <div data-testid="injected-media" />);
      const { getByText, queryByTestId, container } = renderWithProviders(
        makeMessage(makeAttachment(type)), // status: 'ready'
        FakeMedia as unknown as React.ComponentType<MediaPreviewProps>,
        () => null, // authorized URL not settled yet
      );
      // Neutral loading placeholder in the existing loading visual language.
      const label =
        type === "image" ? "Image attachment"
        : type === "video" ? "Video attachment"
        : type === "audio" ? "Audio attachment"
        : "File attachment";
      expect(getByText(label)).toBeInTheDocument();
      expect(getByText("Loading…")).toBeInTheDocument();
      // "Sending…" is a DIFFERENT state and must not appear on a terminal-ready row.
      expect(container.textContent).not.toContain("Sending…");
      // The media/download renderer must not mount until a non-empty authorized URL exists.
      expect(queryByTestId("injected-media")).toBeNull();
      expect(FakeMedia).not.toHaveBeenCalled();
      expect(container.querySelector(".chat-attachment-media")).toBeNull();
      // text/file must not have fallen through to the download link either.
      expect(container.querySelector(".chat-attachment-text-link")).toBeNull();
    },
  );

  it("does not expose the attachment filename in the settling placeholder", () => {
    const { container, queryByText } = renderWithProviders(
      makeMessage(makeAttachment("image")),
      undefined,
      () => null,
    );
    expect(queryByText("file.image")).toBeNull();
    expect(container.textContent).not.toContain("file.image");
  });

  it("mounts the media renderer once a non-empty authorized URL exists (placeholder gone)", () => {
    const FakeMedia = vi.fn((props: MediaPreviewProps) => (
      <div data-testid="injected-media" data-type={String(props.type)} />
    ));
    const { getByTestId, queryByText } = renderWithProviders(
      makeMessage(makeAttachment("image")),
      FakeMedia as unknown as React.ComponentType<MediaPreviewProps>,
      (att) => `https://media.test/${att.mediaAssetId}`,
    );
    expect(getByTestId("injected-media")).toHaveAttribute("data-type", "image");
    expect(queryByText("Loading…")).toBeNull();
  });
});
