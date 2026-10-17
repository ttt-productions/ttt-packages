// Reading a stylesheet's structure for the UI guards. Every function here takes a stylesheet's
// comment-blanked `code`, so an index it reports is an index into the file and its line is real.

/** One declaration directly inside a block. */
export interface CssDeclaration {
  property: string;
  value: string;
  /** Index of the property's first character. */
  index: number;
}

/** One block: a style rule (`.a, .b { … }`) or an at-rule block (`@media …`, `@theme`, `@layer x`). */
export interface CssBlock {
  prelude: string;
  /** Index of the prelude's first character. */
  index: number;
  atRule: boolean;
  /** The preludes of the at-rule blocks that contain this one, outermost first. */
  within: readonly string[];
  /** The declarations directly in this block; nested blocks hold their own. */
  declarations: CssDeclaration[];
}

/** A top-level statement: an at-rule ending in `;`, or a block, with its index. */
export interface CssStatement {
  /** The statement's text, whitespace flattened (a block's body is left out). */
  text: string;
  index: number;
  /** For a block: the index just past its `{`. */
  bodyIndex?: number;
}

const flat = (s: string) => s.replace(/\s+/g, ' ').trim();

/** Splits on a separator outside parentheses, brackets, and quotes. */
export function splitTopLevel(value: string, separator: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let start = 0;
  for (let i = 0; i < value.length; i += 1) {
    const c = value[i];
    if (quote) {
      if (c === '\\') i += 1;
      else if (c === quote) quote = null;
    } else if (c === '"' || c === "'") quote = c;
    else if (c === '(' || c === '[') depth += 1;
    else if (c === ')' || c === ']') depth -= 1;
    else if (c === separator && depth === 0) {
      out.push(value.slice(start, i));
      start = i + 1;
    }
  }
  out.push(value.slice(start));
  return out.map((s) => s.trim()).filter(Boolean);
}

/** The compound a selector styles: what follows its last combinator outside parentheses. */
export function subjectCompound(selector: string): string {
  let depth = 0;
  let quote: string | null = null;
  let start = 0;
  const s = selector.trim();
  for (let i = 0; i < s.length; i += 1) {
    const c = s[i];
    if (quote) {
      if (c === quote) quote = null;
    } else if (c === '"' || c === "'") quote = c;
    else if (c === '(' || c === '[') depth += 1;
    else if (c === ')' || c === ']') depth -= 1;
    else if (depth === 0 && (c === ' ' || c === '>' || c === '+' || c === '~')) start = i + 1;
  }
  return s.slice(start).trim();
}

/** Every block in a stylesheet, in source order, nested ones included. */
export function cssBlocks(code: string): CssBlock[] {
  const out: CssBlock[] = [];
  const walk = (from: number, to: number, within: readonly string[]): void => {
    let segmentStart = from;
    let quote: string | null = null;
    let parens = 0;
    for (let i = from; i < to; i += 1) {
      const c = code[i];
      if (quote) {
        if (c === '\\') i += 1;
        else if (c === quote) quote = null;
        continue;
      }
      if (c === '"' || c === "'") quote = c;
      else if (c === '(') parens += 1;
      else if (c === ')') parens -= 1;
      else if (c === ';' && parens === 0) segmentStart = i + 1;
      else if (c === '{') {
        const close = matchingBrace(code, i, to);
        const raw = code.slice(segmentStart, i);
        const lead = raw.length - raw.trimStart().length;
        const prelude = flat(raw);
        const block: CssBlock = {
          prelude,
          index: segmentStart + lead,
          atRule: prelude.startsWith('@'),
          within,
          declarations: ownDeclarations(code, i + 1, close),
        };
        out.push(block);
        walk(i + 1, close, block.atRule ? [...within, prelude] : within);
        i = close;
        segmentStart = close + 1;
      } else if (c === '}') segmentStart = i + 1;
    }
  };
  walk(0, code.length, []);
  return out;
}

function matchingBrace(code: string, open: number, limit: number): number {
  let depth = 0;
  let quote: string | null = null;
  for (let i = open; i < limit; i += 1) {
    const c = code[i];
    if (quote) {
      if (c === '\\') i += 1;
      else if (c === quote) quote = null;
    } else if (c === '"' || c === "'") quote = c;
    else if (c === '{') depth += 1;
    else if (c === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return limit;
}

/** The declarations directly between `from` and `to`, nested blocks and their preludes left out. */
function ownDeclarations(code: string, from: number, to: number): CssDeclaration[] {
  const out: CssDeclaration[] = [];
  let segmentStart = from;
  let quote: string | null = null;
  let parens = 0;
  const take = (end: number) => {
    const raw = code.slice(segmentStart, end);
    const colon = raw.indexOf(':');
    if (colon > 0) {
      const property = raw.slice(0, colon).trim();
      if (/^-{0,2}[a-zA-Z][\w-]*$/.test(property)) {
        out.push({ property: property.startsWith('--') ? property : property.toLowerCase(), value: flat(raw.slice(colon + 1)), index: segmentStart + raw.indexOf(property) });
      }
    }
  };
  for (let i = from; i < to; i += 1) {
    const c = code[i];
    if (quote) {
      if (c === '\\') i += 1;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'") quote = c;
    else if (c === '(') parens += 1;
    else if (c === ')') parens -= 1;
    else if (c === ';' && parens === 0) {
      take(i);
      segmentStart = i + 1;
    } else if (c === '{') {
      i = matchingBrace(code, i, to);
      segmentStart = i + 1;
    }
  }
  take(to);
  return out;
}

/** The stylesheet's top-level statements in order: `@…;` statements and blocks. */
export function topLevelStatements(code: string): CssStatement[] {
  const out: CssStatement[] = [];
  let segmentStart = 0;
  let quote: string | null = null;
  let parens = 0;
  const push = (end: number, bodyIndex?: number) => {
    const raw = code.slice(segmentStart, end);
    const text = flat(raw);
    if (text) out.push({ text, index: segmentStart + (raw.length - raw.trimStart().length), bodyIndex });
  };
  for (let i = 0; i < code.length; i += 1) {
    const c = code[i];
    if (quote) {
      if (c === '\\') i += 1;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'") quote = c;
    else if (c === '(') parens += 1;
    else if (c === ')') parens -= 1;
    else if (c === ';' && parens === 0) {
      push(i);
      segmentStart = i + 1;
    } else if (c === '{') {
      push(i, i + 1);
      i = matchingBrace(code, i, code.length);
      segmentStart = i + 1;
    }
  }
  push(code.length);
  return out;
}

/** An `@import` statement read: what it names, and the layer it joins (`''` for an anonymous one). */
export function parseImport(statement: string): { spec: string; layer: string | null } | null {
  const m = /^@import\s+(?:url\(\s*)?["']([^"']+)["']\s*\)?\s*(?:layer\(\s*([^)]*?)\s*\)|(layer)\b)?/.exec(statement);
  if (!m) return null;
  return { spec: m[1], layer: m[2] !== undefined ? m[2] : m[3] ? '' : null };
}

/** The names a cascade `@layer a, b, c;` statement declares, or null when it is not one. */
export function layerOrder(statement: string): string[] | null {
  const m = /^@layer\s+([^{]+)$/.exec(statement);
  return m ? splitTopLevel(m[1], ',') : null;
}

/** One statement as the entry-point pin compares it: whitespace flat, quoting normalized. */
export function normalizeStatement(text: string): string {
  const imported = /^@import\s+(?:url\(\s*)?["']([^"']+)["']\s*\)?\s*(layer\([^)]*\))?$/.exec(text);
  if (imported) return `@import "${imported[1]}"${imported[2] ? ` ${imported[2]}` : ''}`;
  const quoted = /^@(plugin|source|config)\s+["']([^"']+)["']$/.exec(text);
  if (quoted) return `@${quoted[1]} "${quoted[2]}"`;
  return text;
}

/** The value a whole-value `var(--x)` chain ends at in a token map, or undefined. */
export function resolveToken(map: ReadonlyMap<string, string>, token: string): string | undefined {
  let value = map.get(token);
  for (let hops = 0; value !== undefined && hops < 12; hops += 1) {
    const ref = /^var\(\s*(--[\w-]+)\s*\)$/.exec(value);
    if (!ref) break;
    value = map.get(ref[1]);
  }
  return value;
}

export const HSL_TRIPLE = /^(-?[\d.]+)\s+([\d.]+)%\s+([\d.]+)%$/;

/** A selector list's members, for a style rule. */
export const selectorsOf = (block: CssBlock): string[] => (block.atRule ? [] : splitTopLevel(block.prelude, ','));
