"use client";

import { useChatNameResolver } from "../context/ChatNameResolverContext.js";

/**
 * A message sender's name: the resolved name, or — when the app could not resolve it —
 * whatever the app's `renderUnresolvedName` renders for that resolution. Never a stand-in
 * name: an unresolved sender with no slot renders nothing.
 */
export function SenderName({ senderId }: { senderId: string }) {
  const { resolveName, renderUnresolvedName } = useChatNameResolver();
  const resolution = resolveName(senderId);
  if (resolution.status === "resolved") return <>{resolution.name}</>;
  return <>{renderUnresolvedName?.(resolution) ?? null}</>;
}
