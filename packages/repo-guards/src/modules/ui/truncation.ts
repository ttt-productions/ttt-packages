import ts from 'typescript';
import type { GenericGuardDefinition } from '../../node/suite/config.js';
import type { Finding } from '../../guard.js';
import type { Scope } from '../../node/reader.js';
import type { FileView } from '../../reader/view.js';
import { reviewedAllowlist, type AllowlistEntry, type Hit } from '../../shapes/shapes.js';
import { forEachNode } from '../../support/ast.js';
import {
  allowlistProblems,
  isText,
  pathProblem,
  reviewedProblems,
  textProblem,
} from '../../support/facts.js';
import { isUnder } from '../../support/text.js';
import { cssBlocks, selectorsOf, splitTopLevel } from './css.js';
import { bareToken, codeStrings, tokensOf } from './source.js';

const APP_CODE_AND_STYLES: Scope = { roots: ['app'], kinds: ['code', 'stylesheet'], tests: false };

const TRUNCATION_TOKEN = /^(?:truncate|text-ellipsis|line-clamp-(?:\d+|none|\[[^\]]+\]))$/;
const INLINE_STYLE_KEYS = new Set(['textOverflow', 'WebkitLineClamp', 'lineClamp']);
const APPLY = /@apply\s+([^;{}]+)/g;

export interface SharedTruncationFacts {
  trees: readonly string[];
  sharedClass: string;
  clampOwners: ReadonlyArray<{ selector: string; why: string }>;
  exceptions: readonly AllowlistEntry[];
}

const squash = (text: string) => text.replace(/\s+/g, ' ').trim();

export const isTruncationToken = (token: string): boolean =>
  TRUNCATION_TOKEN.test(bareToken(token).replace(/^!/, ''));

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

interface StylesheetClamp {
  index: number;
  selectors: string[];
  detail: string;
}

export function stylesheetClamps(file: FileView): StylesheetClamp[] {
  const out: StylesheetClamp[] = [];
  for (const block of cssBlocks(file.code)) {
    if (block.atRule) continue;
    for (const d of block.declarations) {
      const clamps =
        (d.property === 'text-overflow' && /\bellipsis\b/.test(d.value)) ||
        d.property === '-webkit-line-clamp' ||
        d.property === 'line-clamp';
      if (clamps)
        out.push({
          index: d.index,
          selectors: selectorsOf(block).map(squash),
          detail: `${d.property}: ${d.value}`,
        });
    }
  }
  const re = new RegExp(APPLY.source, APPLY.flags);
  for (let m = re.exec(file.code); m; m = re.exec(file.code)) {
    const tokens = tokensOf(m[1]).filter(isTruncationToken);
    if (tokens.length)
      out.push({
        index: m.index,
        selectors: enclosingSelectors(file.code, m.index),
        detail: `@apply ${tokens.join(' ')}`,
      });
  }
  return out.sort((a, b) => a.index - b.index);
}

export function codeTruncations(file: FileView): Hit[] {
  const hits: Hit[] = [];
  for (const { text, index } of codeStrings(file))
    for (const token of tokensOf(text))
      if (isTruncationToken(token)) hits.push({ index, detail: token });
  forEachNode(file.sourceFile, (node) => {
    if (
      (ts.isPropertyAssignment(node) || ts.isShorthandPropertyAssignment(node)) &&
      (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name)) &&
      INLINE_STYLE_KEYS.has(node.name.text)
    )
      hits.push({ index: node.getStart(file.sourceFile), detail: `inline ${node.name.text}` });
  });
  return hits.sort((a, b) => a.index - b.index);
}

export function truncationHits(
  file: FileView,
  facts: Pick<SharedTruncationFacts, 'trees' | 'clampOwners'>,
): Hit[] {
  if (!facts.trees.some((tree) => isUnder(file.path, tree))) return [];
  if (file.kind === 'code') return codeTruncations(file);
  if (file.kind !== 'stylesheet') return [];
  const owners = new Set(facts.clampOwners.map((o) => squash(o.selector)));
  return stylesheetClamps(file)
    .filter((c) => !c.selectors.length || !c.selectors.every((s) => owners.has(s)))
    .map((c) => ({ index: c.index, detail: c.detail }));
}

export const sharedTruncationGuard: GenericGuardDefinition<SharedTruncationFacts> = {
  id: 'sharedTruncation',
  absentWhen: false,
  factProblems(facts) {
    const problems: string[] = [];
    if (!Array.isArray(facts?.trees) || !facts.trees.length) problems.push('trees is missing');
    else facts.trees.forEach((t, i) => pathProblem(t, `trees[${i}]`, problems));
    textProblem(facts?.sharedClass, 'sharedClass', problems);
    if (isText(facts?.sharedClass) && isTruncationToken(facts.sharedClass))
      problems.push(`sharedClass ${facts.sharedClass} is itself a per-call-site utility`);
    reviewedProblems(facts?.clampOwners, 'clampOwners', problems, {
      key: 'selector',
      nonEmpty: true,
    });
    if (
      Array.isArray(facts?.clampOwners) &&
      isText(facts?.sharedClass) &&
      !facts.clampOwners.some((o) => squash(String(o?.selector)) === `.${facts.sharedClass}`)
    )
      problems.push(`clampOwners does not hold the shared class's selector .${facts.sharedClass}`);
    allowlistProblems(facts?.exceptions, 'exceptions', problems);
    return problems;
  },
  build(facts) {
    const tree = facts.trees[0];
    const owner = facts.clampOwners[0].selector;
    const guard = reviewedAllowlist({
      title: 'titles and names truncate through the one shared class',
      description:
        `Under ${facts.trees.join(', ')}, text truncates only through the shared class \`${facts.sharedClass}\`. Code ` +
        'never names a per-call-site truncation utility (`truncate`, `line-clamp-<n|none|[…]>`, `text-ellipsis`, with ' +
        'or without a variant prefix) in a string, template, or className, and never sets an inline `textOverflow`, ' +
        '`WebkitLineClamp`, or `lineClamp` style. A stylesheet sets `text-overflow: ellipsis`, `-webkit-line-clamp`, or ' +
        '`line-clamp` (or applies one of ' +
        `those utilities) only in a rule whose every selector is a clamp owner (${facts.clampOwners.map((o) => o.selector).join(', ')}). ` +
        'Use the shared class, or add a clamp owner or a reviewed exception with its why.',
      scope: APP_CODE_AND_STYLES,
      match: (file) => truncationHits(file, facts),
      allowlist: facts.exceptions,
      samples: {
        flags: [
          { path: `${tree}/sample.tsx`, text: '<h2 className="font-bold truncate">{title}</h2>' },
          { path: `${tree}/sample.tsx`, text: 'const c = cn(`md:line-clamp-2 ${x}`);' },
          {
            path: `${tree}/sample.tsx`,
            text: "<p className={open ? 'line-clamp-none' : 'text-ellipsis'} />",
          },
          { path: `${tree}/sample.tsx`, text: "<p style={{ textOverflow: 'ellipsis' }} />" },
          { path: `${tree}/sample.css`, text: '.card-title { text-overflow: ellipsis; }' },
          { path: `${tree}/sample.css`, text: '.card-title { @apply line-clamp-3; }' },
        ],
        passes: [
          {
            path: `${tree}/sample.tsx`,
            text: `<h2 className="font-bold ${facts.sharedClass}">{title}</h2>`,
          },
          {
            path: `${tree}/sample.tsx`,
            text: '// a truncate class would go here\nconst mode = "truncated";',
          },
          { path: `${tree}/sample.css`, text: `${owner} { text-overflow: ellipsis; }` },
          { path: `${tree}/sample.css`, text: '.card { text-overflow: clip; }' },
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
          const held = new Set<string>();
          for (const file of files)
            if (file.kind === 'stylesheet')
              for (const clamp of stylesheetClamps(file))
                for (const s of clamp.selectors) held.add(s);
          for (const { selector } of facts.clampOwners)
            if (!held.has(squash(selector)))
              findings.push({
                file: '(clampOwners)',
                detail: `stale clamp owner: no stylesheet rule for ${selector} truncates any more`,
              });
          return findings;
        },
      },
    ];
  },
};
