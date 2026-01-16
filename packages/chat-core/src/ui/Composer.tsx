"use client";

import * as React from "react";

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
      <textarea
        ref={ref}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        rows={1}
        className="min-h-[40px] resize-none flex-grow rounded-md border p-2"
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            send();
          }
        }}
      />
      <button
        type="button"
        className="rounded-md border px-3 py-2 disabled:opacity-50"
        disabled={disabled || !text.trim()}
        onClick={send}
      >
        Send
      </button>
    </div>
  );
}
