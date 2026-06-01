// Boundary guard-test helpers.
//
// These drive the root runtime-leak audit (check #1). We follow the *built*
// import graph starting from a package's root entry (`dist/index.js`) and
// collect every bare (non-relative) module specifier it transitively reaches.
// Because we read built output, `import type`-only references are already
// erased by tsc — a type-only import is correctly seen as clean.

import { readFileSync, existsSync, statSync } from 'node:fs';
import { dirname, resolve, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// test/boundary/leak-utils.ts -> repo root is two levels up.
export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

// Client/browser-runtime specifiers that must never appear in a pure or
// server-safe package root. `*.css` is handled separately by suffix.
const FORBIDDEN_EXACT = new Set<string>([
  'react',
  'react-dom',
  'next',
  'firebase/app',
  'firebase/auth',
  'firebase/firestore',
  'firebase/storage',
  'firebase/functions',
  '@tanstack/react-query',
  'lucide-react',
]);

/** Returns the forbidden specifier if `spec` is a client/runtime leak, else null. */
export function leakReason(spec: string): string | null {
  if (spec.endsWith('.css')) return spec;
  if (FORBIDDEN_EXACT.has(spec)) return spec;
  if (spec.startsWith('react/')) return spec; // react/jsx-runtime, react/jsx-dev-runtime
  if (spec.startsWith('react-dom/')) return spec;
  if (spec.startsWith('next/')) return spec;
  return null;
}

function isDir(p: string): boolean {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}

const SPEC_PATTERNS = [
  /\bfrom\s*['"]([^'"]+)['"]/g, // import ... from '...' / export ... from '...'
  /\bimport\s*['"]([^'"]+)['"]/g, // side-effect import '...'
  /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g, // dynamic import('...')
  /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g, // CJS interop (defensive)
];

function extractSpecifiers(code: string): string[] {
  const out = new Set<string>();
  for (const re of SPEC_PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(code)) !== null) out.add(m[1]);
  }
  return [...out];
}

function resolveRelative(fromFile: string, spec: string): string | null {
  const base = resolve(dirname(fromFile), spec);
  const candidates = [base];
  const ext = extname(base);
  if (ext === '' || ext === '.js') {
    candidates.push(`${base}.js`, join(base, 'index.js'));
  }
  for (const c of candidates) {
    if (existsSync(c) && !isDir(c)) return c;
  }
  return null;
}

/** Resolve a package's root runtime entry from its `exports["."]` (or `main`). */
export function resolveRootEntry(pkgDir: string): string | null {
  const pkgJsonPath = join(pkgDir, 'package.json');
  if (!existsSync(pkgJsonPath)) return null;
  const pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf8'));
  let rel: string | undefined;
  const dot = pkgJson.exports?.['.'];
  if (typeof dot === 'string') rel = dot;
  else if (dot && typeof dot === 'object') rel = dot.default ?? dot.import ?? dot.node ?? dot.types;
  rel = rel ?? pkgJson.main;
  if (!rel) return null;
  return resolve(pkgDir, rel);
}

/** BFS the built import graph from `entry`, returning all bare specifiers reached. */
function collectBareImports(entry: string): Set<string> {
  const visited = new Set<string>();
  const bare = new Set<string>();
  const stack = [entry];
  while (stack.length > 0) {
    const file = stack.pop()!;
    if (visited.has(file)) continue;
    visited.add(file);
    if (!existsSync(file)) continue;
    const code = readFileSync(file, 'utf8');
    for (const spec of extractSpecifiers(code)) {
      if (spec.startsWith('.') || spec.startsWith('/')) {
        // Relative CSS never resolves to a JS file — record it as a leak source.
        if (spec.endsWith('.css')) {
          bare.add(spec);
          continue;
        }
        const resolved = resolveRelative(file, spec);
        if (resolved) stack.push(resolved);
        // Unresolved relative JS: ignore (do not produce false positives).
      } else {
        bare.add(spec);
      }
    }
  }
  return bare;
}

export interface RootLeakResult {
  entry: string | null;
  missing: boolean;
  leaks: string[];
}

/** Audit a package root for client/runtime leaks. */
export function auditRootLeaks(pkgDir: string): RootLeakResult {
  const entry = resolveRootEntry(pkgDir);
  if (!entry) return { entry: null, missing: true, leaks: [] };
  if (!existsSync(entry)) return { entry, missing: true, leaks: [] };
  const bare = collectBareImports(entry);
  const leaks = [...bare]
    .map((s) => leakReason(s))
    .filter((s): s is string => s !== null);
  return { entry, missing: false, leaks: [...new Set(leaks)] };
}
