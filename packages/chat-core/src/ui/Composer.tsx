"use client";

import * as React from "react";
import { Button, Textarea, cn } from "@ttt-productions/ui-core";

export function Composer(props: {
  disabled?: boolean;
  autoFocus?: boolean;
  placeholder?: string;
  onSend: (text: string) => void | Promise<void>;
}) {
  const { disabled, autoFocus = false, placeholder = "Type a message...", onSend } = props;
  const [text, setText] = React.useState("");
  const ref = React.useRef<HTMLTextAreaElement>(null);

  // focus stability: never steal focus unless explicitly enabled
  React.useEffect(() => {
    if (!autoFocus) return;
    ref.current?.focus();
  }, [autoFocus]);

  const send = async () => {
    const v = text.trim();
    if (!v) return;
    setText("");
    await onSend(v);
  };

  return (
    <div className="flex items-end gap-2">
      <Textarea
        ref={ref}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        rows={1}
        className={cn("min-h-[40px] resize-none")}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            send();
          }
        }}
      />
      <Button
        type="button"
        variant="default"
        disabled={disabled || !text.trim()}
        onClick={send}
      >
        Send
      </Button>
    </div>
  );
}
