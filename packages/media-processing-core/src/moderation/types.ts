import type { MediaModerationResult, MediaProcessingSpec } from '@ttt-productions/media-schemas';

export interface ModerationInput {
  spec: MediaProcessingSpec;
  kind: 'image' | 'video' | 'audio' | 'generic';
  localPath: string;
  mime?: string;
}

export interface ModerationOutput {
  spec: MediaProcessingSpec;
  kind: 'image' | 'video' | 'audio' | 'generic';
  outputs: Array<{
    key: string;
    localPath: string;
    mime?: string;
  }>;
}

export interface ModerationAdapter {
  provider: string;

  moderateInput?: (input: ModerationInput) => Promise<MediaModerationResult | null | undefined>;

  moderateOutput?: (output: ModerationOutput) => Promise<MediaModerationResult | null | undefined>;
}
