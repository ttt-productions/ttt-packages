import { normalizeFilename } from "./filename";

export function buildUploadPath(args: {
  basePath: string;
  ownerId?: string;
  contentId?: string;
  filename?: string;
}) {
  const { basePath, ownerId, contentId, filename } = args;

  const parts = [basePath, ownerId, contentId].filter(Boolean) as string[];
  const prefix = parts.join("/").replace(/\/+/g, "/").replace(/\/$/, "");

  const filePart = filename ? normalizeFilename(filename) : "file";
  return `${prefix}/${filePart}`.replace(/\/+/g, "/");
}
