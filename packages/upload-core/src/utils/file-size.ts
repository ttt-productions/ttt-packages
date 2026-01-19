export function getFileSize(file: Blob | File): number {
    const anyFile = file as any;
    const size = anyFile?.size;
    return typeof size === "number" && size >= 0 ? size : 0;
  }
  