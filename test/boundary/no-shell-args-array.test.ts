import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { REPO_ROOT } from './leak-utils';

// Node only space-joins an args array for a shell, unescaped, and deprecates that form. A child
// process that needs a shell gets ONE command string plus its options instead — the quiet runner's
// runCmd is the pattern — and one that needs no shell keeps its args array with `shell` unset or
// `false`. This guard reads source text, so it sees an options object written at the call site, not
// one passed in through a variable or a spread.

const CALLEES = ['spawn', 'spawnSync', 'execFile', 'execFileSync'];
const CALL_START = new RegExp(`\\b(?:${CALLEES.join('|')})\\s*\\(`, 'g');
const CODE_FILE = /\.[cm]?[jt]sx?$/;
const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', 'coverage']);

function listCodeFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      return SKIP_DIRS.has(entry.name) || entry.name.startsWith('.') ? [] : listCodeFiles(path);
    }
    return entry.isFile() && CODE_FILE.test(entry.name) ? [path] : [];
  });
}

// Index of the quote that closes the string or template literal opened at `open`.
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

// The top-level items of the bracketed list opened at `open` — a call's arguments or an object
// literal's properties — split at commas outside strings and brackets, with comments dropped.
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

// Line numbers of every call whose third argument — the options slot after an args array — is an
// object literal that turns a shell on.
function shellWithArgsArray(source: string): number[] {
  const lines: number[] = [];
  for (const match of source.matchAll(CALL_START)) {
    const openParen = match.index + match[0].length - 1;
    const args = topLevelItems(source, openParen);
    if (args.length >= 3 && turnsOnShell(args[2])) {
      lines.push(source.slice(0, match.index).split('\n').length);
    }
  }
  return lines;
}

const call = (callee: string, args: string) => `${callee}(${args});`;
const rel = (file: string) => relative(REPO_ROOT, file).split(sep).join('/');
const codeFiles = listCodeFiles(REPO_ROOT);

describe('boundary: no child process gets an args array together with a shell', () => {
  it('flags an args array whose inline options turn a shell on', () => {
    expect(shellWithArgsArray(call('spawn', 'cmd, args, { shell: true }'))).toHaveLength(1);
    expect(shellWithArgsArray(call('execFileSync', "cmd, ['-v'], { shell: isWindows, stdio: 'pipe' }"))).toHaveLength(1);
    expect(shellWithArgsArray(call('spawnSync', 'cmd, args, { shell }'))).toHaveLength(1);
    expect(shellWithArgsArray(call('spawn', "cmd, args, { 'shell': '/bin/sh' }"))).toHaveLength(1);
  });

  it('passes the single-command-string form and an args array whose options leave the shell off', () => {
    expect(shellWithArgsArray(call('spawn', "[cmd, ...args].join(' '), { shell: true, ...opts }"))).toEqual([]);
    expect(shellWithArgsArray(call('spawn', "'ffmpeg', ['-i', `${dir}/in`], { stdio: 'pipe' }"))).toEqual([]);
    expect(shellWithArgsArray(call('execFile', 'file, { shell: true }, (err) => onExit(err)'))).toEqual([]);
    expect(shellWithArgsArray(call('spawn', "cmd, args, { stdio: 'pipe', shell: false }"))).toEqual([]);
    expect(shellWithArgsArray(call('spawn', "cmd, args, { env: { shell: 'x' } }"))).toEqual([]);
    expect(shellWithArgsArray(call('spawn', "cmd, args, { stdio: 'pipe' /* shell: true */ }"))).toEqual([]);
    expect(shellWithArgsArray(call('spawn', "cmd, args, { stdio: 'pipe', // no shell:\n }"))).toEqual([]);
  });

  it('scans a plausible number of source files', () => {
    expect(codeFiles.length).toBeGreaterThan(100);
  });

  it('finds no such call in any repo source file', () => {
    const offenders = codeFiles.flatMap((file) =>
      shellWithArgsArray(readFileSync(file, 'utf8')).map((line) => `${rel(file)}:${line}`),
    );
    expect(
      offenders,
      `drop the shell and keep the args array, or pass one command string plus the options (see runCmd in scripts/test-quiet.mjs):\n  ${offenders.join('\n  ')}`,
    ).toEqual([]);
  });
});

describe('boundary: the quiet runner hands its shell only shell-safe tokens', () => {
  const source = readFileSync(join(REPO_ROOT, 'scripts', 'test-quiet.mjs'), 'utf8');
  const declared = /^const SHELL_SAFE_TOKEN = \/(.+)\/([a-z]*);\s*$/m.exec(source);
  const safe = (token: string) => (declared ? new RegExp(declared[1], declared[2]).test(token) : false);

  it('declares SHELL_SAFE_TOKEN as a regex literal', () => {
    expect(declared, 'scripts/test-quiet.mjs no longer declares SHELL_SAFE_TOKEN').not.toBeNull();
  });

  it('accepts commands, subcommands, flags, flag values, and relative script paths', () => {
    for (const token of ['npm', 'npx', 'run', 'lint', '-b', '--noEmit', '--omit=dev', '--reporter=json', 'scripts/x.mjs', '@scope/pkg']) {
      expect(safe(token), token).toBe(true);
    }
  });

  it('rejects every token cmd.exe or sh would reinterpret', () => {
    for (const token of ['', 'a b', 'a&b', 'a|b', 'a;b', 'a<b', 'a>b', '$HOME', '%PATH%', 'a^b', '`id`', '"q"', "'q'", 'a\\b', '*', '!x', '(x)', 'a\nb']) {
      expect(safe(token), JSON.stringify(token)).toBe(false);
    }
  });
});
