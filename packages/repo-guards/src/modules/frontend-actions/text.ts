import { escapeRegExp } from '../../support/text.js';

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

export interface Block {
  text: string;
  start: number;
}

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

export const exportedName = (block: string) =>
  /export\s+(?:default\s+)?(?:async\s+)?(?:function|const)\s+(\w+)/.exec(block)?.[1] ?? null;

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

export function memberOrBareCalls(code: string, symbol: string): number[] {
  return [...code.matchAll(new RegExp(`(?<![\\w$])${escapeRegExp(symbol)}\\s*\\(`, 'g'))].map(
    (m) => m.index!,
  );
}

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
