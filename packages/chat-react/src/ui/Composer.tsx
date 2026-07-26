"use client";

import * as React from "react";
import { Button, Textarea } from "@ttt-productions/ui-core/react";
import { cn } from "@ttt-productions/ui-core";
import { useOptionalLocalUploadGuard } from "@ttt-productions/upload-ui/react/guard";
import { Loader2 } from "lucide-react";
import type { ChatMessageV1 } from "@ttt-productions/chat-core";
import { useMentionAutocomplete } from "../mentions/use-mention-autocomplete.js";
import { MentionAutocomplete } from "../mentions/MentionAutocomplete.js";

function genId(): string {
  return `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

export type ComposerProps = {
  /**
   * Text send. The composer is TEXT-ONLY — files are shared through the
   * conversation's Conversation Files surface, never through the message
   * timeline, so there is no attachment path here.
   */
  onSend: (text: string, replyTo?: ChatMessageV1["replyTo"]) => Promise<void>;

  /**
   * Signal the local user is typing (R14). Called as the user edits the textarea; the
   * realtime transport coalesces to ≤1 frame per ~2s, so calling per keystroke is safe.
   * Optional — absent on the firestore transport (no typing broadcast).
   */
  onTyping?: () => void;

  disabled?: boolean;
  autoFocus?: boolean;
  placeholder?: string;
  mentionConfig?: import('../types.js').ChatMentionConfig;
};

export function Composer(props: ComposerProps) {
  const {
    onSend,
    onTyping,
    disabled,
    autoFocus = false,
    placeholder = "Type a message...",
  } = props;

  const [text, setText] = React.useState("");
  const [isSending, setIsSending] = React.useState(false);
  const [sendError, setSendError] = React.useState<string | null>(null);
  const ref = React.useRef<HTMLTextAreaElement>(null);
  // Navigation guard for the in-flight send: a send that has left the composer
  // but not yet committed is killable by navigation/sign-out with zero warning
  // (observed live: the callable aborted, the message silently never delivered).
  // Registering with the app's one guarded-navigation system makes beforeunload
  // fire on hard navs and lets GuardedLink-style navigation confirm first.
  // Optional accessor — consumers without the provider degrade to old behavior.
  const navigationGuard = useOptionalLocalUploadGuard();

  const mentionApi = useMentionAutocomplete({
    textareaRef: ref as React.RefObject<HTMLTextAreaElement>,
    value: text,
    onChange: setText,
    providers: props.mentionConfig?.providers ?? [],
    context: props.mentionConfig?.context,
    recent: props.mentionConfig?.recent,
    trigger: props.mentionConfig?.trigger,
    minQueryLength: props.mentionConfig?.minQueryLength,
    searchDebounceMs: props.mentionConfig?.searchDebounceMs,
  });

  // focus stability: never steal focus unless explicitly enabled
  React.useEffect(() => {
    if (!autoFocus) return;
    ref.current?.focus();
  }, [autoFocus]);

  const send = async () => {
    const v = text.trim();
    if (!v) return;

    setIsSending(true);
    setSendError(null);
    const sendGuardId = `chat-send-${genId()}`;
    navigationGuard?.registerUpload(sendGuardId);

    try {
      await onSend(mentionApi.getValueWithTokens());
      setText("");
      mentionApi.close();
    } catch (err) {
      // C-B8: a failed send (e.g. the realtime socket was closed) must NOT clear the
      // user's text — `setText("")` only runs on the success path above — and must NOT
      // re-throw into the click handler (an unhandled rejection). Surface it so the
      // user can retry with their text intact.
      console.error("[Composer] Send failed:", err);
      setSendError("Couldn't send. Check your connection and try again.");
    } finally {
      navigationGuard?.unregisterUpload(sendGuardId);
      setIsSending(false);
    }
  };

  const isDisabled = disabled || isSending;

  return (
    <div className="chat-composer">
      {props.mentionConfig && mentionApi.state.open && (
        <div className="relative">
          <div className="absolute bottom-full left-0 mb-1 z-10">
            <MentionAutocomplete
              state={mentionApi.state}
              onSelect={(ref) => mentionApi.insertMention(ref)}
            />
          </div>
        </div>
      )}

      {sendError && (
        <div className="px-1 pb-1 text-sm text-destructive" role="alert">
          {sendError}
        </div>
      )}

      <div className="flex items-end gap-2">
        <Textarea
          ref={ref}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (sendError) setSendError(null);
            // R14: broadcast a typing signal (transport-coalesced) while there is content.
            if (onTyping && e.target.value.trim().length > 0) onTyping();
          }}
          placeholder={placeholder}
          disabled={isDisabled}
          rows={1}
          className={cn("min-h-[40px] resize-none")}
          onKeyDown={(e) => {
            if (mentionApi.handleKeyDown(e)) return;
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        <Button
          type="button"
          variant="default"
          disabled={isDisabled || !text.trim()}
          onClick={send}
        >
          {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send"}
        </Button>
      </div>
    </div>
  );
}
