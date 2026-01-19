import path from "node:path";

// Very conservative key sanitizer. Prevents path traversal / separators.
export function sanitizeKey(key: string): string {
  const k = String(key ?? "");
  const stripped = k.replace(/[\\/]+/g, "_");
  const cleaned = stripped.replace(/\.+/g, "."); // collapse long dot runs
  const safe = cleaned.replace(/[^a-zA-Z0-9._-]/g, "_");
  return safe.slice(0, 80) || "file";
}

export function safeOutputPathFor(base: string, key: string, ext: string): string {
  const safeKey = sanitizeKey(key);
  const safeExt = sanitizeKey(ext).replace(/^\./, "");
  const dir = path.dirname(base);
  const baseName = path.basename(base);
  const out = path.join(dir, `${baseName}_${safeKey}.${safeExt}`);

  const resolvedDir = path.resolve(dir);
  const resolvedOut = path.resolve(out);
  if (!resolvedOut.startsWith(resolvedDir + path.sep) && resolvedOut !== resolvedDir) {
    throw new Error("Unsafe output path");
  }

  return out;
}
