// functions-only helpers for firebase-admin storage
// kept minimal so handlers stay thin

export function buildStoragePath(
    basePath: string,
    filename: string
  ): string {
    return `${basePath}/${filename}`.replace(/\/+/g, "/");
  }
  