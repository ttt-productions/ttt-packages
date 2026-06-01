'use client';

/**
 * Renders message text with inline mention chips.
 *
 * Walks the parser output and renders each segment: text segments as
 * `<span>`, mention segments via the consumer-supplied `renderMention`
 * callback (or a default chip when omitted).
 *
 * Pure, no context. Safe to use inside MessageItem renderers, ReplyQuote
 * previews, or any other text surface that should honor mention tokens.
 */

import type { ReactNode } from 'react';
import type { MentionRef } from '@ttt-productions/chat-core';
import { parseMentionTokens } from '@ttt-productions/chat-core';

export interface MessageTextProps<TKind extends string = string> {
  /** Raw message text containing optional `@[kind:id|displayText]` tokens. */
  text: string;
  /**
   * Custom mention renderer. When omitted, mentions render as a
   * `<span class="chat-mention-chip">@{displayText}</span>` chip — consumers
   * style via CSS. To make mentions clickable / linked / role-aware, supply
   * a renderMention.
   */
  renderMention?: (ref: MentionRef<TKind>) => ReactNode;
  /** Optional className applied to the wrapping `<span>`. */
  className?: string;
}

function DefaultMentionChip<TKind extends string>({ ref }: { ref: MentionRef<TKind> }) {
  return (
    <span className="chat-mention-chip" data-mention-kind={ref.kind} data-mention-id={ref.id}>
      @{ref.displayText}
    </span>
  );
}

export function MessageText<TKind extends string = string>(props: MessageTextProps<TKind>) {
  const { text, renderMention, className } = props;
  const segments = parseMentionTokens<TKind>(text);

  return (
    <span className={className}>
      {segments.map((seg, i) => {
        if (seg.type === 'text') {
          return <span key={i}>{seg.text}</span>;
        }
        if (renderMention) {
          return <span key={i}>{renderMention(seg.ref)}</span>;
        }
        return <DefaultMentionChip key={i} ref={seg.ref} />;
      })}
    </span>
  );
}
