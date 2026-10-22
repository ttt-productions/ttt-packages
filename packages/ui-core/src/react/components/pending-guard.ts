import type * as React from 'react';

export function blockEvent(event: React.SyntheticEvent) {
  event.preventDefault();
  event.stopPropagation();
}

const ACTIVATION_KEYS = new Set([' ', 'Enter', 'ArrowUp', 'ArrowDown']);

export function blockActivationKey(event: React.KeyboardEvent) {
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  if (ACTIVATION_KEYS.has(event.key) || event.key.length === 1) blockEvent(event);
}
