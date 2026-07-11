"use client";

import * as React from "react";
import type { MediaPreviewProps } from "@ttt-productions/media-viewer";

/**
 * The component chat attachments render their media through. Defaults to the
 * bare media-viewer `MediaViewer` when no provider is present; the consuming
 * app injects its own wrapper (recovery adapter, custom audio player chrome,
 * telemetry — whatever the app's one display path adds) so chat media rides
 * the SAME display pipeline as every other surface. chat-react stays
 * app-agnostic: it renders whatever component it is handed with plain
 * MediaPreview props.
 */
export type ChatAttachmentMediaComponent = React.ComponentType<MediaPreviewProps>;

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
