export function validateSize(
    bytes: number,
    maxBytes: number
  ): boolean {
    return bytes <= maxBytes;
  }
  