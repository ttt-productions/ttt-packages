// Text-scanning helpers the client-action guards share. Each works on a file's comment-stripped
// `code`, so an index it returns is also an index into the file's text and reports its real line.

import { escapeRegExp } from '../../support/text.js';

/** The text between the `(` at `open` and its balanced `)`. */
export function balancedArgs(source: string, open: number): string {
  let i = open + 1;
  let depth = 1;
  while (i < source.length && depth > 0) {
    const c = source[i];
    if (c === '(') depth++;
    else if (c === ')') depth--;
    i++;
  }
  return source.slice(open + 1, Math.max(open + 1, i - 1));
}

/** The body between the `{` that ends at `bodyStart` and its balanced `}`, and where it ends. */
export function braceBody(source: string, bodyStart: number): { body: string; end: number } {
  let i = bodyStart;
  let depth = 1;
  while (i < source.length && depth > 0) {
    const c = source[i];
    if (c === '{') depth++;
    else if (c === '}') depth--;
    i++;
  }
  return { body: source.slice(bodyStart, Math.max(bodyStart, i - 1)), end: i };
}

/** One exported declaration's text with its start: the unit that owns one hook call and its handlers. */
export interface Block {
  text: string;
  start: number;
}

/** A file's code split before each top-level `export function` / `export const`. */
export function exportBlocks(code: string): Block[] {
  const blocks: Block[] = [];
  const re = /\n(?=export\s+(?:async\s+)?(?:function|const)\s)/g;
  let start = 0;
  for (let m = re.exec(code); m; m = re.exec(code)) {
    blocks.push({ text: code.slice(start, m.index), start });
    start = m.index;
  }
  blocks.push({ text: code.slice(start), start });
  return blocks;
}

/** The name an exported block declares, or null for module-scope code. */
export const exportedName = (block: string) =>
  /export\s+(?:default\s+)?(?:async\s+)?(?:function|const)\s+(\w+)/.exec(block)?.[1] ?? null;

/** Bodies of every `catch (…) { … }`, brace-matched so a trailing `finally` is never included. */
export function catchBodies(source: string): Array<{ body: string; index: number }> {
  const bodies: Array<{ body: string; index: number }> = [];
  const opener = /\bcatch\b[^{;]*\{/g;
  for (let m = opener.exec(source); m; m = opener.exec(source)) {
    const { body, end } = braceBody(source, opener.lastIndex);
    bodies.push({ body, index: m.index });
    opener.lastIndex = end;
  }
  return bodies;
}

/** Every `try { … } catch (…) { … }` pair, brace-matched, nested pairs included. */
export function tryCatchPairs(
  source: string,
): Array<{ tryBody: string; catchBody: string; index: number }> {
  const pairs: Array<{ tryBody: string; catchBody: string; index: number }> = [];
  const re = /\btry\s*\{/g;
  for (let m = re.exec(source); m; m = re.exec(source)) {
    const bodyStart = m.index + m[0].length;
    const { body: tryBody, end } = braceBody(source, bodyStart);
    const rest = source.slice(end);
    const cm = /^\s*catch\b[^{;]*\{/.exec(rest);
    if (cm) pairs.push({ tryBody, catchBody: braceBody(rest, cm[0].length).body, index: m.index });
    re.lastIndex = bodyStart;
  }
  return pairs;
}

/** The argument text of every call of `name` (a plain or dotted name) not preceded by an identifier character. */
export function callArgs(source: string, name: string): Array<{ args: string; index: number }> {
  const out: Array<{ args: string; index: number }> = [];
  const needle = `${name}(`;
  let from = 0;
  for (;;) {
    const at = source.indexOf(needle, from);
    if (at === -1) break;
    from = at + needle.length;
    if (at > 0 && /[\w$.]/.test(source[at - 1])) continue;
    out.push({ args: balancedArgs(source, at + needle.length - 1), index: at });
  }
  return out;
}

/** The handler texts assigned to `key:` in an options-object text, bounded so a sibling key is never included. */
export function handlersFor(options: string, key: string): string[] {
  const out: string[] = [];
  const re = new RegExp(`\\b${escapeRegExp(key)}\\s*:`, 'g');
  for (let m = re.exec(options); m; m = re.exec(options)) {
    const start = m.index + m[0].length;
    let depth = 0;
    let i = start;
    for (; i < options.length; i++) {
      const c = options[i];
      if (c === '(' || c === '{' || c === '[') depth++;
      else if (c === ')' || c === '}' || c === ']') {
        if (depth === 0) break;
        depth--;
      } else if (c === ',' && depth === 0) break;
    }
    out.push(options.slice(start, i));
  }
  return out;
}

/** The declaration text of each block-local `const x = …;` or `function x(…) {…}`. */
export function localDeclarations(block: string): Map<string, string> {
  const decls = new Map<string, string>();
  const re = /(?:\b(?:const|let|var)\s+(\w+)\s*(?::[^=;]+)?=|\bfunction\s+(\w+)\s*[(<])/g;
  for (let m = re.exec(block); m; m = re.exec(block)) {
    const name = m[1] ?? m[2];
    const isFunction = m[2] !== undefined;
    let depth = 0;
    let opened = false;
    let i = m.index;
    for (; i < block.length; i++) {
      const c = block[i];
      if (c === '(' || c === '{' || c === '[') {
        depth++;
        if (c === '{') opened = true;
      } else if (c === ')' || c === '}' || c === ']') {
        depth--;
        if (isFunction && opened && depth === 0 && c === '}') break;
      } else if (!isFunction && c === ';' && depth === 0) break;
    }
    decls.set(name, block.slice(m.index, i + 1));
  }
  return decls;
}

/** Where each call of `symbol` starts, bare (`f(`) or as a member (`x.f(`, `g().f(`). */
export function memberOrBareCalls(code: string, symbol: string): number[] {
  return [...code.matchAll(new RegExp(`(?<![\\w$])${escapeRegExp(symbol)}\\s*\\(`, 'g'))].map(
    (m) => m.index!,
  );
}

/** True when the name at `index` is reached through one of `namespaces` (`ns.name`). */
export function throughNamespace(
  code: string,
  index: number,
  namespaces: readonly string[],
): boolean {
  const before = code.slice(Math.max(0, index - 200), index);
  return namespaces.some((ns) =>
    new RegExp(`(?<![\\w$])${escapeRegExp(ns)}\\s*\\.\\s*$`).test(before),
  );
}
