export function getFileSize(file: Blob | File): number {
  const size: unknown = (file as Partial<Blob> | null | undefined)?.size;
  return typeof size === 'number' && size >= 0 ? size : 0;
}
