import { expect } from 'vitest';

// Vitest types its asymmetric matchers as any; these hand them back as unknown, so no any reaches a test.
export const anyInstanceOf = (constructor: unknown): unknown => expect.any(constructor);
export const anything = (): unknown => expect.anything();
