import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import type { ChatCoreConfig } from '../src/types.js';
import type { UseRealtimeChatMessagesResult } from '../src/realtime/useRealtimeChatMessages.js';

// `mock`-prefixed so vitest allows referencing it inside the hoisted factory.
const mockRealtimeResult: { current: Partial<UseRealtimeChatMessagesResult> } = { current: {} };
vi.mock('../src/realtime/useRealtimeChatMessages.js', () => ({
  useRealtimeChatMessages: () => mockRealtimeResult.current,
}));

import { ChatShell } from '../src/ui/ChatShell.js';

function loadingResult(
  status: UseRealtimeChatMessagesResult['status'],
): Partial<UseRealtimeChatMessagesResult> {
  return {
    allowed: true,
    isInitialLoading: true,
    initialLoadFailed: false,
    retry: () => {},
    messages: [],
    fetchOlder: async () => {},
    hasOlder: false,
    isFetchingOlder: false,
    send: () => true,
    readAck: () => true,
    status,
    typing: [],
    signalTyping: () => {},
  };
}

function realtimeConfig(): ChatCoreConfig {
  return {
    transport: 'realtime',
    chatCollectionPath: 'guildChatChannels',
    threadId: 'ch1',
    currentUserId: 'u1',
    isAdmin: false,
    allowed: true,
    realtime: {
      channelRef: { kind: 'room', id: 'ch1' },
      client: { subscribe: () => {}, send: () => {} },
    },
  };
}

beforeEach(() => {
  mockRealtimeResult.current = loadingResult('connecting');
});

describe('ChatShell — initial-loading state', () => {
  it('renders the header + above/below/footer slots while the realtime socket is still connecting', () => {
    const { getByText, getByRole } = render(
      <ChatShell
        config={realtimeConfig()}
        renderLoadError={() => null}
        header={<span>INVITE HEADER</span>}
        renderAboveMessages={() => <div>BINDING NOTICE</div>}
        renderBelowMessages={() => <button>Agree to Terms</button>}
        renderFooter={() => <div>FINAL FOOTER</div>}
      />,
    );
    expect(getByText('INVITE HEADER')).toBeTruthy();
    expect(getByText('BINDING NOTICE')).toBeTruthy();
    expect(getByRole('button', { name: 'Agree to Terms' })).toBeTruthy();
    expect(getByText('FINAL FOOTER')).toBeTruthy();
    expect(getByText(/Opening chat/i)).toBeTruthy();
  });

  it('paints NO above-messages wrapper (no bordered strip) when the slot renders null', () => {
    const { container, rerender } = render(
      <ChatShell
        config={realtimeConfig()}
        renderLoadError={() => null}
        renderAboveMessages={() => null}
      />,
    );
    expect(container.querySelector('.border-b')).toBeNull();
    rerender(
      <ChatShell
        config={realtimeConfig()}
        renderLoadError={() => null}
        renderAboveMessages={() => <div>FILES SECTION</div>}
      />,
    );
    const wrapper = container.querySelector('.border-b');
    expect(wrapper).not.toBeNull();
    expect(wrapper).toHaveTextContent('FILES SECTION');
  });

  it('shows an "Opening chat…" indicator in a polite live region and NOT a reconnect banner', () => {
    mockRealtimeResult.current = loadingResult('reconnecting');
    const { getByText, getByRole, queryByText } = render(
      <ChatShell config={realtimeConfig()} renderLoadError={() => null} />,
    );

    const status = getByRole('status');
    expect(status).toHaveTextContent(/Opening chat/i);
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(getByText(/Opening chat/i)).toBeTruthy();

    expect(queryByText(/Reconnecting/i)).toBeNull();
    expect(queryByText(/Disconnected/i)).toBeNull();
  });
});
