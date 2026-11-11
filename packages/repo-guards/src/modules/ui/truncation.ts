import ts from 'typescript';
import type { GenericGuardDefinition } from '../../node/suite/config.js';
import type { Finding } from '../../guard.js';
import type { Scope } from '../../node/reader.js';
import type { FileView } from '../../reader/view.js';
import { reviewedAllowlist, type AllowlistEntry, type Hit } from '../../shapes/shapes.js';
import { forEachNode, isPlainString } from '../../support/ast.js';
import {
  allowlistProblems,
  isText,
  namesProblem,
  pathProblem,
  reviewedProblems,
  isList,
} from '../../support/facts.js';
import { isUnder } from '../../support/text.js';
import { cssBlocks, selectorsOf, splitTopLevel } from './css.js';
import { loadedStylesheets } from './stylesheets.js';
import { bareToken, codeStrings, tokensOf } from './source.js';

const APP_CODE_AND_STYLES: Scope = { roots: ['app'], kinds: ['code', 'stylesheet'], tests: false };

const CLIP_COMPONENT = 'ClippedText';
const BOX_COMPONENTS = new Set([CLIP_COMPONENT, 'MachineText']);

const TRUNCATION_TOKEN = /^(?:truncate|text-ellipsis|line-clamp-(?:\d+|none|\[[^\]]+\]))$/;
const BREAK_TOKEN =
  /^(?:break-all|wrap-anywhere|\[(?:word-break:break-all|overflow-wrap:anywhere)\])$/;
const INLINE_STYLE_KEYS = new Set(['textOverflow', 'WebkitLineClamp', 'lineClamp']);
const INLINE_BREAK_STYLES: Readonly<Record<string, string>> = {
  wordBreak: 'break-all',
  overflowWrap: 'anywhere',
};
const APPLY = /@apply\s+([^;{}]+)/g;

type Owner = { selector: string; why: string };

export interface SharedTruncationFacts {
  entryStylesheet: string;
  trees: readonly string[];
  clipClasses: readonly string[];
  clampOwners: ReadonlyArray<Owner>;
  breakClasses: readonly string[];
  breakOwners: ReadonlyArray<Owner>;
  exceptions: readonly AllowlistEntry[];
}

const squash = (text: string) => text.replace(/\s+/g, ' ').trim();

const plainToken = (token: string): string => bareToken(token).replace(/^!/, '');

export const isTruncationToken = (token: string): boolean =>
  TRUNCATION_TOKEN.test(plainToken(token));

const isBreakToken = (token: string): boolean => BREAK_TOKEN.test(plainToken(token));

function enclosingSelectors(code: string, at: number): string[] {
  let depth = 0;
  let open = -1;
  for (let i = at - 1; i >= 0; i -= 1) {
    if (code[i] === '}') depth += 1;
    else if (code[i] === '{') {
      if (depth === 0) {
        open = i;
        break;
      }
      depth -= 1;
    }
  }
  if (open === -1) return [];
  let start = open - 1;
  while (start >= 0 && !'{};'.includes(code[start])) start -= 1;
  const prelude = squash(code.slice(start + 1, open));
  return prelude.startsWith('@') ? [] : splitTopLevel(prelude, ',').map(squash);
}

interface StylesheetRule {
  index: number;
  selectors: string[];
  detail: string;
}

type StylesheetKind = 'clamp' | 'break';

const DECLARES: Record<StylesheetKind, (property: string, value: string) => boolean> = {
  clamp: (property, value) =>
    (property === 'text-overflow' && /\bellipsis\b/.test(value)) ||
    property === '-webkit-line-clamp' ||
    property === 'line-clamp',
  break: (property, value) =>
    (property === 'word-break' && /\bbreak-all\b/.test(value)) ||
    ((property === 'overflow-wrap' || property === 'word-wrap') && /\banywhere\b/.test(value)),
};

const APPLIES: Record<StylesheetKind, (token: string) => boolean> = {
  clamp: isTruncationToken,
  break: isBreakToken,
};

function stylesheetRules(file: FileView, kind: StylesheetKind): StylesheetRule[] {
  const out: StylesheetRule[] = [];
  for (const block of cssBlocks(file.code)) {
    if (block.atRule) continue;
    for (const d of block.declarations)
      if (DECLARES[kind](d.property, d.value))
        out.push({
          index: d.index,
          selectors: selectorsOf(block).map(squash),
          detail: `${d.property}: ${d.value}`,
        });
  }
  const re = new RegExp(APPLY.source, APPLY.flags);
  for (let m = re.exec(file.code); m; m = re.exec(file.code)) {
    const tokens = tokensOf(m[1]).filter(APPLIES[kind]);
    if (tokens.length)
      out.push({
        index: m.index,
        selectors: enclosingSelectors(file.code, m.index),
        detail: `@apply ${tokens.join(' ')}`,
      });
  }
  return out.sort((a, b) => a.index - b.index);
}

export const stylesheetClamps = (file: FileView): StylesheetRule[] =>
  stylesheetRules(file, 'clamp');

const jsxTagName = (node: ts.JsxElement | ts.JsxSelfClosingElement, sf: ts.SourceFile): string =>
  (ts.isJsxElement(node) ? node.openingElement.tagName : node.tagName).getText(sf);

const isPlainTag = (name: string) => /^[a-z][\w-]*$/.test(name);

type JsxNode = ts.JsxElement | ts.JsxSelfClosingElement;

const isJsxNode = (node: ts.Node): node is JsxNode =>
  ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node);

function unwrapParentheses(expression: ts.Expression): ts.Expression {
  let e = expression;
  while (ts.isParenthesizedExpression(e)) e = e.expression;
  return e;
}

const rendersNothing = (e: ts.Expression) =>
  e.kind === ts.SyntaxKind.NullKeyword ||
  e.kind === ts.SyntaxKind.FalseKeyword ||
  (ts.isIdentifier(e) && e.text === 'undefined');

function renderedElements(expression: ts.Expression): JsxNode[] | null {
  const e = unwrapParentheses(expression);
  if (isJsxNode(e)) return [e];
  if (rendersNothing(e)) return [];
  if (ts.isBinaryExpression(e) && e.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken)
    return renderedElements(e.right);
  if (ts.isConditionalExpression(e)) {
    const whenTrue = renderedElements(e.whenTrue);
    const whenFalse = renderedElements(e.whenFalse);
    return whenTrue && whenFalse ? [...whenTrue, ...whenFalse] : null;
  }
  return null;
}

function onlyChildElements(node: ts.JsxElement): JsxNode[] | null {
  const children = node.children.filter(
    (c) =>
      !(ts.isJsxText(c) && c.containsOnlyTriviaWhiteSpaces) &&
      !(ts.isJsxExpression(c) && c.expression === undefined),
  );
  if (children.length !== 1) return null;
  const [child] = children;
  if (isJsxNode(child)) return [child];
  if (ts.isJsxExpression(child) && child.expression) {
    const elements = renderedElements(child.expression);
    return elements && elements.length ? elements : null;
  }
  return null;
}

const hasAsChild = (node: ts.JsxElement, sf: ts.SourceFile) =>
  node.openingElement.attributes.properties.some(
    (p) =>
      ts.isJsxAttribute(p) &&
      p.name.getText(sf) === 'asChild' &&
      (p.initializer === undefined ||
        (ts.isJsxExpression(p.initializer) &&
          p.initializer.expression?.kind === ts.SyntaxKind.TrueKeyword)),
  );

function componentTags(file: FileView): Map<string, string> {
  const tags = new Map<string, string>(
    [...BOX_COMPONENTS].map((component) => [component, component]),
  );
  for (const imported of file.imports) {
    if (imported.kind !== 'import' || imported.typeOnly) continue;
    for (const name of imported.named)
      if (!name.typeOnly && BOX_COMPONENTS.has(name.imported)) tags.set(name.local, name.imported);
    if (imported.namespace)
      for (const component of BOX_COMPONENTS)
        tags.set(`${imported.namespace}.${component}`, component);
  }
  return tags;
}

function clipFormHits(file: FileView): Hit[] {
  const sf = file.sourceFile;
  const tags = componentTags(file);
  const hits: Hit[] = [];
  forEachNode(sf, (node) => {
    if (!ts.isJsxElement(node)) return;
    const name = jsxTagName(node, sf);
    const children = onlyChildElements(node);
    if (!children) return;
    const component = tags.get(name);
    if (component && hasAsChild(node, sf) && isJsxNode(children[0])) {
      const childName = jsxTagName(children[0], sf);
      if (children.length === 1 && isPlainTag(childName))
        hits.push({
          index: children[0].getStart(sf),
          detail: `${component} asChild over a plain <${childName}> (name the tag with as)`,
        });
      return;
    }
    if (
      isPlainTag(name) &&
      children.every((child) => tags.get(jsxTagName(child, sf)) === CLIP_COMPONENT)
    )
      hits.push({
        index: node.getStart(sf),
        detail: `a plain <${name}> holding only ${CLIP_COMPONENT} (name the tag with as)`,
      });
  });
  return hits;
}

function inlineStyleHits(file: FileView): { hits: Hit[]; values: Set<number> } {
  const sf = file.sourceFile;
  const hits: Hit[] = [];
  const values = new Set<number>();
  forEachNode(sf, (node) => {
    if (!ts.isPropertyAssignment(node) && !ts.isShorthandPropertyAssignment(node)) return;
    if (!ts.isIdentifier(node.name) && !ts.isStringLiteral(node.name)) return;
    const key = node.name.text;
    if (INLINE_STYLE_KEYS.has(key)) {
      hits.push({ index: node.getStart(sf), detail: `inline ${key}` });
      return;
    }
    const breaking = INLINE_BREAK_STYLES[key];
    if (
      breaking &&
      ts.isPropertyAssignment(node) &&
      isPlainString(node.initializer) &&
      node.initializer.text.trim() === breaking
    ) {
      hits.push({ index: node.getStart(sf), detail: `inline ${key}: ${breaking}` });
      values.add(node.initializer.getStart(sf));
    }
  });
  return { hits, values };
}

export function codeTruncations(
  file: FileView,
  clipClasses: readonly string[] = [],
  breakClasses: readonly string[] = [],
): Hit[] {
  const placed = new Set([...clipClasses, ...breakClasses]);
  const inline = inlineStyleHits(file);
  const hits: Hit[] = [...inline.hits, ...clipFormHits(file)];
  for (const { text, index } of codeStrings(file))
    if (!inline.values.has(index))
      for (const token of tokensOf(text))
        if (isTruncationToken(token) || isBreakToken(token)) hits.push({ index, detail: token });
        else if (placed.has(plainToken(token)))
          hits.push({ index, detail: `${token} placed by hand` });
  return hits.sort((a, b) => a.index - b.index);
}

export function truncationHits(
  file: FileView,
  facts: Pick<
    SharedTruncationFacts,
    'trees' | 'clampOwners' | 'clipClasses' | 'breakOwners' | 'breakClasses'
  >,
): Hit[] {
  if (!facts.trees.some((tree) => isUnder(file.path, tree))) return [];
  if (file.kind === 'code') return codeTruncations(file, facts.clipClasses, facts.breakClasses);
  if (file.kind !== 'stylesheet') return [];
  const outside = (owners: ReadonlyArray<Owner>) => {
    const held = new Set(owners.map((o) => squash(o.selector)));
    return (rule: StylesheetRule) =>
      !rule.selectors.length || !rule.selectors.every((s) => held.has(s));
  };
  return [
    ...stylesheetClamps(file).filter(outside(facts.clampOwners)),
    ...stylesheetRules(file, 'break').filter(outside(facts.breakOwners)),
  ]
    .sort((a, b) => a.index - b.index)
    .map((rule) => ({ index: rule.index, detail: rule.detail }));
}

function classesProblems(
  value: readonly string[] | undefined,
  what: string,
  problems: string[],
): void {
  namesProblem(value, what, problems);
  if (isList(value))
    for (const name of value)
      if (isText(name) && (isTruncationToken(name) || isBreakToken(name)))
        problems.push(`${what} ${name} is itself a per-call-site utility`);
}

export const sharedTruncationGuard: GenericGuardDefinition<SharedTruncationFacts> = {
  id: 'sharedTruncation',
  absentWhen: false,
  factProblems(facts) {
    const problems: string[] = [];
    pathProblem(facts?.entryStylesheet, 'entryStylesheet', problems);
    if (!isList(facts?.trees) || !facts.trees.length) problems.push('trees is missing');
    else facts.trees.forEach((t, i) => pathProblem(t, `trees[${i}]`, problems));
    classesProblems(facts?.clipClasses, 'clipClasses', problems);
    classesProblems(facts?.breakClasses, 'breakClasses', problems);
    reviewedProblems(facts?.clampOwners, 'clampOwners', problems, {
      key: 'selector',
      nonEmpty: true,
    });
    reviewedProblems(facts?.breakOwners, 'breakOwners', problems, {
      key: 'selector',
      nonEmpty: true,
    });
    allowlistProblems(facts?.exceptions, 'exceptions', problems);
    return problems;
  },
  build(facts) {
    const tree = facts.trees[0];
    const owner = facts.clampOwners[0].selector;
    const breakOwner = facts.breakOwners[0].selector;
    const guard = reviewedAllowlist({
      title: 'text is clipped only through the clip component, never by a class placed by hand',
      description:
        `Under ${facts.trees.join(', ')}, a title, a name, or a few-line text block is clipped only by rendering it ` +
        "through ui-core's ClippedText, which places the clip classes and keeps the full text in the title and " +
        'accessible name, and the element ClippedText renders is the box that clips: a plain tag is named with ' +
        '`as` (`<ClippedText as="h2" text={title} />`), never put under `asChild` and never wrapped around a ' +
        'ClippedText that is its only content; `asChild` is for a component, for ClippedText and MachineText ' +
        'alike. A plain tag that exists only to lay out a lone ClippedText (a `<div className="flex min-w-0">`) is ' +
        "flagged too: give the ClippedText's own box its width bound instead, never name a flex container with " +
        '`as`, since an ellipsis does not apply to a flex container. A name in a sentence wraps through ' +
        "ui-core's InlineName, and machine text (an id, an email, a hash, a file name) breaks through ui-core's " +
        `MachineText. Code never names a clip class (${facts.clipClasses.join(', ')}) or a break class ` +
        `(${facts.breakClasses.join(', ')}), a per-call-site truncation utility (\`truncate\`, ` +
        '`line-clamp-<n|none|[…]>`, `text-ellipsis`) or break utility (`break-all`, `wrap-anywhere`, or the ' +
        'same as an arbitrary property), with or without a variant prefix, in a string, template, or className, ' +
        'and never sets an inline `textOverflow`, `WebkitLineClamp`, or `lineClamp` style, a `wordBreak` of ' +
        '`break-all`, or an `overflowWrap` of `anywhere`. A stylesheet sets `text-overflow: ellipsis`, ' +
        '`-webkit-line-clamp`, or `line-clamp` only in a rule whose every selector is a clamp owner ' +
        `(${facts.clampOwners.map((o) => o.selector).join(', ')}), and \`word-break: break-all\` or ` +
        '`overflow-wrap: anywhere` only in a rule whose every selector is a break owner ' +
        `(${facts.breakOwners.map((o) => o.selector).join(', ')}), applied utilities included. An owner is ` +
        `declared by a stylesheet ${facts.entryStylesheet} loads — the theme package's or the app's — and one no ` +
        'loaded stylesheet declares any more is stale. Render the text through ClippedText, InlineName, or ' +
        'MachineText, or add an owner or a reviewed exception with its why.',
      scope: APP_CODE_AND_STYLES,
      match: (file) => truncationHits(file, facts),
      allowlist: facts.exceptions,
      samples: {
        flags: [
          { path: `${tree}/sample.tsx`, text: '<h2 className="font-bold truncate">{title}</h2>' },
          {
            path: `${tree}/sample.tsx`,
            text: `<h2 className="font-bold ${facts.clipClasses[0]}">{title}</h2>`,
          },
          { path: `${tree}/sample.tsx`, text: 'const c = cn(`md:line-clamp-2 ${x}`);' },
          {
            path: `${tree}/sample.tsx`,
            text: "<p className={open ? 'line-clamp-none' : 'text-ellipsis'} />",
          },
          { path: `${tree}/sample.tsx`, text: "<p style={{ textOverflow: 'ellipsis' }} />" },
          {
            path: `${tree}/sample.tsx`,
            text: '<h2 className="font-bold"><ClippedText text={title} /></h2>',
          },
          {
            path: `${tree}/sample.tsx`,
            text: '<ClippedText asChild text={title}>\n  <h2 className="font-bold" />\n</ClippedText>',
          },
          {
            path: `${tree}/sample.tsx`,
            text: '<MachineText asChild text={id}>\n  <code className="font-mono" />\n</MachineText>',
          },
          { path: `${tree}/sample.tsx`, text: '<h2>{title && <ClippedText text={title} />}</h2>' },
          { path: `${tree}/sample.tsx`, text: '<h2>{<ClippedText text={title} />}</h2>' },
          {
            path: `${tree}/sample.tsx`,
            text: '<h2>{a ? <ClippedText text={a} /> : <ClippedText text={b} />}</h2>',
          },
          {
            path: `${tree}/sample.tsx`,
            text: "import { ClippedText as Clip } from '@kit/ui/react';\n<h2><Clip text={title} /></h2>",
          },
          { path: `${tree}/sample.tsx`, text: '<code className="font-mono break-all">{id}</code>' },
          {
            path: `${tree}/sample.tsx`,
            text: `<span className="${facts.breakClasses[0]}">{id}</span>`,
          },
          { path: `${tree}/sample.tsx`, text: "<p style={{ wordBreak: 'break-all' }} />" },
          { path: `${tree}/sample.css`, text: '.card-title { text-overflow: ellipsis; }' },
          { path: `${tree}/sample.css`, text: '.card-title { @apply line-clamp-3; }' },
          { path: `${tree}/sample.css`, text: '.account-id { overflow-wrap: anywhere; }' },
        ],
        passes: [
          {
            path: `${tree}/sample.tsx`,
            text: '<ClippedText as="h2" className="font-bold" text={title} />',
          },
          {
            path: `${tree}/sample.tsx`,
            text: '<ClippedText asChild text={title}>\n  <CardTitle variant="page" />\n</ClippedText>',
          },
          {
            path: `${tree}/sample.tsx`,
            text: '<p>\n  Delete <InlineName name={name} />?\n</p>',
          },
          { path: `${tree}/sample.tsx`, text: '<MachineText as="code" text={id} />' },
          {
            path: `${tree}/sample.tsx`,
            text: '<p>{label}{title && <ClippedText text={title} />}</p>',
          },
          {
            path: `${tree}/sample.tsx`,
            text: '<MachineText asChild text={id}>\n  <CardTitle variant="page" />\n</MachineText>',
          },
          {
            path: `${tree}/sample.tsx`,
            text: '// a truncate class would go here\nconst mode = "truncated";',
          },
          { path: `${tree}/sample.css`, text: `${owner} { text-overflow: ellipsis; }` },
          { path: `${tree}/sample.css`, text: `${breakOwner} { word-break: break-all; }` },
          { path: `${tree}/sample.css`, text: '.card { text-overflow: clip; }' },
          { path: `${tree}/sample.css`, text: '.prose { overflow-wrap: break-word; }' },
        ],
      },
    });
    return [
      {
        ...guard,
        async run(context) {
          const findings: Finding[] = [...(await guard.run(context))];
          const files = context
            .files(APP_CODE_AND_STYLES)
            .filter((f) => facts.trees.some((t) => isUnder(f.path, t)));
          for (const t of facts.trees)
            if (!files.some((f) => isUnder(f.path, t)))
              findings.push({
                file: t,
                detail: 'the tree holds no production code or stylesheet the guard can read',
              });
          const loaded = loadedStylesheets(context, facts.entryStylesheet);
          findings.push(...loaded.findings);
          const sheets = [...loaded.sheets.map((sheet) => sheet.file), ...files].filter(
            (file) => file.kind === 'stylesheet',
          );
          const heldBy = (kind: StylesheetKind) => {
            const held = new Set<string>();
            for (const file of sheets)
              for (const rule of stylesheetRules(file, kind))
                for (const s of rule.selectors) held.add(s);
            return held;
          };
          const clamps = heldBy('clamp');
          for (const { selector } of facts.clampOwners)
            if (!clamps.has(squash(selector)))
              findings.push({
                file: '(clampOwners)',
                detail: `stale clamp owner: no stylesheet rule for ${selector} truncates any more`,
              });
          const breaks = heldBy('break');
          for (const { selector } of facts.breakOwners)
            if (!breaks.has(squash(selector)))
              findings.push({
                file: '(breakOwners)',
                detail: `stale break owner: no stylesheet rule for ${selector} breaks anywhere any more`,
              });
          return findings;
        },
      },
    ];
  },
};
