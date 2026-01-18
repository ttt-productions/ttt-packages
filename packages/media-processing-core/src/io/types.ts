export interface MediaInputSource {
    /** Copy source media into localPath */
    readToFile(localPath: string): Promise<void>;
  
    /** Optional mime hint */
    mime?: string;
  }
  
  export interface MediaOutputTarget {
    /** Persist a processed file from localPath */
    writeFromFile(localPath: string, outputKey: string): Promise<{
      url?: string;
      path?: string;
    }>;
  }
  
  export interface MediaIO {
    input: MediaInputSource;
    output: MediaOutputTarget;
  }
  