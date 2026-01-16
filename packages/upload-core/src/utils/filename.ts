export function normalizeFilename(name: string): string {
    const trimmed = (name || "").trim();
    if (!trimmed) return "file";
  
    // keep extension if present
    const lastDot = trimmed.lastIndexOf(".");
    const base = lastDot > 0 ? trimmed.slice(0, lastDot) : trimmed;
    const ext = lastDot > 0 ? trimmed.slice(lastDot).toLowerCase() : "";
  
    const safeBase = base
      .toLowerCase()
      .replace(/[^a-z0-9-_ ]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  
    return `${safeBase || "file"}${ext}`;
  }
  