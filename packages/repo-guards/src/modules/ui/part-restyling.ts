import ts from 'typescript';
import type { GenericGuardDefinition } from '../../node/suite/config.js';
import type { Finding, GuardContext } from '../../guard.js';
import type { FileView } from '../../reader/view.js';
import { isPlainString } from '../../support/ast.js';
import { MODULE_LOADS, moduleImports } from '../../support/imports.js';
import { isText, objectProblem, pathProblem, reviewedProblems } from '../../support/facts.js';
import { GUARD_TIMEOUT_MS } from '../../support/timeouts.js';
import { cssBlocks, layerOrder, selectorsOf, splitTopLevel, topLevelStatements } from './css.js';
import { installedManifest, loadedStylesheets, splitBareSpecifier } from './stylesheets.js';
import { APP_CODE } from './styling.js';
import { tokensOf } from './source.js';

// A ui-core part carries its built-in look as Tailwind utilities, and the utilities layer outranks
// every layered sheet, so a sheet class on the part that sets one of those properties to another
// value never applies. The part's built-ins are read from the installed package itself.

/** One class source in a part's class call, in call order: literal tokens or a cva call. */
type ClassSegment =
  | { kind: 'tokens'; tokens: string[] }
  | { kind: 'cva'; recipe: string; props: Record<string, string> };

interface CvaRecipe {
  base: string[];
  variants: Record<string, Record<string, string[]>>;
  defaults: Record<string, string>;
}

export interface UiPart {
  name: string;
  segments: ClassSegment[];
  recipes: Record<string, CvaRecipe>;
}

const stringTokens = (node: ts.Node | undefined): string[] | null =>
  isPlainString(node) ? tokensOf(node.text) : null;

function propertyName(node: ts.ObjectLiteralElementLike): string | null {
  if (!node.name) return null;
  if (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name)) return node.name.text;
  return null;
}

function cvaRecipe(call: ts.CallExpression): CvaRecipe {
  const recipe: CvaRecipe = {
    base: stringTokens(call.arguments[0]) ?? [],
    variants: {},
    defaults: {},
  };
  const config = call.arguments[1];
  if (!config || !ts.isObjectLiteralExpression(config)) return recipe;
  for (const section of config.properties) {
    if (!ts.isPropertyAssignment(section) || !ts.isObjectLiteralExpression(section.initializer))
      continue;
    const name = propertyName(section);
    for (const entry of section.initializer.properties) {
      if (!ts.isPropertyAssignment(entry)) continue;
      const key = propertyName(entry);
      if (!key) continue;
      if (name === 'variants' && ts.isObjectLiteralExpression(entry.initializer)) {
        const values: Record<string, string[]> = {};
        for (const option of entry.initializer.properties) {
          const value = ts.isPropertyAssignment(option) ? propertyName(option) : null;
          const tokens =
            value && ts.isPropertyAssignment(option) ? stringTokens(option.initializer) : null;
          if (value && tokens) values[value] = tokens;
        }
        recipe.variants[key] = values;
      } else if (name === 'defaultVariants' && isPlainString(entry.initializer)) {
        recipe.defaults[key] = entry.initializer.text;
      }
    }
  }
  return recipe;
}

const mentionsClassName = (node: ts.Node): boolean => {
  if (ts.isIdentifier(node) && node.text === 'className') return true;
  return ts.forEachChild(node, mentionsClassName) ?? false;
};

function classCall(root: ts.Node): ts.CallExpression | null {
  let found: ts.CallExpression | null = null;
  const visit = (node: ts.Node): void => {
    if (found) return;
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'cn' &&
      node.arguments.some(mentionsClassName)
    ) {
      found = node;
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(root);
  return found;
}

function segmentsOf(call: ts.CallExpression, recipes: Record<string, CvaRecipe>): ClassSegment[] {
  const segments: ClassSegment[] = [];
  for (const arg of call.arguments) {
    const tokens = stringTokens(arg);
    if (tokens) {
      segments.push({ kind: 'tokens', tokens });
      continue;
    }
    if (
      ts.isCallExpression(arg) &&
      ts.isIdentifier(arg.expression) &&
      recipes[arg.expression.text]
    ) {
      const props: Record<string, string> = {};
      const options = arg.arguments[0];
      if (options && ts.isObjectLiteralExpression(options)) {
        for (const p of options.properties) {
          if (ts.isShorthandPropertyAssignment(p)) props[p.name.text] = p.name.text;
          else if (ts.isPropertyAssignment(p) && ts.isIdentifier(p.initializer)) {
            const key = propertyName(p);
            if (key) props[key] = p.initializer.text;
          }
        }
      }
      segments.push({ kind: 'cva', recipe: arg.expression.text, props });
    }
    // A conditional class (`inset && 'pl-8'`) is not always there, so it is no built-in.
  }
  return segments;
}

/** Every forwardRef part a component module declares, with the classes its root receives. */
export function uiPartsIn(path: string, text: string): UiPart[] {
  const sf = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
  const recipes: Record<string, CvaRecipe> = {};
  const declarations: Array<{ name: string; init: ts.Expression }> = [];
  for (const statement of sf.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const d of statement.declarationList.declarations) {
      if (!ts.isIdentifier(d.name) || !d.initializer) continue;
      if (
        ts.isCallExpression(d.initializer) &&
        ts.isIdentifier(d.initializer.expression) &&
        d.initializer.expression.text === 'cva'
      )
        recipes[d.name.text] = cvaRecipe(d.initializer);
      else declarations.push({ name: d.name.text, init: d.initializer });
    }
  }
  const parts: UiPart[] = [];
  for (const { name, init } of declarations) {
    if (!/^[A-Z]/.test(name) || !/forwardRef\s*[<(]/.test(init.getText(sf))) continue;
    const call = classCall(init);
    if (call) parts.push({ name, segments: segmentsOf(call, recipes), recipes });
  }
  return parts;
}

/** The part's built-in tokens, in cascade order, for the variant props a call site passes. */
export function partTokens(part: UiPart, props: Readonly<Record<string, string>> = {}): string[] {
  const out: string[] = [];
  for (const segment of part.segments) {
    if (segment.kind === 'tokens') {
      out.push(...segment.tokens);
      continue;
    }
    const recipe = part.recipes[segment.recipe];
    out.push(...recipe.base);
    for (const [key, values] of Object.entries(recipe.variants)) {
      const prop = segment.props[key] ?? key;
      const chosen = props[prop] ?? recipe.defaults[key];
      if (chosen !== undefined) out.push(...(values[chosen] ?? []));
    }
  }
  return out;
}

/** Every value combination of a part's variant props, defaults first. */
export function partVariantChoices(part: UiPart): Array<Record<string, string>> {
  let choices: Array<Record<string, string>> = [{}];
  for (const segment of part.segments) {
    if (segment.kind !== 'cva') continue;
    for (const [key, values] of Object.entries(part.recipes[segment.recipe].variants)) {
      const prop = segment.props[key] ?? key;
      choices = choices.flatMap((choice) =>
        Object.keys(values).map((value) => ({ ...choice, [prop]: value })),
      );
    }
  }
  return choices;
}

export function variantPropsOf(part: UiPart): Set<string> {
  const props = new Set<string>();
  for (const segment of part.segments)
    if (segment.kind === 'cva')
      for (const key of Object.keys(part.recipes[segment.recipe].variants))
        props.add(segment.props[key] ?? key);
  return props;
}

// ---- What a utility and a sheet class set -------------------------------------------------------

/** One property a utility or a class sets, from the given min-width up (0 is unconditional). */
export interface SetProperty {
  property: string;
  value: string;
  from: number;
  /** A text size's line height, which any leading utility replaces whatever their order. */
  fallback?: boolean;
}

const BREAKPOINTS: Record<string, number> = { sm: 640, md: 768, lg: 1024, xl: 1280, '2xl': 1536 };
const SPACING_REM = 0.25;

const FONT_SIZES: Record<string, [string, string]> = {
  xs: ['0.75rem', '1rem'],
  sm: ['0.875rem', '1.25rem'],
  base: ['1rem', '1.5rem'],
  lg: ['1.125rem', '1.75rem'],
  xl: ['1.25rem', '1.75rem'],
  '2xl': ['1.5rem', '2rem'],
  '3xl': ['1.875rem', '2.25rem'],
  '4xl': ['2.25rem', '2.5rem'],
  '5xl': ['3rem', '1'],
  '6xl': ['3.75rem', '1'],
};
const FONT_WEIGHTS: Record<string, string> = {
  thin: '100',
  extralight: '200',
  light: '300',
  normal: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
  black: '900',
};
const LEADING: Record<string, string> = {
  none: '1',
  tight: '1.25',
  snug: '1.375',
  normal: '1.5',
  relaxed: '1.625',
  loose: '2',
};
const TRACKING: Record<string, string> = {
  tighter: '-0.05em',
  tight: '-0.025em',
  normal: '0em',
  wide: '0.025em',
  wider: '0.05em',
  widest: '0.1em',
};
const RADII: Record<string, string> = {
  '': '0.25rem',
  none: '0',
  xs: '0.125rem',
  sm: '0.25rem',
  md: '0.375rem',
  lg: '0.5rem',
  xl: '0.75rem',
  '2xl': '1rem',
  '3xl': '1.5rem',
  full: '9999px',
};
const DISPLAYS: Record<string, string> = {
  block: 'block',
  'inline-block': 'inline-block',
  inline: 'inline',
  flex: 'flex',
  'inline-flex': 'inline-flex',
  grid: 'grid',
  'inline-grid': 'inline-grid',
  hidden: 'none',
  contents: 'contents',
};
const ALIGN: Record<string, string> = {
  start: 'flex-start',
  end: 'flex-end',
  center: 'center',
  baseline: 'baseline',
  stretch: 'stretch',
};
const JUSTIFY: Record<string, string> = {
  start: 'flex-start',
  end: 'flex-end',
  center: 'center',
  between: 'space-between',
  around: 'space-around',
  evenly: 'space-evenly',
};
const SIDES: Record<string, string[]> = {
  '': ['top', 'right', 'bottom', 'left'],
  x: ['left', 'right'],
  y: ['top', 'bottom'],
  t: ['top'],
  r: ['right'],
  b: ['bottom'],
  l: ['left'],
};
const SIZES: Record<string, string> = {
  full: '100%',
  auto: 'auto',
  fit: 'fit-content',
  min: 'min-content',
  max: 'max-content',
};

const COLOR_VALUE =
  /^(?:hsla?|rgba?|oklch|color-mix|var)\(|^#|^(?:transparent|currentcolor|inherit)$/i;

function spacing(token: string): string | null {
  if (token === 'px') return '1px';
  if (/^\d+(?:\.\d+)?$/.test(token)) return `${Number(token) * SPACING_REM}rem`;
  return null;
}

const arbitrary = (token: string): string | null => {
  const m = /^\[(.+)\]$/.exec(token);
  return m ? m[1].replace(/_/g, ' ') : null;
};

function lengthOf(token: string, named: Record<string, string> = {}): string | null {
  return named[token] ?? spacing(token) ?? arbitrary(token);
}

function sided(prefix: string, side: string, value: string): SetProperty[] {
  return (SIDES[side] ?? []).map((s) => ({ property: `${prefix}-${s}`, value, from: 0 }));
}

function colorOf(name: string, theme: ReadonlyMap<string, string>): string | null {
  const raw = arbitrary(name);
  if (raw) {
    const value = raw.replace(/^color:/, '');
    return COLOR_VALUE.test(value) ? value : null;
  }
  const base = name.replace(/\/\d+$/, '');
  if (name !== base) return null;
  if (theme.has(`--color-${base}`)) return theme.get(`--color-${base}`)!;
  return ['transparent', 'current', 'inherit'].includes(base)
    ? base === 'current'
      ? 'currentcolor'
      : base
    : null;
}

function unprefixed(token: string, theme: ReadonlyMap<string, string>): SetProperty[] {
  const set = (property: string, value: string): SetProperty[] => [{ property, value, from: 0 }];
  if (DISPLAYS[token]) return set('display', DISPLAYS[token]);
  if (token === 'truncate')
    return [
      ...set('overflow', 'hidden'),
      ...set('text-overflow', 'ellipsis'),
      ...set('white-space', 'nowrap'),
    ];
  if (token === 'break-words') return set('overflow-wrap', 'break-word');
  if (/^(?:relative|absolute|fixed|sticky|static)$/.test(token)) return set('position', token);
  let m = /^flex-(row|col|row-reverse|col-reverse)$/.exec(token);
  if (m) return set('flex-direction', m[1].replace('col', 'column'));
  m = /^items-(\w+)$/.exec(token);
  if (m && ALIGN[m[1]]) return set('align-items', ALIGN[m[1]]);
  m = /^justify-(\w+)$/.exec(token);
  if (m && JUSTIFY[m[1]]) return set('justify-content', JUSTIFY[m[1]]);
  m = /^text-(left|center|right|justify|start|end)$/.exec(token);
  if (m) return set('text-align', m[1]);
  m = /^whitespace-([\w-]+)$/.exec(token);
  if (m) return set('white-space', m[1]);
  m = /^font-(\w+)$/.exec(token);
  if (m && FONT_WEIGHTS[m[1]]) return set('font-weight', FONT_WEIGHTS[m[1]]);
  m = /^leading-(.+)$/.exec(token);
  if (m) {
    const value = LEADING[m[1]] ?? lengthOf(m[1]);
    return value ? set('line-height', value) : [];
  }
  m = /^tracking-(.+)$/.exec(token);
  if (m) {
    const value = TRACKING[m[1]] ?? arbitrary(m[1]);
    return value ? set('letter-spacing', value) : [];
  }
  m = /^text-(.+)$/.exec(token);
  if (m) {
    if (FONT_SIZES[m[1]])
      return [
        ...set('font-size', FONT_SIZES[m[1]][0]),
        { property: 'line-height', value: FONT_SIZES[m[1]][1], from: 0, fallback: true },
      ];
    const color = colorOf(m[1], theme);
    if (color) return set('color', color);
    const raw = arbitrary(m[1]);
    return raw ? set('font-size', raw) : [];
  }
  m = /^bg-(.+)$/.exec(token);
  if (m) {
    const color = colorOf(m[1], theme);
    return color ? set('background-color', color) : [];
  }
  m = /^rounded(?:-(.+))?$/.exec(token);
  if (m) {
    const key = m[1] ?? '';
    const value = theme.get(`--radius-${key}`) ?? RADII[key] ?? arbitrary(key);
    return value ? set('border-radius', value) : [];
  }
  m = /^border(?:-([xytrbl]))?(?:-(.+))?$/.exec(token);
  if (m) {
    const side = m[1] ?? '';
    const rest = m[2];
    if (rest === undefined) return sided('border', side, '1px').map(widthOf);
    if (/^\d+$/.test(rest)) return sided('border', side, `${rest}px`).map(widthOf);
    const color = colorOf(rest, theme);
    if (color) return sided('border', side, color).map(colorProp);
    return [];
  }
  m = /^([pm])([xytrbl]?)-(.+)$/.exec(token);
  if (m) {
    const value = m[3] === 'auto' ? 'auto' : lengthOf(m[3]);
    return value ? sided(m[1] === 'p' ? 'padding' : 'margin', m[2], value) : [];
  }
  m = /^gap-(.+)$/.exec(token);
  if (m) {
    const value = lengthOf(m[1]);
    return value ? set('gap', value) : [];
  }
  m = /^(min-|max-)?([wh])-(.+)$/.exec(token);
  if (m) {
    const dimension = m[2] === 'w' ? 'width' : 'height';
    const named = { ...SIZES, screen: m[2] === 'w' ? '100vw' : '100vh' };
    const value = lengthOf(m[3], named);
    return value ? set(`${m[1] ?? ''}${dimension}`, value) : [];
  }
  m = /^size-(.+)$/.exec(token);
  if (m) {
    const value = lengthOf(m[1], SIZES);
    return value ? [...set('width', value), ...set('height', value)] : [];
  }
  m = /^opacity-(\d+)$/.exec(token);
  if (m) return set('opacity', String(Number(m[1]) / 100));
  m = /^cursor-([\w-]+)$/.exec(token);
  if (m) return set('cursor', m[1]);
  m = /^overflow-(hidden|auto|scroll|visible|clip)$/.exec(token);
  if (m) return set('overflow', m[1]);
  if (token === 'select-none') return set('user-select', 'none');
  m = /^shadow(?:-(.+))?$/.exec(token);
  if (m) return set('box-shadow', `tailwind ${token}`);
  return [];
}

function widthOf(p: SetProperty): SetProperty {
  return { ...p, property: `${p.property}-width` };
}
function colorProp(p: SetProperty): SetProperty {
  return { ...p, property: `${p.property}-color` };
}

function variantSplit(token: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < token.length; i += 1) {
    const c = token[i];
    if (c === '[' || c === '(') depth += 1;
    else if (c === ']' || c === ')') depth -= 1;
    else if (c === ':' && depth === 0) {
      parts.push(token.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(token.slice(start));
  return parts;
}

/** What a Tailwind utility sets unconditionally or from a breakpoint up; a state variant sets nothing judged. */
export function utilityProperties(
  token: string,
  theme: ReadonlyMap<string, string> = new Map(),
): SetProperty[] {
  const parts = variantSplit(token);
  const utility = parts.pop()!.replace(/^!|!$/g, '');
  let from = 0;
  for (const prefix of parts) {
    if (BREAKPOINTS[prefix] === undefined) return [];
    from = Math.max(from, BREAKPOINTS[prefix]);
  }
  return unprefixed(utility, theme).map((p) => ({ ...p, from }));
}

const boxValues = (value: string): string[] => {
  const v = splitTopLevel(value, ' ');
  const [t, r = t, b = t, l = r] = v;
  return [t, r, b, l];
};

function expanded(property: string, value: string): Array<{ property: string; value: string }> {
  const sides = ['top', 'right', 'bottom', 'left'];
  const box = (prefix: string, suffix = '') =>
    boxValues(value).map((v, i) => ({ property: `${prefix}-${sides[i]}${suffix}`, value: v }));
  if (property === 'padding' || property === 'margin') return box(property);
  if (property === 'padding-inline' || property === 'margin-inline') {
    const [a, b = a] = splitTopLevel(value, ' ');
    const prefix = property.replace('-inline', '');
    return [
      { property: `${prefix}-left`, value: a },
      { property: `${prefix}-right`, value: b },
    ];
  }
  if (property === 'padding-block' || property === 'margin-block') {
    const [a, b = a] = splitTopLevel(value, ' ');
    const prefix = property.replace('-block', '');
    return [
      { property: `${prefix}-top`, value: a },
      { property: `${prefix}-bottom`, value: b },
    ];
  }
  if (property === 'border-width') return box('border', '-width');
  if (property === 'border-color') return box('border', '-color');
  const side = /^border(?:-(top|right|bottom|left))?$/.exec(property);
  if (side) {
    const out: Array<{ property: string; value: string }> = [];
    for (const piece of splitTopLevel(value, ' ')) {
      const which = /^(?:\d|\.)/.test(piece)
        ? 'width'
        : /^(?:solid|dashed|dotted|double|none|hidden|groove|ridge|inset|outset)$/.test(piece)
          ? 'style'
          : 'color';
      for (const s of side[1] ? [side[1]] : sides)
        out.push({ property: `border-${s}-${which}`, value: piece });
    }
    return out;
  }
  if (property === 'background' && !/url\(|gradient\(/.test(value))
    return [{ property: 'background-color', value }];
  return [{ property, value }];
}

function minWidthOf(prelude: string): number | null {
  const m = /^@media\s*\(\s*min-width:\s*([\d.]+)(px|rem|em)\s*\)$/.exec(prelude);
  if (!m) return null;
  return Number(m[1]) * (m[2] === 'px' ? 1 : 16);
}

export interface ClassDeclaration extends SetProperty {
  index: number;
}

/** The plain `.name` rules of a sheet, by class; a state, a nested selector or another media query is no look of the class. */
export function sheetClassProperties(code: string): Map<string, ClassDeclaration[]> {
  const out = new Map<string, ClassDeclaration[]>();
  // Blanked, not removed, so every index still points into the sheet as written.
  const bare = code.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' '));
  for (const block of cssBlocks(bare)) {
    if (block.atRule) continue;
    let from = 0;
    let judged = true;
    for (const at of block.within) {
      if (/^@layer\b/.test(at)) continue;
      const width = minWidthOf(at);
      if (width === null) judged = false;
      else from = Math.max(from, width);
    }
    if (!judged) continue;
    for (const selector of selectorsOf(block)) {
      const m = /^\.([\w-]+)$/.exec(selector);
      if (!m) continue;
      const list = out.get(m[1]) ?? [];
      for (const d of block.declarations) {
        if (d.property.startsWith('--') || /!\s*important$/i.test(d.value)) continue;
        for (const e of expanded(d.property, d.value)) list.push({ ...e, from, index: d.index });
      }
      out.set(m[1], list);
    }
  }
  return out;
}

/** The theme colors and radii an app's `@theme` blocks declare. */
export function themeValues(code: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const block of cssBlocks(code)) {
    if (!block.prelude.startsWith('@theme')) continue;
    for (const d of block.declarations)
      if (/^--(?:color|radius)-[\w-]+$/.test(d.property) && d.value !== 'initial')
        out.set(d.property, d.value);
  }
  return out;
}

function normalized(value: string): string {
  return value
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\s*,\s*/g, ',')
    .replace(/(-?[\d.]+)rem\b/g, (_, n: string) => `${Number(n) * 16}px`)
    .replace(/(^|[\s(,])-?0(?:px|em|%)?(?=$|[\s),])/g, '$10')
    .trim();
}

/** The value in force at a width: the last declaration whose breakpoint has been reached. */
function inForce<T extends SetProperty>(list: readonly T[], width: number): T | undefined {
  let found: T | undefined;
  for (const item of list)
    if (item.from <= width && (!found || item.from >= found.from)) found = item;
  return found;
}

export interface RestylingConflict {
  className: string;
  property: string;
  classValue: string;
  utility: string;
  utilityValue: string;
  index: number;
}

/** Each property a sheet class sets that the part's built-in utilities set to another value, at some width. */
export function restylingConflicts(
  className: string,
  declarations: readonly ClassDeclaration[],
  builtIns: readonly string[],
  theme: ReadonlyMap<string, string>,
): RestylingConflict[] {
  const utilities = new Map<string, Array<SetProperty & { utility: string }>>();
  for (const token of builtIns)
    for (const p of utilityProperties(token, theme)) {
      const current = utilities.get(p.property) ?? [];
      if (p.fallback && current.some((u) => u.from === p.from && !u.fallback)) continue;
      const list = current.filter((u) => u.from !== p.from);
      list.push({ ...p, utility: token });
      utilities.set(p.property, list);
    }
  const byProperty = new Map<string, ClassDeclaration[]>();
  for (const d of declarations)
    byProperty.set(d.property, [...(byProperty.get(d.property) ?? []), d]);
  const conflicts: RestylingConflict[] = [];
  for (const [property, own] of byProperty) {
    const built = utilities.get(property);
    if (!built) continue;
    const widths = [...new Set([0, ...own.map((d) => d.from), ...built.map((u) => u.from)])].sort(
      (a, b) => a - b,
    );
    for (const width of widths) {
      const mine = inForce(own, width);
      const theirs = inForce(built, width);
      if (!mine || !theirs || normalized(mine.value) === normalized(theirs.value)) continue;
      conflicts.push({
        className,
        property,
        classValue: mine.value,
        utility: theirs.utility,
        utilityValue: theirs.value,
        index: mine.index,
      });
      break;
    }
  }
  return conflicts;
}

// ---- The guard ----------------------------------------------------------------------------------

export interface PartRestylingException {
  path: string;
  part: string;
  className: string;
  why: string;
}

export interface PartRestylingFacts {
  entryStylesheet: string;
  uiModule: string;
  exceptions: readonly PartRestylingException[];
}

function moduleFile(context: GuardContext, spec: string): string | null {
  const { name, subpath } = splitBareSpecifier(spec);
  const manifest = installedManifest(context, name);
  if (!manifest) return null;
  const exportsField = manifest.exports as Record<string, unknown> | undefined;
  const entry = exportsField?.[subpath];
  const pick = (e: unknown): string | null =>
    typeof e === 'string'
      ? e
      : e && typeof e === 'object'
        ? (pick((e as Record<string, unknown>).import) ??
          pick((e as Record<string, unknown>).default))
        : null;
  const target =
    pick(entry) ?? (subpath === '.' && typeof manifest.main === 'string' ? manifest.main : null);
  return target ? `node_modules/${name}/${target.replace(/^\.\//, '')}` : null;
}

const dirnameOf = (p: string) => p.slice(0, p.lastIndexOf('/'));

function installedParts(context: GuardContext, spec: string): Map<string, UiPart> | null {
  const entry = moduleFile(context, spec);
  if (!entry || !context.reader.exists(entry)) return null;
  const parts = new Map<string, UiPart>();
  const seen = new Set<string>();
  const visit = (file: string) => {
    if (seen.has(file) || !context.reader.exists(file)) return;
    seen.add(file);
    const view = context.file(file);
    for (const part of uiPartsIn(file, view.text)) parts.set(part.name, part);
    for (const m of view.text.matchAll(/\bfrom\s+['"](\.{1,2}\/[^'"]+)['"]/g)) {
      const segments = `${dirnameOf(file)}/${m[1]}`.split('/');
      const resolved: string[] = [];
      for (const s of segments) {
        if (s === '..') resolved.pop();
        else if (s !== '.') resolved.push(s);
      }
      visit(resolved.join('/'));
    }
  };
  visit(entry);
  return parts;
}

function classTokensOf(attribute: ts.JsxAttribute): string[] {
  const init = attribute.initializer;
  if (!init) return [];
  if (isPlainString(init)) return tokensOf(init.text);
  const out: string[] = [];
  const visit = (node: ts.Node): void => {
    if (isPlainString(node)) out.push(...tokensOf(node.text));
    else if (ts.isTemplateExpression(node))
      for (const piece of [node.head, ...node.templateSpans.map((s) => s.literal)])
        out.push(...tokensOf(piece.text));
    ts.forEachChild(node, visit);
  };
  visit(init);
  return out;
}

interface CallSite {
  part: UiPart;
  tag: string;
  index: number;
  classes: string[];
  choices: Array<Record<string, string>>;
}

function callSites(file: FileView, spec: string, parts: ReadonlyMap<string, UiPart>): CallSite[] {
  const local = new Map<string, UiPart>();
  for (const site of moduleImports(file.sourceFile, MODULE_LOADS)) {
    if (site.spec !== spec) continue;
    for (const n of site.named) {
      const part = parts.get(n.imported);
      if (part) local.set(n.local, part);
    }
  }
  if (!local.size) return [];
  const out: CallSite[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(file.sourceFile);
      const part = local.get(tag);
      if (part) {
        let classes: string[] = [];
        const fixed: Record<string, string> = {};
        const open = new Set<string>();
        const variantProps = variantPropsOf(part);
        for (const attr of node.attributes.properties) {
          if (!ts.isJsxAttribute(attr) || !ts.isIdentifier(attr.name)) continue;
          const name = attr.name.text;
          if (name === 'className') classes = classTokensOf(attr);
          else if (variantProps.has(name)) {
            if (attr.initializer && isPlainString(attr.initializer))
              fixed[name] = attr.initializer.text;
            else open.add(name);
          }
        }
        // A prop passed as an expression may take any of its values; an absent one takes its default.
        const choices = open.size
          ? partVariantChoices(part).map((choice) => {
              const picked: Record<string, string> = { ...fixed };
              for (const k of open) picked[k] = choice[k];
              return picked;
            })
          : [fixed];
        if (classes.length)
          out.push({ part, tag, index: node.getStart(file.sourceFile), classes, choices });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file.sourceFile);
  return out;
}

const exceptionKey = (e: { path: string; part: string; className: string }) =>
  `${e.path} <${e.part}> .${e.className}`;

export function partRestylingFindings(context: GuardContext, facts: PartRestylingFacts): Finding[] {
  const { sheets, findings } = loadedStylesheets(context, facts.entryStylesheet);
  const entry = sheets.find((s) => s.file.path === facts.entryStylesheet);
  const order = entry
    ? topLevelStatements(entry.file.code)
        .map((s) => layerOrder(s.text))
        .find((o) => o !== null)
    : null;
  const utilitiesAt = order ? order.indexOf('utilities') : -1;
  if (!order || utilitiesAt === -1) {
    findings.push({
      file: facts.entryStylesheet,
      detail:
        'declares no cascade layer order naming the utilities layer, so no class can be placed against it',
    });
    return findings;
  }
  const parts = installedParts(context, facts.uiModule);
  if (!parts || !parts.size) {
    findings.push({
      file: facts.entryStylesheet,
      detail: `the installed ${facts.uiModule} declares no part to judge`,
    });
    return findings;
  }
  const theme = new Map<string, string>();
  const classes = new Map<string, ClassDeclaration[]>();
  for (const sheet of sheets) {
    for (const [k, v] of themeValues(sheet.file.code)) theme.set(k, v);
    const below =
      sheet.layer !== null &&
      order.indexOf(sheet.layer) !== -1 &&
      order.indexOf(sheet.layer) < utilitiesAt;
    if (!below) continue;
    for (const [name, list] of sheetClassProperties(sheet.file.code))
      classes.set(name, [...(classes.get(name) ?? []), ...list]);
  }
  const exceptions = new Map(facts.exceptions.map((e) => [exceptionKey(e), e]));
  const used = new Set<string>();
  for (const file of context.files(APP_CODE)) {
    for (const site of callSites(file, facts.uiModule, parts)) {
      for (const className of new Set(site.classes)) {
        const declarations = classes.get(className);
        if (!declarations || utilityProperties(className, theme).length) continue;
        const conflicts = site.choices.flatMap((choice) =>
          restylingConflicts(className, declarations, partTokens(site.part, choice), theme),
        );
        if (!conflicts.length) continue;
        const key = exceptionKey({ path: file.path, part: site.part.name, className });
        if (exceptions.has(key)) {
          used.add(key);
          continue;
        }
        const seen = new Set<string>();
        const said = conflicts
          .filter((c) => !seen.has(c.property) && seen.add(c.property))
          .map(
            (c) =>
              `${c.property}: ${c.classValue} (its built-in ${c.utility} sets ${c.utilityValue})`,
          )
          .join('; ');
        findings.push({
          file: file.path,
          line: file.lineOf(site.index),
          detail: `.${className} on <${site.tag}> loses to the part's built-in utilities — ${said}`,
        });
      }
    }
  }
  for (const [key, e] of exceptions)
    if (!used.has(key))
      findings.push({
        file: e.path,
        detail: `stale exception: .${e.className} on <${e.part}> no longer loses to a built-in`,
      });
  return findings;
}

function factProblems(facts: unknown): string[] {
  const problems: string[] = [];
  if (!objectProblem(facts, 'facts', problems)) return problems;
  pathProblem(facts.entryStylesheet, 'entryStylesheet', problems);
  if (!isText(facts.uiModule)) problems.push('uiModule is missing or empty');
  reviewedProblems(facts.exceptions, 'exceptions', problems, {
    id: ({ path, part, className }) =>
      isText(path) && isText(part) && isText(className)
        ? exceptionKey({ path, part, className })
        : undefined,
    idNames: 'its part and class',
  });
  return problems;
}

export const partRestylingGuard: GenericGuardDefinition<PartRestylingFacts> = {
  id: 'partRestyling',
  absentWhen: false,
  factProblems,
  build(facts) {
    return [
      {
        title: 'a stylesheet class never restyles what a ui-core part already sets',
        description:
          'A ui-core part carries its built-in look as Tailwind utilities, read here from the installed package, and the ' +
          'utilities layer outranks every sheet in an earlier layer. A sheet class on the part that sets one of those ' +
          'properties to another value never applies, so the screen shows the built-in look while the code reads as ' +
          "if the class did. Give the part the variant that owns the look; a look only the app wants is the app's own " +
          'class on its own element or wrapper, and a single change at one call site is a Tailwind utility there. A ' +
          'reviewed exception names the file, the part and the class, with its why.',
        timeoutMs: GUARD_TIMEOUT_MS,
        run: (context) => partRestylingFindings(context, facts),
      },
    ];
  },
};
