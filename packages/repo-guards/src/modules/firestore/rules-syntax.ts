export function maskStrings(code: string): string {
  const chars = code.split('');
  let quote: string | null = null;
  for (let i = 0; i < chars.length; i += 1) {
    const c = chars[i];
    if (quote) {
      if (c === '\\') {
        chars[i] = ' ';
        if (i + 1 < chars.length && chars[i + 1] !== '\n') chars[i + 1] = ' ';
        i += 1;
      } else if (c === quote || c === '\n') quote = null;
      else chars[i] = ' ';
    } else if (c === '"' || c === "'") quote = c;
  }
  return chars.join('');
}

function braceMap(masked: string): Map<number, number> {
  const pairs = new Map<number, number>();
  const stack: number[] = [];
  for (let i = 0; i < masked.length; i += 1) {
    if (masked[i] === '{') stack.push(i);
    else if (masked[i] === '}') {
      const open = stack.pop();
      if (open !== undefined) pairs.set(open, i);
    }
  }
  for (const open of stack) pairs.set(open, masked.length);
  return pairs;
}

export interface MatchBlock {
  readonly path: string;
  readonly segments: readonly string[];
  readonly parent: MatchBlock | null;
  readonly index: number;
  readonly open: number;
  readonly close: number;
}

const MATCH_HEADER = /\bmatch\s+((?:\/(?:\{[^{}\s]*\}|[^\s/{}]+))+)\s*\{/g;

const splitPath = (path: string) => path.split('/').filter(Boolean);

export function matchBlocks(code: string): MatchBlock[] {
  const masked = maskStrings(code);
  const braces = braceMap(masked);
  const blocks: MatchBlock[] = [];
  for (const m of masked.matchAll(MATCH_HEADER)) {
    const index = m.index as number;
    const open = index + m[0].length - 1;
    const close = braces.get(open) ?? masked.length;
    let parent: MatchBlock | null = null;
    for (const b of blocks)
      if (b.open < index && index < b.close && (!parent || b.open > parent.open)) parent = b;
    const own = splitPath(m[1]);
    blocks.push({
      path: m[1],
      segments: [...(parent?.segments ?? []), ...own],
      parent,
      index,
      open,
      close,
    });
  }
  return blocks;
}

export interface RulesFunction {
  readonly name: string;
  readonly params: readonly string[];
  readonly index: number;
  readonly body: string;
  readonly bodyStart: number;
  readonly bodyEnd: number;
}

const FUNCTION_HEADER = /\bfunction\s+([A-Za-z_$][\w$]*)\s*\(([^)]*)\)\s*\{/g;

export function rulesFunctions(code: string): Map<string, RulesFunction> {
  const masked = maskStrings(code);
  const braces = braceMap(masked);
  const out = new Map<string, RulesFunction>();
  for (const m of masked.matchAll(FUNCTION_HEADER)) {
    if (out.has(m[1])) continue;
    const open = (m.index as number) + m[0].length - 1;
    const close = braces.get(open) ?? masked.length;
    out.set(m[1], {
      name: m[1],
      params: m[2]
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean),
      index: m.index as number,
      body: code.slice(open + 1, close),
      bodyStart: open + 1,
      bodyEnd: close,
    });
  }
  return out;
}

export function enclosingFunction(
  functions: Map<string, RulesFunction>,
  index: number,
): RulesFunction | null {
  for (const f of functions.values()) if (f.bodyStart <= index && index < f.bodyEnd) return f;
  return null;
}

const CALL = /(?<![.\w$])([A-Za-z_$][\w$]*)\s*\(/g;

export function calledFunctions(text: string, functions: Map<string, RulesFunction>): string[] {
  const names: string[] = [];
  for (const m of maskStrings(text).matchAll(CALL))
    if (functions.has(m[1]) && !names.includes(m[1])) names.push(m[1]);
  return names;
}

export function expandedBody(name: string, functions: Map<string, RulesFunction>): string {
  const seen = new Set<string>();
  const parts: string[] = [];
  const visit = (n: string) => {
    const f = functions.get(n);
    if (!f || seen.has(n)) return;
    seen.add(n);
    parts.push(f.body);
    for (const called of calledFunctions(f.body, functions)) visit(called);
  };
  visit(name);
  return parts.join('\n;\n');
}

export interface DocumentPathLiteral {
  readonly index: number;
  readonly segments: readonly string[];
  readonly text: string;
}

const DOCUMENT_PATH =
  /\/databases\/(?:\$\(\s*[\w$]+\s*\)|\(default\))\/documents((?:\/(?:\$\([^()]*\)|[\w-]+))+)/g;

export function documentPathLiterals(code: string): DocumentPathLiteral[] {
  const masked = maskStrings(code);
  return [...masked.matchAll(DOCUMENT_PATH)].map((m) => ({
    index: m.index as number,
    text: m[0],
    segments: splitPath(m[1]).map((s) => (s.startsWith('$(') ? '{}' : s)),
  }));
}

export const isVariable = (segment: string) => /^\{[^{}]*\}$/.test(segment);
export const isRecursive = (segment: string) => /^\{[^{}=]*=\*\*\}$/.test(segment);

export const wildcardPath = (segments: readonly string[]) =>
  segments.map((s) => (isVariable(s) ? '{}' : s)).join('/');

export const normalizeDeclared = (path: string) => wildcardPath(splitPath(path));

export { splitPath };
