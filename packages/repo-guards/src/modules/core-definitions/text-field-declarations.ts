import ts from 'typescript';
import type { Finding, GuardContext } from '../../guard.js';
import type { GenericGuardDefinition } from '../../node/suite/config.js';
import type { FileView } from '../../reader/view.js';
import { lineOfNode } from '../../support/ast.js';
import {
  namesProblem,
  reviewedProblems,
  loaderProblem,
  type Loader,
  textProblem,
} from '../../support/facts.js';
import { CORE_CODE, coreBuild, filesIn, isCount, topLevelDeclaration } from './shared.js';
import { REPOSITORY_GUARD_TIMEOUT_MS } from '../../support/timeouts.js';

type ReviewedCounts = ReadonlyArray<{
  file: string;
  declaration: string;
  count: number;
  why: string;
}>;
type FieldSchema = { safeParse: (value: unknown) => { success: boolean; data?: unknown } };

// A method, so the app's own reader — typed on its declaration type — fits it as declared, and the
// guard hands it the declarations it loaded from that same module.
interface FieldSchemaOf {
  schemaOf(declaration: unknown): FieldSchema;
}

export interface TextFieldDeclarationFacts {
  wireFolders: readonly string[];
  declarationsFile: string;
  wireInputNameSuffixes: readonly string[];
  selfBounded: ReviewedCounts;
  undeclaredFreeText: ReviewedCounts;
  keepAsTyped: ReadonlyArray<{ declaration: string; why: string }>;
  declarations: Loader<Readonly<Record<string, unknown>>>;
  fieldSchema: Loader<FieldSchemaOf['schemaOf']>;
}

const isZString = (node: ts.Node): node is ts.CallExpression =>
  ts.isCallExpression(node) &&
  ts.isPropertyAccessExpression(node.expression) &&
  node.expression.name.text === 'string' &&
  ts.isIdentifier(node.expression.expression) &&
  node.expression.expression.text === 'z';

const TEXT_LENGTH_CONSTANT = /^(MAX|MIN)_(?![A-Z0-9_]*_ID_LENGTH$)[A-Z0-9_]*LENGTH$/;
const FREE_TEXT_PROPERTY =
  /reason|message|text|note|comment|title|description|name|subject|caption|summary|statement|facts|letter|label|heading|body|query|content|suggestion|region|country|value|intro|points|strings|term/i;
const BUILT_IN_FORMAT_METHODS = new Set(['regex', 'url', 'email', 'uuid']);

function chainedCalls(root: ts.CallExpression): ts.CallExpression[] {
  const calls: ts.CallExpression[] = [];
  let node: ts.Node = root;
  while (
    ts.isPropertyAccessExpression(node.parent) &&
    node.parent.expression === node &&
    ts.isCallExpression(node.parent.parent)
  ) {
    calls.push(node.parent.parent);
    node = node.parent.parent;
  }
  return calls;
}

const methodOf = (call: ts.CallExpression) =>
  (call.expression as ts.PropertyAccessExpression).name.text;

interface Site {
  key: string;
  line: number;
}

export function selfBoundedChains(file: FileView): Site[] {
  const sites: Site[] = [];
  const visit = (node: ts.Node): void => {
    if (isZString(node)) {
      const bounded = chainedCalls(node).some((call) => {
        const method = methodOf(call);
        if (method === 'trim') return true;
        if (method !== 'min' && method !== 'max') return false;
        const [argument] = call.arguments;
        return (
          argument !== undefined &&
          ts.isIdentifier(argument) &&
          TEXT_LENGTH_CONSTANT.test(argument.text)
        );
      });
      if (bounded)
        sites.push({
          key: `${file.path}#${topLevelDeclaration(node)}`,
          line: lineOfNode(file, node),
        });
    }
    ts.forEachChild(node, visit);
  };
  visit(file.sourceFile);
  return sites;
}

export function undeclaredFreeText(
  file: FileView,
  isWireInput: (declaration: string) => boolean,
): Site[] {
  const sites: Site[] = [];
  const visit = (node: ts.Node): void => {
    if (isZString(node)) {
      const declaration = topLevelDeclaration(node);
      const calls = chainedCalls(node);
      const outer: ts.Node = calls.length ? calls[calls.length - 1] : node;
      const parent = outer.parent;
      let property: string | null = null;
      if (parent && ts.isPropertyAssignment(parent))
        property = parent.name.getText(file.sourceFile);
      else if (
        parent &&
        ts.isCallExpression(parent) &&
        parent.parent &&
        ts.isPropertyAssignment(parent.parent)
      ) {
        property = parent.parent.name.getText(file.sourceFile);
      }
      const builtIn = calls.some((call) => BUILT_IN_FORMAT_METHODS.has(methodOf(call)));
      if (
        property !== null &&
        isWireInput(declaration) &&
        FREE_TEXT_PROPERTY.test(property) &&
        !builtIn
      ) {
        sites.push({ key: `${file.path}#${declaration}`, line: lineOfNode(file, node) });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file.sourceFile);
  return sites;
}

function compareReviewed(
  sites: readonly Site[],
  reviewed: ReviewedCounts,
  what: string,
): Finding[] {
  const findings: Finding[] = [];
  const byKey = new Map<string, Site[]>();
  for (const site of sites) byKey.set(site.key, [...(byKey.get(site.key) ?? []), site]);
  const allowed = new Map(reviewed.map((e) => [`${e.file}#${e.declaration}`, e.count]));
  for (const [key, found] of byKey) {
    const count = allowed.get(key) ?? 0;
    const file = key.slice(0, key.indexOf('#'));
    for (const site of found.slice(count))
      findings.push({
        file,
        line: site.line,
        detail: `${what} in ${key.slice(key.indexOf('#') + 1)}${count ? ` beyond the ${count} reviewed` : ''}`,
      });
  }
  for (const [key, count] of allowed) {
    const found = byKey.get(key)?.length ?? 0;
    if (found < count)
      findings.push({
        file: key.slice(0, key.indexOf('#')),
        detail: `stale reviewed count for ${key}: reviewed ${count}, found ${found}`,
      });
  }
  return findings;
}

type Declaration = { format?: unknown; min?: number; keepAsTyped?: unknown };

const FREE_TEXT_FORMAT = 'none';
const textDeclarations = (exports: Readonly<Record<string, unknown>>) =>
  Object.entries(exports).filter(
    (e): e is [string, Declaration] =>
      typeof e[1] === 'object' && e[1] !== null && 'format' in e[1],
  );

const reviewedCountProblems = (value: unknown, what: string, problems: string[]) =>
  reviewedProblems(value, what, problems, {
    key: 'file',
    id: (e) =>
      typeof e.declaration === 'string' && e.declaration.trim()
        ? `${e.file}#${e.declaration}`
        : undefined,
    idNames: 'declaration',
    extra(entry, label) {
      if (!isCount(entry.count)) problems.push(`${label}'s count must be a positive whole number`);
    },
  });

export const textFieldDeclarationsGuard: GenericGuardDefinition<TextFieldDeclarationFacts> = {
  id: 'textFieldDeclarations',
  absentWhen: "the app's core declares no text field through input-format-core",
  factProblems(facts) {
    const problems: string[] = [];
    namesProblem(facts?.wireFolders, 'wireFolders', problems);
    textProblem(facts?.declarationsFile, 'declarationsFile', problems);
    namesProblem(facts?.wireInputNameSuffixes, 'wireInputNameSuffixes', problems);
    reviewedCountProblems(facts?.selfBounded, 'selfBounded', problems);
    reviewedCountProblems(facts?.undeclaredFreeText, 'undeclaredFreeText', problems);
    reviewedProblems(facts?.keepAsTyped, 'keepAsTyped', problems, { key: 'declaration' });
    loaderProblem(facts?.declarations, 'declarations', problems);
    loaderProblem(facts?.fieldSchema, 'fieldSchema', problems);
    return problems;
  },
  build(facts) {
    const isWireInput = (name: string) => facts.wireInputNameSuffixes.some((s) => name.endsWith(s));
    const wireFiles = (context: GuardContext, findings: Finding[]) =>
      filesIn(context.files(CORE_CODE), facts.wireFolders, findings);
    return [
      {
        title: 'every free-text property of a core wire input is a declared text field',
        description:
          'A wire input property that names free text (reason, message, title, …) reads its declared text field through ' +
          "the core's field-schema builder, or carries a built-in format (.regex / .url / .email / .uuid). Wire text no " +
          'person types is a reviewed module#declaration count with why; a count that no longer matches fails.',
        timeoutMs: REPOSITORY_GUARD_TIMEOUT_MS,
        run(context) {
          const findings: Finding[] = [];
          const sites = wireFiles(context, findings).flatMap((f) =>
            undeclaredFreeText(f, isWireInput),
          );
          return [
            ...findings,
            ...compareReviewed(
              sites,
              facts.undeclaredFreeText,
              'an undeclared free-text z.string() property',
            ),
          ];
        },
      },
      {
        title: 'no core wire schema trims or bounds a text field itself',
        description:
          'A wire z.string() chain never trims itself or bounds itself by a text-length constant: that is a second ' +
          "declaration of the field. Read the field's declaration through the core's field-schema builder. Wire text no " +
          'person types (stored values, fixed strings, ids, addresses) is a reviewed module#declaration count with why.',
        timeoutMs: REPOSITORY_GUARD_TIMEOUT_MS,
        run(context) {
          const findings: Finding[] = [];
          const sites = wireFiles(context, findings).flatMap(selfBoundedChains);
          return [
            ...findings,
            ...compareReviewed(sites, facts.selfBounded, 'a self-bounded z.string() chain'),
          ];
        },
      },
      {
        title: 'text fields are declared only in the core declarations module',
        description:
          'defineInputFormat is called, and keepAsTyped is set, only in the one module that declares every text field, ' +
          'so each field has one declaration. Move the declaration there and import it.',
        timeoutMs: REPOSITORY_GUARD_TIMEOUT_MS,
        run(context) {
          const findings: Finding[] = [];
          const files = context.files(CORE_CODE);
          if (!files.some((f) => f.path === facts.declarationsFile)) {
            findings.push({
              file: facts.declarationsFile,
              detail: 'the declarations module is not in the core build',
            });
          }
          for (const file of files) {
            if (file.path === facts.declarationsFile) continue;
            for (const m of file.code.matchAll(/\bdefineInputFormat\s*\(|\bkeepAsTyped\b/g)) {
              findings.push({
                file: file.path,
                line: file.lineOf(m.index ?? 0),
                detail: `${m[0].replace(/\s*\($/, '')} outside the declarations module`,
              });
            }
          }
          return findings;
        },
      },
      {
        title: 'only the reviewed text fields keep their text as typed',
        description:
          'Every declared text field is trimmed unless it is a reviewed keep-as-typed declaration with why (a legal or ' +
          'statutory text whose exact characters matter). A declaration that newly keeps its text fails until reviewed, ' +
          'and a reviewed one that no longer does is stale.',
        async run(context) {
          const findings: Finding[] = [];
          coreBuild(context, findings);
          const kept = new Set(
            textDeclarations(await facts.declarations())
              .filter(([, d]) => 'keepAsTyped' in d)
              .map(([n]) => n),
          );
          const reviewed = new Set(facts.keepAsTyped.map((e) => e.declaration));
          for (const name of [...kept].sort())
            if (!reviewed.has(name))
              findings.push({
                file: `(core) ${name}`,
                detail: 'keeps its text as typed without review',
              });
          for (const name of reviewed)
            if (!kept.has(name))
              findings.push({
                file: `(core) ${name}`,
                detail:
                  'stale keep-as-typed entry: the declaration no longer keeps its text, or is gone',
              });
          return findings;
        },
      },
      {
        title:
          'every declared text field trims, one that holds words keeps one space for each run of spaces, and a required one refuses blank text',
        description:
          "Each text field's wire schema, built from its declaration, refuses whitespace-only text when the field requires " +
          'text (min of 1 or more), and trims the text of every field that does not keep it as typed; a field whose format ' +
          "holds words (every format but free text, 'none') keeps one space for a run of them — so the form, the wire, and the writer agree, and a " +
          'name spaced twice is never stored, searched, or reserved apart from the same name spaced once.',
        async run(context) {
          const findings: Finding[] = [];
          coreBuild(context, findings);
          const declarations = textDeclarations(await facts.declarations());
          const schemaOf = await facts.fieldSchema();
          if (!declarations.length)
            findings.push({
              file: facts.declarationsFile,
              detail: 'no text-field declaration was loaded',
            });
          for (const [name, declaration] of declarations) {
            const schema = schemaOf(declaration);
            const min = typeof declaration.min === 'number' ? declaration.min : 0;
            if (min >= 1 && schema.safeParse(' \n\t ').success)
              findings.push({
                file: `(core) ${name}`,
                detail: 'accepts whitespace-only text although the field requires text',
              });
            if ('keepAsTyped' in declaration) continue;
            const sample = 'a'.repeat(Math.max(min, 1));
            const parsed = schema.safeParse(`  ${sample}  `);
            if (!parsed.success || parsed.data !== sample)
              findings.push({ file: `(core) ${name}`, detail: 'does not trim its text' });
            if (declaration.format === FREE_TEXT_FORMAT) continue;
            const word = 'a'.repeat(Math.max(min - 2, 1));
            if (!schema.safeParse(`${word} a`).success) continue;
            const run = schema.safeParse(`${word}  a`);
            if (!run.success || run.data !== `${word} a`)
              findings.push({
                file: `(core) ${name}`,
                detail: 'keeps a run of spaces instead of one space',
              });
          }
          return findings;
        },
      },
    ];
  },
};
