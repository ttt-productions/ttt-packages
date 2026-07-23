"use client";

import * as React from "react";
import { Button, Textarea } from "@ttt-productions/ui-core/react";
import { cn } from "@ttt-productions/ui-core";
import { ensureFileWithContentType } from "@ttt-productions/file-input";
import { MediaInput } from "@ttt-productions/file-input/react";
import type { MediaInputChangePayload, MediaInputHandle } from "@ttt-productions/file-input";
import type { UploadState } from "@ttt-productions/media-schemas";
import { useGuardedUpload } from "@ttt-productions/upload-ui/react/upload";
import { useOptionalLocalUploadGuard } from "@ttt-productions/upload-ui/react/guard";
import { Loader2, X, FileText, ImageIcon, VideoIcon, MicIcon } from "lucide-react";
import type { ChatAttachment, ChatMessageV1, SendAttachmentFn } from "@ttt-productions/chat-core";
import type { ChatAttachmentConfig } from "../types.js";
import { useMentionAutocomplete } from "../mentions/use-mention-autocomplete.js";
import { MentionAutocomplete } from "../mentions/MentionAutocomplete.js";

function genId(): string {
  return `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

function getAttachmentType(file: File): ChatAttachment["type"] {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return "audio";
  return "text";
}

function AttachmentTypeIcon({ type }: { type: ChatAttachment["type"] }) {
  switch (type) {
    case "image": return <ImageIcon className="h-4 w-4 shrink-0" />;
    case "video": return <VideoIcon className="h-4 w-4 shrink-0" />;
    case "audio": return <MicIcon className="h-4 w-4 shrink-0" />;
    default: return <FileText className="h-4 w-4 shrink-0" />;
  }
}

function getSelectedAttachmentLabel(type: ChatAttachment["type"]): string {
  switch (type) {
    case "image": return "Image selected";
    case "video": return "Video selected";
    case "audio": return "Audio selected";
    default: return "File selected";
  }
}

export type ComposerProps = {
  /**
   * Text-only send. Composer calls this when there is no pending attachment.
   * Consumer creates the message doc. Return value is ignored.
   */
  onSend: (text: string, replyTo?: ChatMessageV1["replyTo"]) => Promise<void>;

  /**
   * Signal the local user is typing (R14). Called as the user edits the textarea; the
   * realtime transport coalesces to ≤1 frame per ~2s, so calling per keystroke is safe.
   * Optional — absent on the firestore transport (no typing broadcast).
   */
  onTyping?: () => void;

  // Attachment support
  attachmentConfig?: ChatAttachmentConfig;
  /**
   * Attachment send. Composer uploads the file to Storage first, then calls
   * this with the resulting metadata. Consumer wires it to a backend callable
   * (`startUpload`) that writes the pendingMedia doc. The processor creates
   * the message doc after moderation succeeds.
   * Required for attachment functionality.
   */
  sendAttachment?: SendAttachmentFn;

  disabled?: boolean;
  autoFocus?: boolean;
  placeholder?: string;
  mentionConfig?: import('../types.js').ChatMentionConfig;
};

/**
 * Imperative handle exposed by {@link Composer} via `ref`. Additive — ref-less
 * usage is unaffected. ChatShell holds this ref so a failed-attachment bubble's
 * "Attach again" action can re-open the canonical picker.
 */
export type ComposerHandle = {
  /**
   * Open the attachment picker, delegating to the underlying MediaInput's
   * `openSelection()`. Must be called synchronously from a user gesture. No-op
   * when attachments are not configured (the MediaInput is not mounted) or the
   * composer is disabled/sending (MediaInput's own gate no-ops it).
   */
  openAttachmentSelector: () => void;
};

export const Composer = React.forwardRef<ComposerHandle, ComposerProps>(function Composer(props, forwardedRef) {
  const {
    onSend,
    onTyping,
    attachmentConfig,
    sendAttachment,
    disabled,
    autoFocus = false,
    placeholder = "Type a message...",
  } = props;

  const [text, setText] = React.useState("");
  const [pendingFile, setPendingFile] = React.useState<File | null>(null);
  const [isSending, setIsSending] = React.useState(false);
  const [uploadState, setUploadState] = React.useState<UploadState | null>(null);
  const [sendError, setSendError] = React.useState<string | null>(null);
  const ref = React.useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = React.useRef<AbortController | null>(null);
  const mediaInputRef = React.useRef<MediaInputHandle>(null);
  const guardedUpload = useGuardedUpload();
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

  const attachEnabled = Boolean(attachmentConfig && sendAttachment);

  // focus stability: never steal focus unless explicitly enabled
  React.useEffect(() => {
    if (!autoFocus) return;
    ref.current?.focus();
  }, [autoFocus]);

  const handleFileSelected = React.useCallback((payload: MediaInputChangePayload) => {
    if (payload.error || !payload.file) {
      setPendingFile(null);
      return;
    }
    setPendingFile(payload.file);
  }, []);

  const handleCancelUpload = React.useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  // Additive imperative handle: re-open the canonical attachment picker. Delegates
  // straight to MediaInput's openSelection so onBeforeSelect / disabled / validation
  // / crop are all honored (and the disabled/sending gate is MediaInput's — it
  // receives `disabled`/`isLoading` below). No-op when attachments aren't configured
  // (MediaInput is unmounted → ref is null).
  const openAttachmentSelector = React.useCallback(() => {
    mediaInputRef.current?.openSelection();
  }, []);
  React.useImperativeHandle(forwardedRef, () => ({ openAttachmentSelector }), [openAttachmentSelector]);

  const send = async () => {
    const v = text.trim();
    if (!v && !pendingFile) return;

    setIsSending(true);
    setSendError(null);
    const sendGuardId = `chat-send-${genId()}`;
    navigationGuard?.registerUpload(sendGuardId);

    try {
      if (pendingFile && attachmentConfig && sendAttachment) {
        // Attachment path: upload first via canonical guarded upload, then register.
        const uuid = genId();
        const { uploadAdapter, userId, storage } = attachmentConfig;
        const storagePath = uploadAdapter.buildUploadPath({ userId, attachmentId: uuid });
        const extraMetadata = uploadAdapter.buildUploadMetadata?.({ userId, attachmentId: uuid }) ?? {};

        const fileToUpload = ensureFileWithContentType(pendingFile);
        const attType = getAttachmentType(fileToUpload);

        const controller = new AbortController();
        abortControllerRef.current = controller;

        await guardedUpload({
          storage,
          path: storagePath,
          file: fileToUpload,
          metadata: { contentType: fileToUpload.type, ...extraMetadata },
          uploadId: uuid,
          onProgress: (state) => setUploadState(state),
          signal: controller.signal,
        });

        await sendAttachment({
          text: mentionApi.getValueWithTokens(),
          attachment: {
            attachmentId: uuid,
            storagePath,
            originalFileName: fileToUpload.name,
            type: attType,
            size: fileToUpload.size,
          },
        });
      } else {
        // Text-only path.
        await onSend(mentionApi.getValueWithTokens());
      }

      setText("");
      setPendingFile(null);
      mentionApi.close();
    } catch (err) {
      // AbortError = user-initiated cancel via the MediaInput cancel button.
      // Clear local state and swallow — not a real failure.
      if (err instanceof Error && err.name === 'AbortError') {
        setPendingFile(null);
        return;
      }
      // C-B8: a failed send (e.g. the realtime socket was closed) must NOT clear the
      // user's text — `setText("")` only runs on the success path above — and must NOT
      // re-throw into the click handler (an unhandled rejection). Surface it so the
      // user can retry with their text intact.
      console.error("[Composer] Send failed:", err);
      setPendingFile(null);
      setSendError("Couldn't send. Check your connection and try again.");
    } finally {
      navigationGuard?.unregisterUpload(sendGuardId);
      abortControllerRef.current = null;
      setIsSending(false);
      setUploadState(null);
    }
  };

  const isDisabled = disabled || isSending;

  return (
    <div className="chat-composer">
      {pendingFile && !isSending && (
        <div className="chat-composer-file-preview">
          <AttachmentTypeIcon type={getAttachmentType(pendingFile)} />
          <span className="chat-composer-file-name">
            {getSelectedAttachmentLabel(getAttachmentType(pendingFile))}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            onClick={() => setPendingFile(null)}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

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
          disabled={isDisabled || (!text.trim() && !pendingFile)}
          onClick={send}
        >
          {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send"}
        </Button>
      </div>

      {attachEnabled && attachmentConfig && (
        <div className="mt-2">
          <MediaInput
            ref={mediaInputRef}
            spec={attachmentConfig.attachmentSpec}
            onChange={handleFileSelected}
            selectedFile={pendingFile}
            isLoading={isSending}
            uploadState={uploadState}
            disabled={isDisabled}
            buttonLabel="Attach file"
            onClear={() => setPendingFile(null)}
            onCancel={handleCancelUpload}
            className="w-full"
          />
        </div>
      )}
    </div>
  );
});
