import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import type { ChatMessageV1 } from '@ttt-productions/chat-core';
import { MessageList } from '../src/ui/MessageList.js';
import { ChatNameResolverProvider } from '../src/context/ChatNameResolverContext.js';

const base = 1_700_000_000_000;
function msg(messageId: string, offsetMs: number, official?: boolean): ChatMessageV1 {
  return {
    messageId,
    threadId: 't1',
    senderId: 'sender-1',
    text: `text ${messageId}`,
    createdAt: base + offsetMs,
    ...(official ? { meta: { official: true } } : {}),
  };
}

const groupKey = (m: ChatMessageV1) => (m.meta?.official === true ? 'official' : undefined);
const adornment = (m: ChatMessageV1) => (m.meta?.official === true ? <span>Official</span> : null);

function renderList(messages: ChatMessageV1[]) {
  return render(
    <ChatNameResolverProvider resolveName={() => ({ status: 'resolved', name: 'Ada' })}>
      <MessageList
        messages={messages}
        currentUserId="viewer"
        messageGroupKey={groupKey}
        renderSenderAdornment={adornment}
      />
    </ChatNameResolverProvider>,
  );
}

function bubbleFor(text: string): HTMLElement {
  const el = screen.getByText(text).closest('.chat-bubble');
  if (!el) throw new Error(`no bubble for ${text}`);
  return el as HTMLElement;
}

describe("MessageList — the app's sender adornment and group key", () => {
  it('shows the adornment beside the sender of a message that carries the fact', () => {
    renderList([msg('m1', 0, true)]);
    const bubble = bubbleFor('text m1');
    expect(within(bubble).getByText('Ada')).toBeInTheDocument();
    expect(within(bubble).getByText('Official')).toBeInTheDocument();
  });

  it('a same-sender switch into the fact inside the grouping window shows the sender line with the adornment', () => {
    renderList([msg('m1', 0), msg('m2', 30_000, true)]);
    const first = bubbleFor('text m1');
    const second = bubbleFor('text m2');
    expect(within(first).queryByText('Official')).toBeNull();
    expect(within(second).getByText('Ada')).toBeInTheDocument();
    expect(within(second).getByText('Official')).toBeInTheDocument();
  });

  it('a switch out of the fact shows the sender line again without carrying the old adornment', () => {
    renderList([msg('m1', 0, true), msg('m2', 30_000)]);
    const second = bubbleFor('text m2');
    expect(within(second).getByText('Ada')).toBeInTheDocument();
    expect(within(second).queryByText('Official')).toBeNull();
    expect(screen.getAllByText('Official')).toHaveLength(1);
  });

  it('keeps grouping consecutive messages that share the fact', () => {
    renderList([msg('m1', 0, true), msg('m2', 30_000, true)]);
    expect(within(bubbleFor('text m2')).queryByText('Ada')).toBeNull();
    expect(screen.getAllByText('Official')).toHaveLength(1);
  });
});
