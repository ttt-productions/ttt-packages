// The one remover of a Storage object's Firebase download token. The Firebase Storage client gives
// every object it uploads a `firebaseStorageDownloadTokens` metadata entry: a never-expiring link
// that reads the object signed out, around the Storage rules. An app that serves no object through
// one removes it as soon as the server takes the object over.

/** The one method of a Storage object handle this module uses. */
export interface DownloadTokenWritable {
  setMetadata(update: { metadata: Record<string, string | null> }): Promise<unknown>;
}

/** The custom-metadata key the Firebase Storage client writes on upload. */
const DOWNLOAD_TOKENS_KEY = 'firebaseStorageDownloadTokens';

/** True when the object's stored metadata still carries a download token. */
export function hasDownloadToken(
  objectMetadata: Readonly<Record<string, unknown>> | undefined,
): boolean {
  const custom = objectMetadata?.['metadata'];
  return typeof custom === 'object' && custom !== null && DOWNLOAD_TOKENS_KEY in custom;
}

/**
 * Remove the object's download token and nothing else: a null custom-metadata value deletes that
 * one key, leaving every other entry. A no-op write when the object has none.
 */
export async function removeDownloadToken(file: DownloadTokenWritable): Promise<void> {
  await file.setMetadata({ metadata: { [DOWNLOAD_TOKENS_KEY]: null } });
}
