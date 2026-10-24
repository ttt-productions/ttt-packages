import { readdirSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import * as uploadVariables from '../src/upload-variables/index.js';

const VARIABLES_DIR = new URL('../src/upload-variables/', import.meta.url);

const variablesModules = readdirSync(VARIABLES_DIR, { recursive: true, encoding: 'utf8' }).filter(
  (file) => file.endsWith('.ts') && !/(^|[\\/])index\.ts$/.test(file),
);

describe('the upload-variables entry', () => {
  it('exports every variables schema the folder declares', async () => {
    const entry: Record<string, unknown> = uploadVariables;
    let found = 0;
    for (const file of variablesModules) {
      // An import of a computed URL is typed any; a module namespace maps export names to values.
      const mod = (await import(new URL(file, VARIABLES_DIR).href)) as Record<string, unknown>;
      for (const [name, value] of Object.entries(mod)) {
        if (!name.endsWith('VariablesSchema')) continue;
        found += 1;
        expect(entry[name], `${name} is not exported from the upload-variables entry`).toBe(value);
      }
    }
    expect(found).toBeGreaterThan(0);
  });
});
