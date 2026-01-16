export function validateMime(
    mime: string,
    allowed: string[]
  ): boolean {
    return allowed.includes(mime);
  }
  