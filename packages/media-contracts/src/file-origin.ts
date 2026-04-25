export type FileOrigin =
  | 'profile-picture'
  | 'skill-media'
  | 'streetz'
  | 'job-posting'
  | 'job-reply'
  | 'opportunity-prompt'
  | 'opportunity-reply'
  | 'library-cover-square'
  | 'library-cover-poster'
  | 'library-cover-cinematic'
  | 'chapter-photo'
  | 'song-photo'
  | 'song-audio'
  | 'show-photo'
  | 'show-video'
  | 'chat-attachment';

export interface PendingFile {
  id: string;
  userId: string;
  fileOrigin: FileOrigin;
  originalFileName: string;
  pendingStoragePath: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'rejected';
  createdAt: number;
  errorMessage?: string;
  targetInfo?: any;
  targetDocPath?: string;
  targetFields?: { [key: string]: string };
  textContent?: string;
}
