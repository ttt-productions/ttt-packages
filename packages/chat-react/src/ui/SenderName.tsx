'use client';

import { useChatNameResolver } from '../context/ChatNameResolverContext.js';

export function SenderName({ senderId }: { senderId: string }) {
  const { resolveName, renderUnresolvedName } = useChatNameResolver();
  const resolution = resolveName(senderId);
  if (resolution.status === 'resolved') return <>{resolution.name}</>;
  return <>{renderUnresolvedName?.(resolution) ?? null}</>;
}
