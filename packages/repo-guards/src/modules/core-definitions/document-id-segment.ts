import type { Finding } from '../../guard.js';
import type { GenericGuardDefinition } from '../../node/suite/config.js';
import {
  namesProblem,
  reviewedProblems,
  loaderProblem,
  type Loader,
  textProblem,
} from '../../support/facts.js';
import { coreBuild } from './shared.js';

type SchemaModules = Readonly<Record<string, Readonly<Record<string, unknown>>>>;

export interface DocumentIdSegmentFacts {
  wireModules: Loader<SchemaModules>;
  wireInputNameSuffixes: readonly string[];
  idAtomNameSuffix: string;
  requiredWireInputs: readonly string[];
  requiredIdAtoms: readonly string[];
  notClientSent: ReadonlyArray<{ schema: string; why: string }>;
  notAPathSegment: ReadonlyArray<{ field: string; why: string }>;
  multiSegmentReferences: ReadonlyArray<{ schema: string; why: string }>;
}

export const NOT_ONE_SEGMENT: readonly string[] = Object.freeze([
  '',
  'a/b',
  '/a',
  'a/',
  '.',
  '..',
  '__reserved__',
]);
export const PADDED: readonly string[] = Object.freeze([
  ' ',
  '  ',
  ' a',
  'a ',
  '\ta',
  'a\t',
  '\na',
  'a\n',
]);
const PLAIN_ID = 'abc123XYZ';
const ID_FIELD_NAME = /^(id|uid|ids|uids)$|(Id|Ids|Uid|Uids)$/;
const WRAPPERS = new Set([
  'optional',
  'nullable',
  'default',
  'prefault',
  'readonly',
  'catch',
  'nonoptional',
]);

type Def = { type: string } & Record<string, unknown>;
type Parseable = { safeParse: (value: unknown) => { success: boolean } };

const defOf = (schema: unknown): Def | undefined =>
  (schema as { _zod?: { def?: Def } } | undefined)?._zod?.def;
const isParseable = (value: unknown): value is Parseable =>
  typeof (value as Parseable | undefined)?.safeParse === 'function';

function leafOf(schema: unknown): unknown {
  let current = schema;
  for (let def = defOf(current); def; def = defOf(current)) {
    if (WRAPPERS.has(def.type)) current = def.innerType;
    else if (def.type === 'array') current = def.element;
    else if (def.type === 'pipe') current = def.in;
    else break;
  }
  return current;
}

function idFieldsAdmitting(
  root: unknown,
  rootName: string,
  exportedNames: ReadonlyMap<unknown, string>,
  values: readonly string[],
  skip: ReadonlySet<unknown>,
): string[] {
  const found = new Set<string>();
  const visiting = new Set<unknown>();
  const visit = (schema: unknown, path: string) => {
    const def = defOf(schema);
    if (!def || visiting.has(schema)) return;
    const at = (schema === root ? undefined : exportedNames.get(schema)) ?? path;
    visiting.add(schema);
    if (def.type === 'object') {
      for (const [key, field] of Object.entries(def.shape as Record<string, unknown>)) {
        const fieldPath = `${at}.${key}`;
        const leaf = leafOf(field);
        if (ID_FIELD_NAME.test(key) && !skip.has(leaf) && isParseable(leaf)) {
          if (values.some((value) => leaf.safeParse(value).success)) found.add(fieldPath);
        }
        visit(field, fieldPath);
      }
    } else if (WRAPPERS.has(def.type)) visit(def.innerType, at);
    else if (def.type === 'array') visit(def.element, at);
    else if (def.type === 'union') for (const option of def.options as unknown[]) visit(option, at);
    else if (def.type === 'intersection') {
      visit(def.left, at);
      visit(def.right, at);
    } else if (def.type === 'pipe') visit(def.in, at);
    else if (def.type === 'lazy') visit((def.getter as () => unknown)(), at);
    visiting.delete(schema);
  };
  visit(root, rootName);
  return [...found];
}

export function nonSegmentIdFields(
  root: unknown,
  rootName: string,
  exportedNames: ReadonlyMap<unknown, string>,
  multiSegment: ReadonlySet<unknown>,
): string[] {
  return idFieldsAdmitting(root, rootName, exportedNames, NOT_ONE_SEGMENT, multiSegment);
}

export function paddedIdFields(
  root: unknown,
  rootName: string,
  exportedNames: ReadonlyMap<unknown, string>,
): string[] {
  return idFieldsAdmitting(root, rootName, exportedNames, PADDED, new Set());
}

const entry = (name: string) => `(core) ${name}`;

async function exportsOf(facts: DocumentIdSegmentFacts) {
  const modules = await facts.wireModules();
  const exported = new Map<string, unknown>();
  const names = new Map<unknown, string>();
  for (const module of Object.values(modules)) {
    for (const [name, value] of Object.entries(module)) {
      if (!defOf(value)) continue;
      if (!exported.has(name)) exported.set(name, value);
      if (!names.has(value)) names.set(value, name);
    }
  }
  return { exported, names };
}

export const documentIdSegmentGuard: GenericGuardDefinition<DocumentIdSegmentFacts> = {
  id: 'documentIdSegments',
  absentWhen: 'the app stores nothing in Firestore',
  factProblems(facts) {
    const problems: string[] = [];
    loaderProblem(facts?.wireModules, 'wireModules', problems);
    namesProblem(facts?.wireInputNameSuffixes, 'wireInputNameSuffixes', problems);
    textProblem(facts?.idAtomNameSuffix, 'idAtomNameSuffix', problems);
    namesProblem(facts?.requiredWireInputs, 'requiredWireInputs', problems);
    namesProblem(facts?.requiredIdAtoms, 'requiredIdAtoms', problems);
    reviewedProblems(facts?.notClientSent, 'notClientSent', problems, { key: 'schema' });
    reviewedProblems(facts?.notAPathSegment, 'notAPathSegment', problems, { key: 'field' });
    reviewedProblems(facts?.multiSegmentReferences, 'multiSegmentReferences', problems, {
      key: 'schema',
    });
    return problems;
  },
  build(facts) {
    const isWireInput = (name: string) => facts.wireInputNameSuffixes.some((s) => name.endsWith(s));
    return [
      {
        title: 'every core id atom admits exactly one document-id segment',
        description:
          'Every id atom the core exports refuses an empty id, a "/", "." and "..", and the reserved __name__ form, ' +
          'and accepts a plain id — so an id a client sends can only ever name one document. Build the atom on the ' +
          "core's one-segment id schema.",
        async run(context) {
          const findings: Finding[] = [];
          coreBuild(context, findings);
          const { exported } = await exportsOf(facts);
          const atoms = [...exported].filter(
            ([name, value]) => name.endsWith(facts.idAtomNameSuffix) && isParseable(value),
          );
          for (const name of facts.requiredIdAtoms) {
            if (!atoms.some(([n]) => n === name))
              findings.push({
                file: entry(name),
                detail: 'a required id atom was not found among the wire modules',
              });
          }
          for (const [name, atom] of atoms as Array<[string, Parseable]>) {
            const admitted = NOT_ONE_SEGMENT.filter((value) => atom.safeParse(value).success);
            if (admitted.length)
              findings.push({
                file: entry(name),
                detail: `admits ${admitted.map((v) => JSON.stringify(v)).join(', ')}`,
              });
            if (defOf(atom)?.type !== 'enum' && !atom.safeParse(PLAIN_ID).success) {
              findings.push({
                file: entry(name),
                detail: `refuses the plain id ${JSON.stringify(PLAIN_ID)}`,
              });
            }
          }
          return findings;
        },
      },
      {
        title: 'every id field a client sends is one document-id segment',
        description:
          'An id-named field (id, uid, or ending Id / Ids / Uid / Uids) in any wire contract a client sends refuses ' +
          'every value that is not one document-id segment, whether it derives from an id atom or is declared inline. ' +
          'Use an id atom. A field that is not a document id is a reviewed entry with its why; a reviewed entry whose ' +
          'field is gone or now one segment is stale.',
        async run(context) {
          const findings: Finding[] = [];
          coreBuild(context, findings);
          const { exported, names } = await exportsOf(facts);
          const multiSegment = new Set<unknown>();
          for (const { schema } of facts.multiSegmentReferences) {
            const value = exported.get(schema);
            if (value === undefined)
              findings.push({
                file: entry(schema),
                detail: 'stale multi-segment reference: the core exports no such schema',
              });
            else multiSegment.add(value);
          }
          const excluded = new Set(facts.notClientSent.map((e) => e.schema));
          const wireInputs = [...exported].filter(([name]) => isWireInput(name));
          for (const schema of excluded) {
            if (!wireInputs.some(([name]) => name === schema))
              findings.push({
                file: entry(schema),
                detail: 'stale not-client-sent entry: no such wire contract',
              });
          }
          for (const name of facts.requiredWireInputs) {
            if (!wireInputs.some(([n]) => n === name))
              findings.push({
                file: entry(name),
                detail: 'a required wire contract was not found among the wire modules',
              });
          }
          const offenders = new Set<string>();
          for (const [name, schema] of wireInputs) {
            if (excluded.has(name)) continue;
            for (const field of nonSegmentIdFields(schema, name, names, multiSegment))
              offenders.add(field);
          }
          const reviewed = new Set(facts.notAPathSegment.map((e) => e.field));
          for (const field of [...offenders].sort()) {
            if (!reviewed.has(field))
              findings.push({
                file: entry(field),
                detail: 'admits a value that is not one document-id segment',
              });
          }
          for (const field of reviewed) {
            if (!offenders.has(field))
              findings.push({
                file: entry(field),
                detail: 'stale reviewed entry: the field is gone or now one segment',
              });
          }
          return findings;
        },
      },
      {
        title: 'no id field a client sends admits a space-only or space-padded value',
        description:
          'An id-named field (id, uid, ids, uids, or ending Id / Ids / Uid / Uids) in any wire contract a client sends ' +
          'refuses a space-only value and a value with whitespace at either end — every field, with no reviewed exemption, ' +
          'since no id the platform mints holds either. Build the field on an id atom, or give a field that is not a ' +
          'document id its own rule that refuses padding.',
        async run(context) {
          const findings: Finding[] = [];
          coreBuild(context, findings);
          const { exported, names } = await exportsOf(facts);
          const excluded = new Set(facts.notClientSent.map((e) => e.schema));
          const offenders = new Set<string>();
          for (const [name, schema] of exported) {
            if (!isWireInput(name) || excluded.has(name)) continue;
            for (const field of paddedIdFields(schema, name, names)) offenders.add(field);
          }
          for (const field of [...offenders].sort())
            findings.push({
              file: entry(field),
              detail: 'admits a space-only or space-padded value',
            });
          return findings;
        },
      },
    ];
  },
};
