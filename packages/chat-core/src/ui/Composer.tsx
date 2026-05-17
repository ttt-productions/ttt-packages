"use client";

import * as React from "react";
import { Button, Textarea } from "@ttt-productions/ui-core/react";
import { cn } from "@ttt-productions/ui-core";
import { ensureFileWithContentType } from "@ttt-productions/file-input";
import { MediaInput } from "@ttt-productions/file-input/react";
import type { MediaInputChangePayload, UploadState } from "@ttt-productions/file-input";
import type { FileOrigin } from "@ttt-productions/media-contracts";
import { buildTempUploadPath } from "@ttt-productions/ttt-core";
import { uploadFileResumable } from "@ttt-productions/upload-core/browser";
import { Loader2, X, FileText, ImageIcon, VideoIcon, MicIcon } from "lucide-react";
import type { ChatAttachment, ChatAttachmentConfig, ChatMessageV1, SendAttachmentFn } from "../types.js";

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

export type ComposerProps = {
  /**
   * Text-only send. Composer calls this when there is no pending attachment.
   * Consumer creates the message doc. Return value is ignored.
   */
  onSend: (text: string, replyTo?: ChatMessageV1["replyTo"]) => Promise<void>;

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
};

export function Composer(props: ComposerProps) {
  const {
    onSend,
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
  const ref = React.useRef<HTMLTextAreaElement>(null);

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

  const send = async () => {
    const v = text.trim();
    if (!v && !pendingFile) return;

    setIsSending(true);

    try {
      if (pendingFile && attachmentConfig && sendAttachment) {
        // Attachment path: upload first, then register.
        const uuid = genId();
        const FILE_ORIGIN: FileOrigin = "chat-attachment";
        const storagePath = buildTempUploadPath(FILE_ORIGIN, attachmentConfig.userId, uuid);

        const fileToUpload = ensureFileWithContentType(pendingFile);
        const attType = getAttachmentType(fileToUpload);

        setUploadState({ phase: 'preparing', percent: null });
        await uploadFileResumable({
          storage: attachmentConfig.storage,
          path: storagePath,
          file: fileToUpload,
          metadata: { contentType: fileToUpload.type },
          onProgress: ({ percent }) => setUploadState({ phase: 'uploading', percent }),
        });
        setUploadState({ phase: 'finalizing', percent: null });

        await sendAttachment({
          text: v,
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
        await onSend(v);
      }

      setText("");
      setPendingFile(null);
    } catch (err) {
      console.error("[Composer] Send failed:", err);
      setPendingFile(null);
      throw err;
    } finally {
      setIsSending(false);
      setUploadState(null);
    }
  };

  const isDisabled = disabled || isSending;

  return (
    <div className="chat-composer">
      {/* Pending file preview */}
      {pendingFile && !isSending && (
        <div className="chat-composer-file-preview">
          <AttachmentTypeIcon type={getAttachmentType(pendingFile)} />
          <span className="chat-composer-file-name">{pendingFile.name}</span>
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

      {/* Text + send row */}
      <div className="flex items-end gap-2">
        <Textarea
          ref={ref}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          disabled={isDisabled}
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
          disabled={isDisabled || (!text.trim() && !pendingFile)}
          onClick={send}
        >
          {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send"}
        </Button>
      </div>

      {/* Attachment picker */}
      {attachEnabled && attachmentConfig && (
        <div className="mt-2">
          <MediaInput
            spec={attachmentConfig.attachmentSpec}
            onChange={handleFileSelected}
            selectedFile={pendingFile}
            isLoading={isSending}
            uploadState={uploadState}
            disabled={isDisabled}
            buttonLabel="Attach file"
            onClear={() => setPendingFile(null)}
            className="w-full"
          />
        </div>
      )}
    </div>
  );
}
