'use client';

import { useIosSafariFixes } from '../ios/useIosSafariFixes.js';
import type { CssPrefixOptions } from '../css-prefix.js';

export function IOSSetup(props: CssPrefixOptions = {}) {
  useIosSafariFixes(props);
  return null;
}
