"use client";

import * as React from "react";
import type { MediaPreviewProps, MediaViewerType } from "@ttt-productions/media-viewer";
import type { ChatAttachment } from "@ttt-productions/chat-core";

/**
 * The media kinds chat actually renders through the injected component. Chat only ever
 * mounts it for image/video/audio attachments; text/markdown render as the package's own
 * download link and never reach this slot. Computed as the intersection of chat-core's
 * `ChatAttachment['type']` and media-viewer's `MediaViewerType`, so it stays in the chat +
 * media-viewer domains with no ttt-core dependency (ARCH-201) and tracks either union
 * automatically if a kind is added or removed.
 */
export type ChatAttachmentMediaKind = Extract<ChatAttachment["type"], MediaViewerType>;

/**
 * The component chat attachments render their media through. Defaults to the bare
 * media-viewer `MediaViewer` when no provider is present; the consuming app injects its own
 * wrapper (recovery adapter, diagnostics, telemetry — whatever the app's one display path
 * adds) so chat media rides the SAME display pipeline as every other surface. chat-react
 * stays app-agnostic: it renders whatever component it is handed with plain MediaPreview
 * props — except `type`, which is REQUIRED and narrowed to the kind chat provides, so the
 * consuming wrapper never has to narrow an all-optional classification (no dead
 * mime/name/'other' branch).
 */
export type ChatAttachmentMediaComponent = React.ComponentType<
  Omit<MediaPreviewProps, "type"> & { type: ChatAttachmentMediaKind }
>;

const ChatAttachmentMediaContext = React.createContext<ChatAttachmentMediaComponent | null>(null);

export type ChatAttachmentMediaProviderProps = {
  mediaComponent: ChatAttachmentMediaComponent;
  children: React.ReactNode;
};

/**
 * Optional (unlike ChatAttachmentUrlProvider, which is required): without it,
 * attachments render through the package's own MediaViewer exactly as before.
 */
export function ChatAttachmentMediaProvider(props: ChatAttachmentMediaProviderProps) {
  const { mediaComponent, children } = props;
  return (
    <ChatAttachmentMediaContext.Provider value={mediaComponent}>
      {children}
    </ChatAttachmentMediaContext.Provider>
  );
}

/** Nullable hook — consumers fall back to the package MediaViewer. */
export function useChatAttachmentMediaComponent(): ChatAttachmentMediaComponent | null {
  return React.useContext(ChatAttachmentMediaContext);
}
