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

function renderWithProviders(m: ChatMessageV1, mediaComponent?: React.ComponentType<MediaPreviewProps>) {
  const tree = (
    <ChatNameResolverProvider resolveName={() => "Me"}>
      <ChatAttachmentUrlProvider resolveAttachmentUrl={(att) => `https://media.test/${att.mediaAssetId}`}>
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
});
