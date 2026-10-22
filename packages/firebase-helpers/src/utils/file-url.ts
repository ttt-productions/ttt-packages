export function getFileNameFromUrl(url: string): string {
  try {
    const pathStartIndex = url.indexOf('/o/');
    if (pathStartIndex === -1) return '';

    let filePath = url.substring(pathStartIndex + 3);
    const queryIndex = filePath.indexOf('?');
    if (queryIndex !== -1) {
      filePath = filePath.substring(0, queryIndex);
    }

    filePath = decodeURIComponent(filePath);
    const pathParts = filePath.split('/');
    return pathParts[pathParts.length - 1] ?? '';
  } catch {
    return '';
  }
}
