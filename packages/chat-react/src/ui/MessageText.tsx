'use client';

export interface MessageTextProps {
  text: string;
  className?: string;
}

export function MessageText(props: MessageTextProps) {
  const { text, className } = props;
  return <span className={className}>{text}</span>;
}
