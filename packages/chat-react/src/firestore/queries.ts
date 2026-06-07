function normalizeSegments(path: string | string[]): string[] {
  return Array.isArray(path) ? path : [path];
}

export function threadDocPath(chatCollectionPath: string | string[], threadId: string): string[] {
  return [...normalizeSegments(chatCollectionPath), threadId];
}

export function messagesColPath(
  chatCollectionPath: string | string[],
  threadId: string,
  messagesSubcollection = "messages"
): [string, string, ...string[]] {
  const segments = [...normalizeSegments(chatCollectionPath), threadId, messagesSubcollection];
  return segments as [string, string, ...string[]];
}