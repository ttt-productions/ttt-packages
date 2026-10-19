// The repository root every boundary test resolves its paths from.

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// test/boundary/leak-utils.ts -> repo root is two levels up.
export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
