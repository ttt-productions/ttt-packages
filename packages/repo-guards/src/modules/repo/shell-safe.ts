// No child process gets an args array together with a shell. Node only space-joins an args array
// for a shell, unescaped, and deprecates that form: a child that needs a shell gets ONE command
// string plus its options, and one that needs no shell keeps its args array with `shell` unset or
// `false`. The check reads source text, so it sees an options object written at the call site, not
// one passed in through a variable or a spread.

import type { GenericGuardDefinition } from '../../config.js';
import type { Finding } from '../../guard.js';
import type { Scope } from '../../reader/reader.js';
import type { FileView } from '../../reader/view.js';

const CALLEES = ['spawn', 'spawnSync', 'execFile', 'execFileSync'];
const CALL_START = new RegExp(`\\b(?:${CALLEES.join('|')})\\s*\\(`, 'g');

/** Index of the quote that closes the string or template literal opened at `open`. */
function skipString(source: string, open: number): number {
  const quote = source[open];
  for (let i = open + 1; i < source.length; i++) {
    const ch = source[i];
    if (ch === '\\') {
      i++;
    } else if (ch === quote) {
      return i;
    } else if (quote === '`' && ch === '$' && source[i + 1] === '{') {
      let depth = 0;
      for (i += 1; i < source.length; i++) {
        const c = source[i];
        if (c === '"' || c === "'" || c === '`') i = skipString(source, i);
        else if (c === '{') depth++;
        else if (c === '}' && --depth === 0) break;
      }
    }
  }
  return source.length;
}

/**
 * The top-level items of the bracketed list opened at `open` — a call's arguments or an object
 * literal's properties — split at commas outside strings and brackets, with comments dropped.
 */
function topLevelItems(source: string, open: number): string[] {
  const items: string[] = [];
  let item = '';
  let depth = 0;
  for (let i = open + 1; i < source.length; i++) {
    const ch = source[i];
    if (ch === '"' || ch === "'" || ch === '`') {
      const close = skipString(source, i);
      item += source.slice(i, close + 1);
      i = close;
    } else if (ch === '/' && source[i + 1] === '/') {
      const end = source.indexOf('\n', i);
      i = end === -1 ? source.length : end;
      item += ' ';
    } else if (ch === '/' && source[i + 1] === '*') {
      const end = source.indexOf('*/', i + 2);
      i = end === -1 ? source.length : end + 1;
      item += ' ';
    } else if (ch === ',' && depth === 0) {
      items.push(item);
      item = '';
    } else if ((ch === ')' || ch === ']' || ch === '}') && depth === 0) {
      items.push(item);
      break;
    } else {
      if (ch === '(' || ch === '[' || ch === '{') depth++;
      else if (ch === ')' || ch === ']' || ch === '}') depth--;
      item += ch;
    }
  }
  return items.map((entry) => entry.trim()).filter((entry) => entry.length > 0);
}

// A top-level `shell` property whose value is anything but the literal `false` (Node's default), the
// `shell` shorthand included. A `shell` key nested inside another property sets no spawn option.
const SHELL_ON = /^(['"]?)shell\1\s*(?::(?!\s*false\b)[\s\S]+)?$/;

const turnsOnShell = (options: string) =>
  options.startsWith('{') && topLevelItems(options, 0).some((property) => SHELL_ON.test(property));

/**
 * The index of every call whose third argument — the options slot after an args array — is an
 * object literal that turns a shell on.
 */
export function shellWithArgsArray(code: string): number[] {
  const hits: number[] = [];
  for (const match of code.matchAll(CALL_START)) {
    const openParen = match.index + match[0].length - 1;
    const args = topLevelItems(code, openParen);
    if (args.length >= 3 && turnsOnShell(args[2])) hits.push(match.index);
  }
  return hits;
}

/** Every finding the check makes in one file. */
export function shellArgsFindings(file: FileView): Finding[] {
  return shellWithArgsArray(file.code).map((index) => ({
    file: file.path,
    line: file.lineOf(index),
    detail: 'an args array is handed to a shell',
  }));
}

export const SHELL_SAFE_SCOPE: Scope = {
  roots: ['app', 'functions', 'scripts', 'workers', 'e2e', 'hostedE2e'],
  kinds: ['code'],
  tests: true,
  optionalRoots: ['functions', 'scripts', 'workers', 'e2e', 'hostedE2e'],
};

export const SHELL_SAFE_TITLE = 'no child process gets an args array together with a shell';
export const SHELL_SAFE_DESCRIPTION =
  'spawn, spawnSync, execFile and execFileSync never take an args array together with options that turn a shell on ' +
  '(shell: true, a shell path, or the shell shorthand): Node joins that array with spaces, unescaped. Drop the shell ' +
  'and keep the args array, or build one command string and pass it with the options.';

/** Takes no facts: it reads every code root the layout declares. */
export type ShellSafeFacts = Readonly<Record<string, never>>;

export const shellSafeGuard: GenericGuardDefinition<ShellSafeFacts> = {
  id: 'shellSafeChildProcesses',
  absentWhen: false,
  factProblems(facts) {
    if (!facts || typeof facts !== 'object') return ['the facts are missing (this guard takes {})'];
    return Object.keys(facts).length ? ['this guard takes no facts ({})'] : [];
  },
  build() {
    return [
      {
        title: SHELL_SAFE_TITLE,
        description: SHELL_SAFE_DESCRIPTION,
        timeoutMs: 120_000,
        run: (context) => context.files(SHELL_SAFE_SCOPE).flatMap(shellArgsFindings),
      },
    ];
  },
};
