export const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const isUnder = (path: string, folder: string): boolean =>
  path === folder || path.startsWith(`${folder.replace(/\/$/, '')}/`);
