export interface DownloadTokenWritable {
  setMetadata(update: { metadata: Record<string, string | null> }): Promise<unknown>;
}

const DOWNLOAD_TOKENS_KEY = 'firebaseStorageDownloadTokens';

export function hasDownloadToken(
  objectMetadata: Readonly<Record<string, unknown>> | undefined,
): boolean {
  const custom = objectMetadata?.['metadata'];
  return typeof custom === 'object' && custom !== null && DOWNLOAD_TOKENS_KEY in custom;
}

export async function removeDownloadToken(file: DownloadTokenWritable): Promise<void> {
  await file.setMetadata({ metadata: { [DOWNLOAD_TOKENS_KEY]: null } });
}
