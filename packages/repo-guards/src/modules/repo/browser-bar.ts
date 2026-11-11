import ts from 'typescript';
import type { GenericGuardDefinition } from '../../node/suite/config.js';
import type { Scope } from '../../node/reader.js';
import type { Finding } from '../../guard.js';
import type { FileView } from '../../reader/view.js';
import type { Hit } from '../../shapes/shapes.js';
import { objectProblem, pathProblem } from '../../support/facts.js';

export interface BrowserBarFacts {
  publicDir: string;
}

const APP_SOURCE: Scope = { roots: ['app'], kinds: ['code'], tests: false };

const CAPABLE_META_NAMES: ReadonlySet<string> = new Set([
  'apple-mobile-web-app-capable',
  'mobile-web-app-capable',
]);

const BROWSER = 'browser';

const MANIFEST_ROUTE = /(^|\/)manifest\.[cm]?[jt]sx?$/;

export const CONVENTIONAL_MANIFESTS: readonly string[] = Object.freeze([
  'manifest.json',
  'manifest.webmanifest',
  'site.webmanifest',
]);

export const APP_FOLDER_MANIFESTS: readonly string[] = Object.freeze([
  'manifest.json',
  'manifest.webmanifest',
]);

export function appFolderManifests(appRoot: string): string[] {
  const root = appRoot.replace(/^\.\/?|\/+$/g, '');
  const folders = root ? [`${root}/app`] : ['app', 'src/app'];
  return folders.flatMap((folder) => APP_FOLDER_MANIFESTS.map((name) => `${folder}/${name}`));
}

const propertyName = (name: ts.PropertyName): string | null =>
  ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNoSubstitutionTemplateLiteral(name)
    ? name.text
    : null;

const unwrapped = (node: ts.Expression): ts.Expression => {
  let e = node;
  while (
    ts.isParenthesizedExpression(e) ||
    ts.isAsExpression(e) ||
    ts.isSatisfiesExpression(e) ||
    ts.isNonNullExpression(e)
  )
    e = e.expression;
  return e;
};

const stringOf = (node: ts.Expression): string | null => {
  const e = unwrapped(node);
  return ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e) ? e.text : null;
};

function appleWebAppProblem(value: ts.Expression): string | null {
  const e = unwrapped(value);
  if (e.kind === ts.SyntaxKind.FalseKeyword) return null;
  if (e.kind === ts.SyntaxKind.TrueKeyword)
    return 'appleWebApp: true lets the site open from the home screen with no browser bar';
  if (!ts.isObjectLiteralExpression(e))
    return 'appleWebApp is set to a value the guard cannot read; write it as a literal without capable';
  const capable = e.properties.find(
    (p): p is ts.PropertyAssignment =>
      ts.isPropertyAssignment(p) && propertyName(p.name) === 'capable',
  );
  if (e.properties.some((p) => ts.isSpreadAssignment(p)))
    return 'appleWebApp spreads a value the guard cannot read; write it as a literal without capable';
  if (!capable)
    return 'appleWebApp with no capable: false turns capable on, so the site opens with no browser bar';
  if (unwrapped(capable.initializer).kind === ts.SyntaxKind.FalseKeyword) return null;
  return 'appleWebApp.capable lets the site open from the home screen with no browser bar';
}

function displayProblem(key: 'display' | 'display_override', value: ts.Expression): string | null {
  const e = unwrapped(value);
  if (key === 'display') {
    const text = stringOf(e);
    if (text === BROWSER) return null;
    return text === null
      ? 'the manifest sets display to a value the guard cannot read; write display: browser'
      : `the manifest sets display: '${text}', which opens the site with no browser bar; write display: browser`;
  }
  if (!ts.isArrayLiteralExpression(e))
    return 'the manifest sets display_override to a value the guard cannot read; leave it out';
  const modes = e.elements.map((m) => (ts.isExpression(m) ? stringOf(m) : null));
  if (modes.every((m) => m === BROWSER)) return null;
  return `the manifest's display_override [${modes.map((m) => m ?? '?').join(', ')}] can open the site with no browser bar; leave it out`;
}

export function barlessSettings(file: FileView): Hit[] {
  const sf = file.sourceFile;
  const manifestRoute = MANIFEST_ROUTE.test(file.path);
  const hits: Hit[] = [];
  const walk = (node: ts.Node): void => {
    if (ts.isPropertyAssignment(node) || ts.isShorthandPropertyAssignment(node)) {
      const name = propertyName(node.name);
      const value = ts.isPropertyAssignment(node) ? node.initializer : node.name;
      let detail: string | null = null;
      if (name === 'appleWebApp') detail = appleWebAppProblem(value);
      else if (manifestRoute && (name === 'display' || name === 'display_override'))
        detail = displayProblem(name, value);
      if (detail) hits.push({ index: node.getStart(sf), detail });
    }
    if (
      (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) &&
      CAPABLE_META_NAMES.has(node.text)
    )
      hits.push({
        index: node.getStart(sf),
        detail: `the ${node.text} meta lets the site open from the home screen with no browser bar`,
      });
    ts.forEachChild(node, walk);
  };
  walk(sf);
  return hits.sort((a, b) => a.index - b.index);
}

function jsxString(attribute: ts.JsxAttributeLike | undefined): string | null {
  if (!attribute || !ts.isJsxAttribute(attribute) || !attribute.initializer) return null;
  const init = attribute.initializer;
  if (ts.isStringLiteral(init)) return init.text;
  return ts.isJsxExpression(init) && init.expression ? stringOf(init.expression) : null;
}

export function linkedManifests(file: FileView): string[] {
  const sf = file.sourceFile;
  const out: string[] = [];
  const walk = (node: ts.Node): void => {
    if (ts.isPropertyAssignment(node) && propertyName(node.name) === 'manifest') {
      const href = stringOf(node.initializer);
      if (href !== null) out.push(href);
    }
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      if (node.tagName.getText(sf) === 'link') {
        const attribute = (name: string) =>
          node.attributes.properties.find(
            (p) => ts.isJsxAttribute(p) && p.name.getText(sf) === name,
          );
        if (jsxString(attribute('rel')) === 'manifest') {
          const href = jsxString(attribute('href'));
          if (href !== null) out.push(href);
        }
      }
    }
    ts.forEachChild(node, walk);
  };
  walk(sf);
  return out;
}

export function publicPathOf(href: string, publicDir: string): string | null {
  if (/^[a-z][a-z\d+.-]*:|^\/\//i.test(href)) return null;
  const clean = href.replace(/[?#].*$/, '').replace(/^\.?\//, '');
  return clean ? `${publicDir}/${clean}` : null;
}

export function manifestJsonProblems(text: string): string[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    return [`is not JSON the guard can read (${(err as Error).message})`];
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
    return ['is not a manifest object'];
  const manifest = parsed as Record<string, unknown>;
  const problems: string[] = [];
  if ('display' in manifest && manifest.display !== BROWSER)
    problems.push(
      `sets display: ${JSON.stringify(manifest.display)}, which opens the site with no browser bar; write display: browser`,
    );
  const override = manifest.display_override;
  if (
    'display_override' in manifest &&
    !(Array.isArray(override) && override.every((m) => m === BROWSER))
  )
    problems.push(
      `sets display_override ${JSON.stringify(override)}, which can open the site with no browser bar; leave it out`,
    );
  return problems;
}

export const browserBarGuard: GenericGuardDefinition<BrowserBarFacts> = {
  id: 'browserBarAlwaysShown',
  absentWhen: false,
  factProblems(facts) {
    const problems: string[] = [];
    if (!objectProblem(facts, 'facts', problems)) return problems;
    pathProblem(facts.publicDir, 'publicDir', problems);
    return problems;
  },
  build(facts) {
    const sample = (path: string, text: string) => ({ path, text });
    return [
      {
        title: 'the site always opens with the browser bar',
        description:
          'Nothing lets the site open from the home screen without the browser bar: no metadata object sets appleWebApp ' +
          '(true, or an object without capable: false — an object turns capable on), no code names the ' +
          'apple-mobile-web-app-capable or mobile-web-app-capable meta, and no web manifest sets a display other than ' +
          "browser or a display_override. The manifests read are every manifest route file in the app's source (each " +
          'display or display_override it writes, in its returned object or in any call it makes, must read as browser), ' +
          `and every manifest under ${facts.publicDir} that the app links (a metadata manifest or a <link rel="manifest">) ` +
          `or that sits there by a conventional name (${CONVENTIONAL_MANIFESTS.join(', ')}), and a static manifest in the ` +
          `app router's folder (app/ under the app root: ${APP_FOLDER_MANIFESTS.join(', ')}). A manifest route that returns a ` +
          'manifest builder whose result is always display: browser, and writes no display of its own, passes.',
        run(context) {
          const findings: Finding[] = [];
          if (!context.reader.exists(facts.publicDir))
            findings.push({ file: facts.publicDir, detail: 'the public folder does not exist' });
          const candidates = new Set([
            ...CONVENTIONAL_MANIFESTS.map((n) => `${facts.publicDir}/${n}`),
            ...appFolderManifests(context.reader.layout.roots.app.path),
          ]);
          for (const file of context.files(APP_SOURCE)) {
            for (const hit of barlessSettings(file))
              findings.push({ file: file.path, line: file.lineOf(hit.index), detail: hit.detail! });
            for (const href of linkedManifests(file)) {
              const path = publicPathOf(href, facts.publicDir);
              if (path) candidates.add(path);
            }
          }
          const root = context.reader.layout.repoRoot.replace(/[\\/]+$/, '');
          for (const path of [...candidates].sort()) {
            // The reader keeps no file kind for .webmanifest, so a manifest is read by its full path.
            const text = context.reader.readOutside(`${root}/${path}`);
            if (text === null) continue;
            for (const detail of manifestJsonProblems(text)) findings.push({ file: path, detail });
          }
          return findings;
        },
        samples: {
          flags: [
            sample(
              'src/app/layout.tsx',
              "export const metadata = { appleWebApp: { capable: true, title: 'x' } };",
            ),
            sample(
              'src/app/layout.tsx',
              "export const metadata = { appleWebApp: { title: 'x' } };",
            ),
            sample(
              'src/app/head.tsx',
              'export const H = () => <meta name="apple-mobile-web-app-capable" content="yes" />;',
            ),
            sample(
              'src/app/manifest.ts',
              "export default function manifest() { return { name: 'x', display: 'standalone' }; }",
            ),
            sample(
              'src/app/manifest.ts',
              "export default () => buildManifest({ name: 'x', display: 'fullscreen' });",
            ),
          ],
          passes: [
            sample(
              'src/app/layout.tsx',
              "export const metadata = { appleWebApp: { capable: false, title: 'x' } };",
            ),
            sample('src/app/manifest.ts', "export default () => buildManifest({ name: 'x' });"),
            sample(
              'src/app/manifest.ts',
              "export default function manifest() { return { name: 'x', display: 'browser' }; }",
            ),
            sample('src/components/box.tsx', "const style = { display: 'standalone' };"),
          ],
          probe: (view) => barlessSettings(view),
        },
      },
    ];
  },
};
