'use client';

import { useChatNameResolver } from '../context/ChatNameResolverContext.js';

export function SenderName({ senderId }: { senderId: string }) {
  const { resolveName, renderUnresolvedName, renderHeldNameFailure } = useChatNameResolver();
  const resolution = resolveName(senderId);
  if (resolution.status === 'resolved') {
    return (
      <>
        {resolution.name}
        {resolution.failure ? (renderHeldNameFailure?.(resolution.failure) ?? null) : null}
      </>
    );
  }
  return <>{renderUnresolvedName?.(resolution) ?? null}</>;
}
