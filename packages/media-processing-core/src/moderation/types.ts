import type { MediaModerationResult, MediaProcessingSpec } from "@ttt-productions/media-contracts";

export interface ModerationInput {
  spec: MediaProcessingSpec;
  kind: "image" | "video" | "audio" | "generic";
  localPath: string;
  mime?: string;
}

export interface ModerationOutput {
  spec: MediaProcessingSpec;
  kind: "image" | "video" | "audio" | "generic";
  outputs: Array<{
    key: string;
    localPath: string;
    mime?: string;
  }>;
}

export interface ModerationAdapter {
  provider: string;

  /** Run on the ORIGINAL uploaded file before processing. */
  moderateInput?: (input: ModerationInput) => Promise<MediaModerationResult | null | undefined>;

  /** Run on PROCESSED outputs after processing. */
  moderateOutput?: (output: ModerationOutput) => Promise<MediaModerationResult | null | undefined>;
}
