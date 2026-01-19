import { joinPath } from "@ttt-productions/firebase-helpers";
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
  
  // Sanitize segments for security (traversal prevention)
  const segments = [basePath, ownerId, contentId]
    .filter((p): p is string => !!p)
    .map(sanitizeSegment);

  const filePart = filename ? normalizeFilename(filename) : "file";

  // Use shared helper to robustly join them
  return joinPath(...segments, filePart);
}