'use client';

import { useState } from 'react';

export function useSerializedIdentity<T>(value: T, serialized: string): T {
  const [held, setHeld] = useState({ serialized, value });
  if (held.serialized !== serialized) {
    setHeld({ serialized, value });
    return value;
  }
  return held.value;
}
