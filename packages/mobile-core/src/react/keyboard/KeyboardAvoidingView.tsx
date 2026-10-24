import React from 'react';
import { useKeyboard } from './useKeyboard.js';

type Props = React.HTMLAttributes<HTMLDivElement> & {
  padding?: boolean;
  offset?: number;
};

export function KeyboardAvoidingView({ padding = true, offset = 0, style, ...rest }: Props) {
  const k = useKeyboard();
  const pb = padding && k.isOpen ? k.height + offset : 0;

  return <div {...rest} style={{ ...style, paddingBottom: style?.paddingBottom ?? pb }} />;
}
