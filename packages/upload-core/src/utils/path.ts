import { normalizeFilename } from "./filename";

function sanitizeSegment(seg: string): string {
  const s = String(seg ?? "").trim();
  // Remove slashes and collapse dot-runs to avoid traversal.
  const noSlashes = s.replace(/[\\/]+/g, "_");
  const noDots = noSlashes.replace(/\.+/g, ".");
  const cleaned = noDots.replace(/[^a-zA-Z0-9._-]/g, "_");
  const trimmed = cleaned.replace(/^\.+/, "").replace(/\.+$/, "");
  return trimmed.slice(0, 80) || "_";
}

export function buildUploadPath(args: {
  basePath: string;
  ownerId?: string;
  contentId?: string;
  filename?: string;
}) {
  const { basePath, ownerId, contentId, filename } = args;

  const parts = [basePath, ownerId, contentId]
    .filter(Boolean)
    .map((p) => sanitizeSegment(p as string));
  const prefix = parts.join("/").replace(/\/+/g, "/").replace(/\/$/, "");

  const filePart = filename ? normalizeFilename(filename) : "file";
  return `${prefix}/${filePart}`.replace(/\/+/g, "/");
}
