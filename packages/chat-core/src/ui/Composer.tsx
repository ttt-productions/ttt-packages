"use client";

import * as React from "react";
import { Button, Textarea, cn } from "@ttt-productions/ui-core";
import { MediaInput } from "@ttt-productions/file-input";
import type { MediaInputChangePayload } from "@ttt-productions/file-input";
import { uploadFileResumable } from "@ttt-productions/upload-core";
import type { Firestore } from "firebase/firestore";
import { doc, setDoc, collection as firestoreCollection } from "firebase/firestore";
import { Loader2, X, FileText, ImageIcon, VideoIcon, MicIcon } from "lucide-react";
import type { ChatAttachment, ChatAttachmentConfig } from "../types";

function genId(): string {
  return `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

function getAttachmentType(file: File): ChatAttachment["type"] {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return "audio";
  return "text";
}

function getFileExt(file: File): string {
  const parts = file.name.split(".");
  return parts.length > 1 ? parts[parts.length - 1]! : "bin";
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
  onSend: (text: string, attachment?: ChatAttachment) => void | Promise<void>;

  // Attachment support — all three required to enable
  attachmentConfig?: ChatAttachmentConfig;
  /** Firestore instance for writing pendingMedia doc */
  db?: Firestore;
  /** Current user ID for the pending media upload path */
  currentUserId?: string;

  disabled?: boolean;
  autoFocus?: boolean;
  placeholder?: string;
};

export function Composer(props: ComposerProps) {
  const {
    onSend,
    attachmentConfig,
    db,
    currentUserId,
    disabled,
    autoFocus = false,
    placeholder = "Type a message...",
  } = props;

  const [text, setText] = React.useState("");
  const [pendingFile, setPendingFile] = React.useState<File | null>(null);
  const [isSending, setIsSending] = React.useState(false);
  const [uploadProgress, setUploadProgress] = React.useState<number | null>(null);
  const ref = React.useRef<HTMLTextAreaElement>(null);

  const attachEnabled = Boolean(attachmentConfig && db && currentUserId);

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

      if (pendingFile && attachmentConfig && db && currentUserId) {
        const uuid = genId();
        const ext = getFileExt(pendingFile);
        const storagePath = `${attachmentConfig.pendingStoragePath}/${uuid}.${ext}`;
        const pendingCollection = attachmentConfig.pendingMediaCollection || "pendingMedia";
        const attType = getAttachmentType(pendingFile);

        // 1. Upload file to pending storage path
        setUploadProgress(0);
        await uploadFileResumable({
          storage: attachmentConfig.storage,
          path: storagePath,
          file: pendingFile,
          metadata: { contentType: pendingFile.type || "application/octet-stream" },
          onProgress: ({ percent }) => setUploadProgress(percent),
        });
        setUploadProgress(null);

        // Build the attachment object (status pending — will be sent with the message)
        attachment = {
          id: uuid,
          name: pendingFile.name,
          type: attType,
          size: pendingFile.size,
          status: "pending",
          pendingStoragePath: storagePath,
        };

        // 2. Write the pendingMedia Firestore doc
        // Note: targetDocPath will be set by the app's onSend handler since it knows the message doc path
        const pendingDocRef = doc(firestoreCollection(db, pendingCollection), uuid);
        await setDoc(pendingDocRef, {
          id: uuid,
          userId: currentUserId,
          fileOrigin: "chat-attachment",
          originalFileName: pendingFile.name,
          pendingStoragePath: storagePath,
          status: "pending",
          createdAt: Date.now(),
        });
      }

      await onSend(v, attachment);

      setText("");
      setPendingFile(null);
    } catch (err) {
      console.error("[Composer] Send failed:", err);
      // Remove the optimistic attachment preview on failure
      setPendingFile(null);
      setUploadProgress(null);
      // Re-throw so the app can show an error toast
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
