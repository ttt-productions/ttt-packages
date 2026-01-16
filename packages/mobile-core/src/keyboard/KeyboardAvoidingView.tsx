import React from "react";
import { useKeyboard } from "./useKeyboard";

type Props = React.HTMLAttributes<HTMLDivElement> & {
  /**
   * If true, adds padding-bottom equal to keyboard height while open.
   * Good default for forms.
   */
  padding?: boolean;
  /**
   * Adds extra px to bottom padding.
   */
  offset?: number;
};

/**
 * Desktop-safe: does nothing when keyboard is not detected.
 */
export function KeyboardAvoidingView({ padding = true, offset = 0, style, ...rest }: Props) {
  const k = useKeyboard();
  const pb = padding && k.isOpen ? k.height + offset : 0;

  return <div {...rest} style={{ ...style, paddingBottom: (style as any)?.paddingBottom ?? pb }} />;
}
