export interface MediaInputSource {
  readToFile(localPath: string): Promise<void>;

  mime?: string;
}

export interface MediaOutputTarget {
  writeFromFile(
    localPath: string,
    outputKey: string,
  ): Promise<{
    url?: string;
    path?: string;
  }>;
}

export interface MediaIO {
  input: MediaInputSource;
  output: MediaOutputTarget;
}
