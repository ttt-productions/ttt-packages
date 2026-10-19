// Text helpers every guard area shares. Internal to the package: no public entry exports them.

/** A string matched literally inside a regular expression. */
export const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** True when a repo-relative `path` is `folder` itself or lies under it; a trailing slash on `folder` is ignored. */
export const isUnder = (path: string, folder: string): boolean =>
  path === folder || path.startsWith(`${folder.replace(/\/$/, '')}/`);
