export function joinPath(...parts: string[]) {
    return parts
      .filter(Boolean)
      .join("/")
      .replace(/\/+/g, "/");
  }
  