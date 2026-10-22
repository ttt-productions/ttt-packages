export interface Token {
  readonly kind: 'string' | 'name' | 'number' | 'punct';
  readonly text: string;
  readonly index: number;
}

const PUNCT = ['&&', '||', '==', '!=', '<=', '>=', '**'];

export function tokenize(code: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < code.length) {
    const c = code[i];
    if (/\s/.test(c)) {
      i += 1;
    } else if (c === '"' || c === "'") {
      let j = i + 1;
      let value = '';
      while (j < code.length && code[j] !== c && code[j] !== '\n') {
        if (code[j] === '\\' && j + 1 < code.length) {
          value += code[j + 1];
          j += 2;
        } else {
          value += code[j];
          j += 1;
        }
      }
      tokens.push({ kind: 'string', text: value, index: i });
      i = j + 1;
    } else if (/[A-Za-z_$]/.test(c)) {
      const m = /^[A-Za-z_$][\w$]*/.exec(code.slice(i)) as RegExpExecArray;
      tokens.push({ kind: 'name', text: m[0], index: i });
      i += m[0].length;
    } else if (/[0-9]/.test(c)) {
      const m = /^[0-9][0-9.]*/.exec(code.slice(i)) as RegExpExecArray;
      tokens.push({ kind: 'number', text: m[0], index: i });
      i += m[0].length;
    } else {
      const two = code.slice(i, i + 2);
      const text = PUNCT.includes(two) ? two : c;
      tokens.push({ kind: 'punct', text, index: i });
      i += text.length;
    }
  }
  return tokens;
}

const OPENERS: Record<string, string> = { '(': ')', '[': ']', '{': '}' };
const CLOSERS: Record<string, string> = { ')': '(', ']': '[', '}': '{' };
const BOUNDARY = new Set(['&&', '||', ',', ';', '?', ':', '==', '!=', '<', '>', '<=', '>=', '=']);
const BOUNDARY_WORDS = new Set(['return', 'if', 'let', 'in', 'is', 'allow', 'function', 'match']);

const isBoundary = (t: Token) =>
  (t.kind === 'punct' && BOUNDARY.has(t.text)) || (t.kind === 'name' && BOUNDARY_WORDS.has(t.text));

export function operandBefore(tokens: readonly Token[], at: number): [number, number] {
  let depth = 0;
  let i = at - 1;
  for (; i >= 0; i -= 1) {
    const t = tokens[i];
    if (t.kind === 'punct' && CLOSERS[t.text]) depth += 1;
    else if (t.kind === 'punct' && OPENERS[t.text]) {
      if (depth === 0) break;
      depth -= 1;
    } else if (depth === 0 && isBoundary(t)) break;
  }
  return [i + 1, at];
}

export function operandAfter(tokens: readonly Token[], at: number): [number, number] {
  let depth = 0;
  let i = at + 1;
  for (; i < tokens.length; i += 1) {
    const t = tokens[i];
    if (t.kind === 'punct' && OPENERS[t.text]) depth += 1;
    else if (t.kind === 'punct' && CLOSERS[t.text]) {
      if (depth === 0) break;
      depth -= 1;
    } else if (depth === 0 && isBoundary(t)) break;
  }
  return [at + 1, i];
}

export function openerOf(tokens: readonly Token[], close: number): number {
  let depth = 0;
  for (let i = close; i >= 0; i -= 1) {
    const t = tokens[i];
    if (t.kind === 'punct' && CLOSERS[t.text]) depth += 1;
    else if (t.kind === 'punct' && OPENERS[t.text]) {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

export function closerOf(tokens: readonly Token[], open: number): number {
  let depth = 0;
  for (let i = open; i < tokens.length; i += 1) {
    const t = tokens[i];
    if (t.kind === 'punct' && OPENERS[t.text]) depth += 1;
    else if (t.kind === 'punct' && CLOSERS[t.text]) {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return tokens.length;
}

export function loneString(tokens: readonly Token[], [from, to]: [number, number]): Token | null {
  let a = from;
  let b = to - 1;
  while (a < b && tokens[a].text === '(' && tokens[b].text === ')') {
    a += 1;
    b -= 1;
  }
  return a === b && tokens[a].kind === 'string' ? tokens[a] : null;
}

export function fieldOf(tokens: readonly Token[], [from, to]: [number, number]): string | null {
  if (to - from < 2) return null;
  const last = tokens[to - 1];
  if (last.kind === 'name') return tokens[to - 2]?.text === '.' ? last.text : null;
  if (last.text === ')') {
    const open = openerOf(tokens, to - 1);
    if (open < from + 2) return null;
    const callee = tokens[open - 1];
    const arg = tokens[open + 1];
    if (callee.text === 'get' && tokens[open - 2]?.text === '.' && arg?.kind === 'string')
      return arg.text;
  }
  return null;
}
