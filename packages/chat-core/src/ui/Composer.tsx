"use client";

import * as React from "react";
import { Button, Textarea, cn } from "@ttt-productions/ui-core";
import { MediaInput, ensureFileWithContentType } from "@ttt-productions/file-input";
import type { MediaInputChangePayload } from "@ttt-productions/file-input";
import type { FileOrigin } from "@ttt-productions/media-contracts";
import { uploadFileResumable } from "@ttt-productions/upload-core";
import { Loader2, X, FileText, ImageIcon, VideoIcon, MicIcon } from "lucide-react";
import type { ChatAttachment, ChatAttachmentConfig, SendChatAttachmentFn } from "../types";

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
  onSend: (
    text: string,
    attachment?: ChatAttachment
  ) => Promise<{ messageDocPath: string; attachmentId?: string }> | Promise<void>;

  // Attachment support
  attachmentConfig?: ChatAttachmentConfig;
  /**
   * Called after upload + onSend, to hand off the pendingMedia creation
   * to the consumer app (which will call a backend callable).
   * Required for attachment functionality.
   */
  sendAttachment?: SendChatAttachmentFn;

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
  const [uploadProgress, setUploadProgress] = React.useState<number | null>(null);
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
      let attachment: ChatAttachment | undefined;
      let uploadStoragePath: string | undefined;
      let originalFileName: string | undefined;

      if (pendingFile && attachmentConfig && sendAttachment) {
        const uuid = genId();
        const FILE_ORIGIN: FileOrigin = "chat-attachment";
        const storagePath = `uploads/${FILE_ORIGIN}/${attachmentConfig.userId}/${uuid}`;

        const fileToUpload = ensureFileWithContentType(pendingFile);
        const attType = getAttachmentType(fileToUpload);

        setUploadProgress(0);
        await uploadFileResumable({
          storage: attachmentConfig.storage,
          path: storagePath,
          file: fileToUpload,
          metadata: { contentType: fileToUpload.type },
          onProgress: ({ percent }) => setUploadProgress(percent),
        });
        setUploadProgress(null);

        attachment = {
          id: uuid,
          name: fileToUpload.name,
          type: attType,
          size: fileToUpload.size,
          status: "pending",
          pendingStoragePath: storagePath,
        };

        uploadStoragePath = storagePath;
        originalFileName = fileToUpload.name;
      }

      const sendResult = await onSend(v, attachment);

      // If an attachment was included, the consumer MUST have returned a messageDocPath.
      if (attachment && uploadStoragePath && originalFileName) {
        const messageDocPath = (sendResult as { messageDocPath?: string } | undefined)?.messageDocPath;
        if (!messageDocPath) {
          throw new Error(
            "[Composer] onSend did not return a messageDocPath. Attachments require the consumer to return { messageDocPath } from onSend."
          );
        }
        const attachmentId =
          (sendResult as { attachmentId?: string } | undefined)?.attachmentId ?? attachment.id;

        // sendAttachment is guaranteed defined because attachEnabled gated this branch.
        await sendAttachment!({
          uploadStoragePath,
          originalFileName,
          messageDocPath,
          attachmentId,
        });
      }

      setText("");
      setPendingFile(null);
    } catch (err) {
      console.error("[Composer] Send failed:", err);
      setPendingFile(null);
      setUploadProgress(null);
      throw err;
    } finally {
      setIsSending(false);
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

      {/* Upload progress */}
      {isSending && uploadProgress != null && (
        <div className="chat-composer-upload-status">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span className="text-xs text-muted-foreground">
            Uploading {Math.round(uploadProgress)}%...
          </span>
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
            isLoading={isSending && uploadProgress != null}
            uploadProgress={uploadProgress ?? undefined}
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
