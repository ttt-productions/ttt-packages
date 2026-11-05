import ts from 'typescript';
import type { GenericGuardDefinition } from '../../node/suite/config.js';
import type { Finding, GuardContext } from '../../guard.js';
import type { Reviewed } from '../../node/layout.js';
import type { FileView } from '../../reader/view.js';
import { reviewedAllowlist, type Hit } from '../../shapes/shapes.js';
import {
  identifierProblem,
  isText,
  namesProblem,
  objectProblem,
  pathProblem,
  reviewedProblems,
  textProblem,
} from '../../support/facts.js';
import { escapeRegExp, isUnder } from '../../support/text.js';
import { exportedNames } from '../ui/source.js';
import { installedManifest, splitBareSpecifier } from '../ui/stylesheets.js';
import { kindOfFile } from '../../node/layout.js';
import { moduleImports, type ImportKind } from '../../support/imports.js';
import { resolveSpecifier } from '../../support/resolve-specifier.js';
import { APP_SOURCE } from './shared.js';

export interface AppRouteOwnerFacts {
  owner: { module: string; name: string };
  routePrefixes: readonly string[];
  trees: readonly string[];
  exceptions: readonly Reviewed[];
}

export function literalTexts(file: FileView): Array<{ text: string; index: number }> {
  const sf = file.sourceFile;
  const out: Array<{ text: string; index: number }> = [];
  const visit = (node: ts.Node): void => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      out.push({ text: node.text, index: node.getStart(sf) });
      return;
    }
    if (ts.isTemplateExpression(node)) {
      out.push({ text: node.head.text, index: node.getStart(sf) });
      for (const span of node.templateSpans)
        out.push({ text: span.literal.text, index: span.literal.getStart(sf) });
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

export const routePrefixPattern = (prefix: string): RegExp =>
  new RegExp(`^${escapeRegExp(prefix)}(?:$|[/?#])`);

export function routePrefixProblems(value: unknown, field: string, problems: string[]): void {
  if (!Array.isArray(value)) return;
  for (const prefix of value)
    if (isText(prefix) && !/^\/[^/?#\s]+(?:\/[^/?#\s]+)*$/.test(prefix))
      problems.push(
        `${field} entry ${prefix} must start with / and name whole segments, with no trailing /`,
      );
}

export function routeLiterals(file: FileView, routePrefixes: readonly string[]): Hit[] {
  const patterns = routePrefixes.map(routePrefixPattern);
  return literalTexts(file)
    .filter(({ text }) => patterns.some((p) => p.test(text)))
    .map(({ text, index }) => ({ index, detail: text.slice(0, 80) }));
}

const HOME_PATH = /^\/(?:$|[?#])/;
// A template's opening text before its first substitution: `/` straight into `?` or `#` is the home
// path with a built query or hash; `/${segment}` is some other path.
const HOME_TEMPLATE_HEAD = /^\/[?#]/;
const NAVIGATION_CALLS = new Set([
  'assign',
  'push',
  'replace',
  'navigate',
  'redirect',
  'permanentRedirect',
  'prefetch',
]);
const LINK_ATTRIBUTES = new Set(['href', 'to']);
const LINK_NAME =
  /(?:route|href|redirect|redirectto|redirecturl|returnto|returnurl|callbackurl|nexturl|destination)$/i;
const EQUALITY = new Set([
  ts.SyntaxKind.EqualsEqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsEqualsToken,
  ts.SyntaxKind.EqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsToken,
]);
const FALLBACK = new Set([
  ts.SyntaxKind.QuestionQuestionToken,
  ts.SyntaxKind.BarBarToken,
  ts.SyntaxKind.AmpersandAmpersandToken,
]);

function nameText(name: ts.Node | undefined): string | null {
  if (!name) return null;
  if (ts.isIdentifier(name) || ts.isPrivateIdentifier(name)) return name.text;
  if (ts.isStringLiteral(name) || ts.isNoSubstitutionTemplateLiteral(name)) return name.text;
  if (ts.isPropertyAccessExpression(name)) return name.name.text;
  if (ts.isElementAccessExpression(name)) return nameText(name.argumentExpression);
  if (ts.isJsxNamespacedName(name)) return name.name.text;
  return null;
}

function linkPosition(literal: ts.Node): boolean {
  let node: ts.Node = literal;
  let parent = node.parent;
  while (
    ts.isParenthesizedExpression(parent) ||
    ts.isAsExpression(parent) ||
    ts.isSatisfiesExpression(parent) ||
    ts.isNonNullExpression(parent) ||
    ts.isTypeAssertionExpression(parent) ||
    (ts.isConditionalExpression(parent) && parent.condition !== node) ||
    (ts.isBinaryExpression(parent) && FALLBACK.has(parent.operatorToken.kind)) ||
    ts.isJsxExpression(parent)
  ) {
    node = parent;
    parent = node.parent;
  }
  if (ts.isJsxAttribute(parent)) return LINK_ATTRIBUTES.has(nameText(parent.name) ?? '');
  if (ts.isCallExpression(parent) && parent.arguments[0] === node)
    return NAVIGATION_CALLS.has(nameText(parent.expression) ?? '');
  if (
    (ts.isVariableDeclaration(parent) ||
      ts.isParameter(parent) ||
      ts.isPropertyAssignment(parent) ||
      ts.isPropertyDeclaration(parent) ||
      ts.isBindingElement(parent)) &&
    parent.initializer === node
  )
    return LINK_NAME.test(nameText(parent.name) ?? '');
  if (ts.isBinaryExpression(parent)) {
    if (EQUALITY.has(parent.operatorToken.kind))
      return LINK_NAME.test(nameText(parent.left === node ? parent.right : parent.left) ?? '');
    if (parent.operatorToken.kind === ts.SyntaxKind.EqualsToken && parent.right === node)
      return LINK_NAME.test(nameText(parent.left) ?? '');
  }
  return false;
}

export function homeLinkLiterals(file: FileView): Hit[] {
  const sf = file.sourceFile;
  const out: Hit[] = [];
  const visit = (node: ts.Node): void => {
    if (
      (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) &&
      HOME_PATH.test(node.text) &&
      linkPosition(node)
    )
      out.push({ index: node.getStart(sf), detail: node.text.slice(0, 80) });
    else if (
      ts.isTemplateExpression(node) &&
      HOME_TEMPLATE_HEAD.test(node.head.text) &&
      linkPosition(node)
    )
      out.push({ index: node.getStart(sf), detail: node.head.text.slice(0, 80) });
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

function pickEntry(entry: unknown): string | null {
  if (typeof entry === 'string') return entry;
  if (entry && typeof entry === 'object') {
    const conditions = entry as Record<string, unknown>;
    for (const key of ['import', 'module', 'default', 'require', 'node']) {
      const found = pickEntry(conditions[key]);
      if (found) return found;
    }
  }
  return null;
}

function installedEntry(context: GuardContext, module: string): string | null {
  const { name, subpath } = splitBareSpecifier(module);
  const manifest = installedManifest(context, name);
  if (!manifest) return null;
  const exportsField = manifest.exports;
  const keyed =
    !!exportsField &&
    typeof exportsField === 'object' &&
    Object.keys(exportsField).some((k) => k.startsWith('.'));
  const fallback =
    typeof manifest.module === 'string'
      ? manifest.module
      : typeof manifest.main === 'string'
        ? manifest.main
        : './index.js';
  const target = keyed
    ? pickEntry((exportsField as Record<string, unknown>)[subpath])
    : exportsField !== undefined
      ? subpath === '.'
        ? pickEntry(exportsField)
        : null
      : subpath !== '.'
        ? subpath
        : fallback;
  if (!target) return null;
  const base = `node_modules/${name}/package.json`;
  const resolved = resolveSpecifier(
    context.reader,
    base,
    target.startsWith('.') ? target : `./${target}`,
    [],
  );
  return context.reader.exists(resolved) ? resolved : null;
}

function localLoads(context: GuardContext, file: FileView, kinds: readonly ImportKind[]) {
  const out: string[] = [];
  for (const site of moduleImports(file.sourceFile, kinds)) {
    if (!site.spec.startsWith('.')) continue;
    const resolved = resolveSpecifier(context.reader, file.path, site.spec, []);
    if (
      context.reader.exists(resolved) &&
      kindOfFile(resolved.slice(resolved.lastIndexOf('/') + 1)) === 'code'
    )
      out.push(resolved);
  }
  return out;
}

function ownerCode(
  context: GuardContext,
  module: string,
): { files: FileView[]; entry: FileView; where: string } | null {
  const entryPath = context.reader.exists(module) ? module : installedEntry(context, module);
  if (!entryPath) return null;
  const entry = context.file(entryPath);
  const seen = new Map<string, FileView>([[entryPath, entry]]);
  const queue = [entry];
  while (queue.length) {
    const file = queue.shift()!;
    for (const path of localLoads(context, file, ['import', 'export'])) {
      if (seen.has(path)) continue;
      const next = context.file(path);
      seen.set(path, next);
      queue.push(next);
    }
  }
  return { files: [...seen.values()], entry, where: module };
}

function exportsName(
  context: GuardContext,
  file: FileView,
  name: string,
  seen: Set<string> = new Set(),
): boolean {
  const key = `${file.path}#${name}`;
  if (seen.has(key)) return false;
  seen.add(key);
  const target = (spec: ts.Expression): FileView | null => {
    if (!ts.isStringLiteral(spec) || !spec.text.startsWith('.')) return null;
    const resolved = resolveSpecifier(context.reader, file.path, spec.text, []);
    return context.reader.exists(resolved) ? context.file(resolved) : null;
  };
  for (const statement of file.sourceFile.statements) {
    if (!ts.isExportDeclaration(statement)) continue;
    const clause = statement.exportClause;
    if (!statement.moduleSpecifier) {
      if (clause && ts.isNamedExports(clause) && clause.elements.some((e) => e.name.text === name))
        return true;
      continue;
    }
    if (clause && ts.isNamespaceExport(clause)) {
      if (clause.name.text === name) return true;
      continue;
    }
    const from = target(statement.moduleSpecifier);
    if (!from) continue;
    if (!clause) {
      if (exportsName(context, from, name, seen)) return true;
      continue;
    }
    const element = clause.elements.find((e) => e.name.text === name);
    if (element)
      return exportsName(context, from, (element.propertyName ?? element.name).text, seen);
  }
  const reExported = new Set(
    file.sourceFile.statements
      .filter(ts.isExportDeclaration)
      .flatMap((s) =>
        s.exportClause && ts.isNamedExports(s.exportClause)
          ? s.exportClause.elements.map((e) => e.name.text)
          : [],
      ),
  );
  return !reExported.has(name) && exportedNames(file).has(name);
}

export const appRouteOwnerGuard: GenericGuardDefinition<AppRouteOwnerFacts> = {
  id: 'appRouteOwner',
  absentWhen: false,
  factProblems(facts) {
    const problems: string[] = [];
    if (objectProblem(facts?.owner, 'owner', problems)) {
      textProblem(facts.owner.module, 'owner.module', problems);
      identifierProblem(facts.owner.name, 'owner.name', problems);
    }
    namesProblem(facts?.routePrefixes, 'routePrefixes', problems);
    routePrefixProblems(facts?.routePrefixes, 'routePrefixes', problems);
    if (!Array.isArray(facts?.trees) || !facts.trees.length) problems.push('trees is missing');
    else facts.trees.forEach((t, i) => pathProblem(t, `trees[${i}]`, problems));
    reviewedProblems(facts?.exceptions, 'exceptions', problems);
    return problems;
  },
  build(facts) {
    const { module, name } = facts.owner;
    const tree = facts.trees[0];
    const [prefix] = facts.routePrefixes;
    const inTrees = (file: FileView) => facts.trees.some((t) => isUnder(file.path, t));
    const guard = reviewedAllowlist({
      title: 'app routes are built by the one route owner',
      description:
        `An app page path is declared once and built through \`${name}\` from ${module}. Under ${facts.trees.join(', ')}, ` +
        `no other code holds a string or template literal that starts with one of the page roots ` +
        `(${facts.routePrefixes.join(', ')}) as a whole segment — in an href, a navigation call, a redirect, a link in a ` +
        'message, or anywhere else: a route written by hand drifts from its declaration the day the page moves. Build ' +
        `the path with \`${name}\`. A framework route file or another genuine non-route literal is a reviewed exception ` +
        'with its why; an exception that no longer holds such a literal is stale, and so is a page root the owner no ' +
        'longer builds. The home path `/` is held where it is used as a link: a hand-typed `/` (alone, or before ' +
        '`?` or `#`, in a string or opening a template) as an `href` or `to`, as the first argument of a navigation ' +
        'call (`assign`, `push`, `replace`, `navigate`, `redirect`, `permanentRedirect`, `prefetch`), given to a name ' +
        'ending in `route`, `href`, `redirect`, `redirectTo`, `redirectUrl`, `returnTo`, `returnUrl`, `callbackUrl`, ' +
        '`nextUrl` or `destination`, or compared against one, is a hand-built home link; a `/` anywhere else (a ' +
        "cookie path, a server route, a path split, a request's own `url`) is not a page link.",
      scope: APP_SOURCE,
      match: (file) =>
        inTrees(file) && file.path !== module
          ? [...routeLiterals(file, facts.routePrefixes), ...homeLinkLiterals(file)].sort(
              (a, b) => a.index - b.index,
            )
          : [],
      allowlist: facts.exceptions,
      samples: {
        flags: [
          { path: `${tree}/probe.tsx`, text: `<Link href="${prefix}">Open</Link>` },
          { path: `${tree}/probe.tsx`, text: `router.push(\`${prefix}/\${id}/edit\`);` },
          { path: `${tree}/probe.ts`, text: `redirect('${prefix}?tab=a');` },
          { path: `${tree}/probe.ts`, text: `const url = \`\${origin}${prefix}/\${id}\`;` },
          { path: `${tree}/probe.tsx`, text: `<Link href="/">Home</Link>` },
          { path: `${tree}/probe.ts`, text: `void navigate('/', { replace: true });` },
          { path: `${tree}/probe.ts`, text: `export const SIGNED_OUT_ROUTE = '/';` },
          { path: `${tree}/probe.ts`, text: `const top = route === '/' ? 1 : 0;` },
          { path: `${tree}/probe.ts`, text: `window.location.assign('/');` },
          { path: `${tree}/probe.ts`, text: `const callbackUrl = '/';` },
          { path: `${tree}/probe.ts`, text: `signIn({ redirectTo: '/#top' });` },
          { path: `${tree}/probe.tsx`, text: `<Link href={\`/?tab=\${tab}\`}>Home</Link>` },
        ],
        passes: [
          { path: `${tree}/probe.tsx`, text: `<Link href={${name}.home()}>Open</Link>` },
          { path: `${tree}/probe.ts`, text: `const other = '${prefix}x';` },
          { path: `${tree}/probe.ts`, text: `// the page lives at ${prefix}\nconst n = 1;` },
          { path: `${tree}/probe.ts`, text: `const cookie = { path: '/', httpOnly: true };` },
          { path: `${tree}/probe.ts`, text: `const id = path.split('/').pop();` },
          { path: `${tree}/probe.ts`, text: `app.post('/', handler);` },
          { path: `${tree}/probe.ts`, text: `const pathname = usePathname() ?? '/';` },
          { path: `${tree}/probe.tsx`, text: `<Link href={\`/\${slug}\`}>Open</Link>` },
          { path: `${tree}/probe.ts`, text: `const signedPath = '/';` },
          { path: `${tree}/probe.ts`, text: `class Fake { url = '/'; }` },
        ],
      },
    });
    return [
      {
        ...guard,
        async run(context) {
          const findings: Finding[] = [...(await guard.run(context))];
          const scanned = context.files(APP_SOURCE).filter(inTrees);
          for (const t of facts.trees)
            if (!scanned.some((f) => isUnder(f.path, t)))
              findings.push({
                file: t,
                detail: 'the tree holds no production code the guard can read',
              });
          const owner = ownerCode(context, module);
          if (!owner) {
            findings.push({
              file: module,
              detail:
                'the route owner cannot be read: no such file, and no installed entry for that subpath',
            });
            return findings;
          }
          if (!exportsName(context, owner.entry, name))
            findings.push({
              file: module,
              detail: `the route owner no longer exports ${name} (read from ${owner.where})`,
            });
          for (const p of facts.routePrefixes)
            if (!owner.files.some((f) => routeLiterals(f, [p]).length))
              findings.push({
                file: '(routePrefixes)',
                detail: `stale page root: ${owner.where} no longer builds any path under ${p}`,
              });
          return findings;
        },
      },
    ];
  },
};
