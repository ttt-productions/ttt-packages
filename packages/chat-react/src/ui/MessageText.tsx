'use client';

/**
 * Renders message text.
 *
 * Chat text is PLAIN text — there is no inline token grammar, no mention
 * parsing, and no rich-text pass. The component exists so every chat text
 * surface (message bubbles) renders through one place with one wrapper element
 * and one optional className.
 *
 * Pure, no context. Safe to use inside MessageItem renderers or any other chat
 * text surface.
 */

export interface MessageTextProps {
  /** Raw message text. Rendered verbatim. */
  text: string;
  /** Optional className applied to the wrapping `<span>`. */
  className?: string;
}

export function MessageText(props: MessageTextProps) {
  const { text, className } = props;
  return <span className={className}>{text}</span>;
}
