import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { render } from '@testing-library/react';
import type { ChatCoreConfig } from '../src/types.js';
import type { UseRealtimeChatMessagesResult } from '../src/realtime/useRealtimeChatMessages.js';
import { realtimeMessagesResult } from './helpers/hook-results.js';

const mockRealtimeResult: { current: UseRealtimeChatMessagesResult } = {
  current: realtimeMessagesResult(),
};
vi.mock(import('../src/realtime/useRealtimeChatMessages.js'), async (importOriginal) => {
  const { stubModule } = await import('@ttt-productions/dev-standards/testing');
  return stubModule(importOriginal, {
    useRealtimeChatMessages: () => mockRealtimeResult.current,
  });
});

import { ChatShell } from '../src/ui/ChatShell.js';

const config = (allowed = true): ChatCoreConfig => ({
  transport: 'realtime',
  chatCollectionPath: 'guildInviteConversations',
  threadId: 'inv1',
  currentUserId: 'u1',
  allowed,
  realtime: {
    channelRef: { kind: 'invite', id: 'inv1' },
    client: { subscribe: () => {}, send: () => {} },
  },
});

const lastReadiness = (spy: Mock<(ready: boolean) => void>) => spy.mock.calls.at(-1)?.[0];

beforeEach(() => {
  mockRealtimeResult.current = realtimeMessagesResult({});
});

describe('ChatShell — onReadinessChange', () => {
  it.each([
    ['still opening', { isInitialLoading: true, isSynced: false, status: 'connecting' as const }],
    ['open but not resynced', { isSynced: false }],
    ['the first open failed', { isInitialLoading: true, initialLoadFailed: true, isSynced: false }],
    ['loaded before a disconnect', { isSynced: false, status: 'reconnecting' as const }],
    ['denied by the grant', { allowed: false, isSynced: false }],
  ])('is not ready while %s', (_case, overrides) => {
    mockRealtimeResult.current = realtimeMessagesResult(overrides);
    const onReadinessChange = vi.fn<(ready: boolean) => void>();
    render(
      <ChatShell
        config={config()}
        renderLoadError={() => null}
        onReadinessChange={onReadinessChange}
      />,
    );
    expect(lastReadiness(onReadinessChange)).toBe(false);
  });

  it('is not ready when the app has not allowed the conversation', () => {
    const onReadinessChange = vi.fn<(ready: boolean) => void>();
    render(
      <ChatShell
        config={config(false)}
        renderLoadError={() => null}
        onReadinessChange={onReadinessChange}
      />,
    );
    expect(lastReadiness(onReadinessChange)).toBe(false);
  });

  it('is ready once loaded and current — an empty conversation included — and not ready again after a drop', () => {
    const onReadinessChange = vi.fn<(ready: boolean) => void>();
    const view = render(
      <ChatShell
        config={config()}
        renderLoadError={() => null}
        onReadinessChange={onReadinessChange}
      />,
    );
    expect(lastReadiness(onReadinessChange)).toBe(true);

    mockRealtimeResult.current = realtimeMessagesResult({
      isSynced: false,
      status: 'reconnecting',
    });
    view.rerender(
      <ChatShell
        config={config()}
        renderLoadError={() => null}
        onReadinessChange={onReadinessChange}
      />,
    );
    expect(lastReadiness(onReadinessChange)).toBe(false);
  });

  it('reports not ready when the shell goes away', () => {
    const onReadinessChange = vi.fn<(ready: boolean) => void>();
    const view = render(
      <ChatShell
        config={config()}
        renderLoadError={() => null}
        onReadinessChange={onReadinessChange}
      />,
    );
    view.unmount();
    expect(lastReadiness(onReadinessChange)).toBe(false);
  });
});
