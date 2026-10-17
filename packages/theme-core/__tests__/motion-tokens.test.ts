import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

// FRONTEND-204's motion tokens are one theme-invariant family owned here: all four resolve from
// `contract.css`'s :root (the first stylesheet theme-core loads), and no theme block restates them.
// Every package's motion reads them: no class string or stylesheet carries a raw duration or easing,
// and nothing transitions `all` or an unnamed property set.
const STYLES = path.resolve(__dirname, '../src/styles');
const PACKAGES = path.resolve(__dirname, '../..');
const MOTION_TOKENS = ['--motion-fast', '--motion-base', '--motion-slow', '--motion-ease'] as const;

function rootDeclarations(css: string): Map<string, string> {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const root = [...withoutComments.matchAll(/(^|\})\s*:root\s*\{([^{}]*)\}/g)].map((m) => m[2]).join(';');
  return new Map(
    root
      .split(';')
      .map((d) => d.trim())
      .filter((d) => d.startsWith('--'))
      .map((d) => [d.slice(0, d.indexOf(':')).trim(), d.slice(d.indexOf(':') + 1).trim()] as [string, string]),
  );
}

describe('motion tokens', () => {
  const contract = rootDeclarations(readFileSync(path.join(STYLES, 'contract.css'), 'utf8'));

  it.each(MOTION_TOKENS)('%s is declared in contract.css :root with a value', (token) => {
    expect(contract.get(token)).toBeTruthy();
  });

  it('no other theme-core stylesheet declares a motion token, so each has one value in every theme', () => {
    const elsewhere = readdirSync(STYLES)
      .filter((f) => f.endsWith('.css') && f !== 'contract.css')
      .flatMap((f) =>
        MOTION_TOKENS.filter((t) => new RegExp(`${t} *:`).test(readFileSync(path.join(STYLES, f), 'utf8'))).map(
          (t) => `${f}: ${t}`,
        ),
      );
    expect(elsewhere).toEqual([]);
  });
});

// --- raw motion in class strings and stylesheets -------------------------------------------------

const TOKEN_VALUE = /^(?:\[var\(--motion-[a-z]+\)\]|\(--motion-[a-z]+\))$/;

/** The utility part of one class token, with its variants (`data-[state=open]:`, `hover:`) removed. */
function utilityOf(token: string): string {
  let depth = 0;
  let start = 0;
  for (let i = 0; i < token.length; i += 1) {
    const c = token[i];
    if (c === '[' || c === '(') depth += 1;
    else if (c === ']' || c === ')') depth -= 1;
    else if (c === ':' && depth === 0) start = i + 1;
  }
  return token.slice(start).replace(/^!/, '');
}

/** Why a class token breaks the motion rule, or null when it does not. */
function rawMotionClass(token: string): string | null {
  const utility = utilityOf(token);
  if (utility === 'transition') return 'transitions an unnamed property set';
  if (utility === 'transition-all') return 'transitions all';
  if (utility.startsWith('transition-[')) return 'hand-written transition';
  const timed = /^(duration|ease|delay)-(.+)$/.exec(utility);
  if (!timed) return null;
  return TOKEN_VALUE.test(timed[2]) ? null : `raw ${timed[1] === 'ease' ? 'easing' : timed[1]}`;
}

function classStringsOf(file: string): string[] {
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const found: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) found.push(node.text);
    else if (ts.isTemplateExpression(node)) {
      found.push(node.head.text, ...node.templateSpans.map((span) => span.literal.text));
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

const CSS_MOTION_PROPERTIES = new Set([
  'transition',
  'transition-duration',
  'transition-timing-function',
  'transition-delay',
  'transition-property',
  'animation',
  'animation-duration',
  'animation-timing-function',
  'animation-delay',
]);
const RAW_TIME = /(?<![\w-])\d*\.?\d+m?s\b/;
const RAW_EASING = /(?<![\w-])(?:ease|ease-in|ease-out|ease-in-out|linear|step-start|step-end)\b|cubic-bezier\(|steps\(/;

/** Why a stylesheet declaration breaks the motion rule, or null when it does not. */
function rawMotionDeclaration(property: string, value: string): string | null {
  if (!CSS_MOTION_PROPERTIES.has(property)) return null;
  // A continuous indicator (a spinner, a pulse) loops on its own clock; it is not a change of state.
  if (property === 'animation' && /\binfinite\b/.test(value)) return null;
  if ((property === 'transition' || property === 'transition-property') && /(?<![\w-])all\b/.test(value)) {
    return 'transitions all';
  }
  if (RAW_TIME.test(value)) return 'raw duration';
  if (RAW_EASING.test(value)) return 'raw easing';
  return null;
}

function sourceFiles(dir: string, extension: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sourceFiles(full, extension);
    return entry.name.endsWith(extension) ? [full] : [];
  });
}

// Every package has a `src`; a package without one fails here rather than going unscanned.
const packageSources = readdirSync(PACKAGES, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => path.join(PACKAGES, entry.name, 'src'));

describe('motion reads the tokens', () => {
  it.each([
    ['transition-all', 'transitions all'],
    ['hover:transition', 'transitions an unnamed property set'],
    ['data-[swipe=cancel]:transition-[transform_200ms_ease-out]', 'hand-written transition'],
    ['duration-200', 'raw duration'],
    ['data-[state=open]:duration-500', 'raw duration'],
    ['duration-[300ms]', 'raw duration'],
    ['ease-in-out', 'raw easing'],
    ['ease-[cubic-bezier(0.4,0,0.2,1)]', 'raw easing'],
    ['delay-150', 'raw delay'],
  ])('refuses the class %s', (token, reason) => {
    expect(rawMotionClass(token)).toBe(reason);
  });

  it.each([
    'transition-colors',
    'transition-transform',
    'transition-opacity',
    'duration-[var(--motion-base)]',
    'data-[state=open]:duration-[var(--motion-slow)]',
    'ease-[var(--motion-ease)]',
    'duration-(--motion-fast)',
    'motion-reduce:transition-none',
  ])('accepts the class %s', (token) => {
    expect(rawMotionClass(token)).toBeNull();
  });

  it.each([
    ['transition', 'all 150ms', 'transitions all'],
    ['transition-property', 'all', 'transitions all'],
    ['transition-duration', '150ms', 'raw duration'],
    ['transition', 'opacity 0.3s var(--motion-ease)', 'raw duration'],
    ['transition-timing-function', 'cubic-bezier(0.4, 0, 0.2, 1)', 'raw easing'],
    ['transition', 'opacity var(--motion-fast) ease-out', 'raw easing'],
    ['animation', 'fade-in 200ms ease-out', 'raw duration'],
  ])('refuses the declaration %s: %s', (property, value, reason) => {
    expect(rawMotionDeclaration(property, value)).toBe(reason);
  });

  it.each([
    ['transition-duration', 'var(--motion-fast)'],
    ['transition', 'opacity var(--motion-base) var(--motion-ease)'],
    ['animation', 'spin 1s linear infinite'],
    ['color', 'hsl(var(--primary))'],
  ])('accepts the declaration %s: %s', (property, value) => {
    expect(rawMotionDeclaration(property, value)).toBeNull();
  });

  it('no package class string carries raw motion', () => {
    const offenders = packageSources.flatMap((dir) =>
      sourceFiles(dir, '.tsx').flatMap((file) =>
        classStringsOf(file).flatMap((text) =>
          text
            .split(/\s+/)
            .filter(Boolean)
            .flatMap((token) => {
              const reason = rawMotionClass(token);
              return reason ? [`${path.relative(PACKAGES, file)}: ${token} (${reason})`] : [];
            }),
        ),
      ),
    );
    expect(offenders).toEqual([]);
  });

  it('no package stylesheet carries raw motion', () => {
    const offenders = packageSources.flatMap((dir) =>
      sourceFiles(dir, '.css').flatMap((file) => {
        const css = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
        return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].flatMap(([, , body]) =>
          body
            .split(';')
            .map((d) => d.trim())
            .filter((d) => d.includes(':') && !d.startsWith('--'))
            .flatMap((d) => {
              const property = d.slice(0, d.indexOf(':')).trim();
              const value = d.slice(d.indexOf(':') + 1).trim();
              const reason = rawMotionDeclaration(property, value);
              return reason ? [`${path.relative(PACKAGES, file)}: ${d} (${reason})`] : [];
            }),
        );
      }),
    );
    expect(offenders).toEqual([]);
  });
});
