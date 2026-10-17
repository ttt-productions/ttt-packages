// The Storage guards:
//   - the Storage rules file restates the core's upload-origin registry exactly — every cap, every
//     origin list, every content-type lane — and keeps the staging block create-only;
//   - a stored object's generation and size are read only through the package helpers.

import { matchBlocks, rulesFunctions } from './rules-syntax.js';
import type { Finding } from '../../guard.js';
import type { GenericGuardDefinition } from '../../config.js';
import type { Scope } from '../../reader/reader.js';
import type { FileView } from '../../reader/view.js';
import { nameListProblems, requireLoader, requireName, reviewedListProblems } from './support.js';

type Loaded<T> = () => T | Promise<T>;

export interface StorageUploadOriginFacts {
  /** The repo-relative Storage rules file. */
  rulesFile: string;
  /** The rules function answering an origin's raw upload cap (`function <name>(origin)`). */
  capFunction: string;
  /** Every declared origin and its raw upload cap in bytes, from the core. */
  originCaps: Loaded<Readonly<Record<string, number>>>;
  /** Rules functions that return a quoted origin list, each with the origins the core puts on it. */
  originLists: ReadonlyArray<{ function: string; origins: Loaded<readonly string[]> }>;
  /** Content-type conditions a rules function must state, each as its exact expression. */
  contentTypeLanes: ReadonlyArray<{ function: string; expression: string }>;
  /** The staging `match` path, as written after `match /` (`uploads/{origin}/{userId}/{fileId}`). */
  stagingPath: string;
}

/** Each `origin == '<o>' ? a * b …` branch of the cap function, as origin → bytes. */
function statedCaps(body: string): Record<string, number> {
  const caps: Record<string, number> = {};
  for (const m of body.matchAll(/origin\s*==\s*'([^']+)'\s*\?\s*([\d\s*]+?)\s*(?=:|$)/g)) {
    caps[m[1]] = m[2].split('*').map((f) => Number(f.trim())).reduce((p, f) => p * f, 1);
  }
  return caps;
}

const squash = (text: string) => text.replace(/\s+/g, ' ').trim();

/**
 * Every way a Storage rules file drifts from the declared registry, one line each. `rulesCode` is the
 * file's comment-blanked code (the reader's `file.code`).
 */
export async function uploadOriginProblems(rulesCode: string, facts: StorageUploadOriginFacts): Promise<string[]> {
  const functions = rulesFunctions(rulesCode);
  const bodyOf = (name: string) => functions.get(name)?.body ?? null;
  const problems: string[] = [];
  const declared = await facts.originCaps();
  const origins = Object.keys(declared);
  if (!origins.length) problems.push('the core declares no upload origin, so the check reads nothing');

  const capBody = bodyOf(facts.capFunction);
  if (capBody === null) problems.push(`no ${facts.capFunction}(origin) function`);
  else {
    const caps = statedCaps(capBody);
    for (const origin of origins) {
      if (caps[origin] !== declared[origin]) problems.push(`${facts.capFunction}('${origin}') is ${caps[origin]}, the core declares ${declared[origin]}`);
    }
    for (const origin of Object.keys(caps)) {
      if (!(origin in declared)) problems.push(`${facts.capFunction} names an undeclared origin '${origin}'`);
    }
    if (!/:\s*0\s*;?\s*$/.test(capBody.trim())) problems.push(`${facts.capFunction} does not fall back to 0 for an unknown origin`);
  }

  for (const list of facts.originLists) {
    const body = bodyOf(list.function);
    const listed = body === null ? [] : [...body.matchAll(/'([^']+)'/g)].map((m) => m[1]).sort();
    const expected = [...(await list.origins())].sort();
    if (body === null) problems.push(`no ${list.function}() function`);
    else if (JSON.stringify(listed) !== JSON.stringify(expected)) {
      problems.push(`${list.function}() lists [${listed.join(', ')}], the core declares [${expected.join(', ')}]`);
    }
  }

  for (const lane of facts.contentTypeLanes) {
    const body = bodyOf(lane.function);
    if (body === null) problems.push(`no ${lane.function}() function`);
    else if (!squash(body).includes(squash(lane.expression))) problems.push(`${lane.function}() does not state ${squash(lane.expression)}`);
  }

  const stagingBlock = matchBlocks(rulesCode).find((block) => block.path === `/${facts.stagingPath}`);
  const staging = stagingBlock ? rulesCode.slice(stagingBlock.open + 1, stagingBlock.close) : null;
  if (staging === null) problems.push(`no staging block match /${facts.stagingPath}`);
  else {
    const grants = [...staging.matchAll(/\ballow\s+([\w\s,]+?)\s*:\s*if\s+([^;]+);/g)].map((m) => ({
      ops: m[1].split(',').map((op) => op.trim()),
      condition: m[2].trim(),
    }));
    for (const op of ['update', 'delete']) {
      if (!grants.some((g) => g.ops.includes(op) && g.condition === 'false')) problems.push(`the staging block does not refuse ${op} (allow ${op}: if false)`);
    }
    for (const g of grants) {
      if (g.condition !== 'false' && g.ops.some((op) => ['update', 'delete', 'write'].includes(op))) {
        problems.push(`the staging block grants ${g.ops.join(', ')}: a staged object is created once and never changed`);
      }
    }
  }
  return problems;
}

export const storageUploadOriginGuard: GenericGuardDefinition<StorageUploadOriginFacts> = {
  id: 'storageUploadOrigins',
  absentWhen: 'the app takes no client upload into Cloud Storage',
  factProblems(facts) {
    const problems = [
      ...requireName(facts?.rulesFile, 'rulesFile'),
      ...requireName(facts?.capFunction, 'capFunction'),
      ...requireLoader(facts?.originCaps, 'originCaps'),
      ...requireName(facts?.stagingPath, 'stagingPath'),
    ];
    if (!Array.isArray(facts?.originLists)) problems.push('originLists is missing (declare [] when there is none)');
    for (const l of facts?.originLists ?? []) {
      problems.push(...requireName(l?.function, 'an origin list function'), ...requireLoader(l?.origins, `originLists ${String(l?.function)}`));
    }
    if (!Array.isArray(facts?.contentTypeLanes)) problems.push('contentTypeLanes is missing (declare [] when there is none)');
    for (const l of facts?.contentTypeLanes ?? []) {
      problems.push(...requireName(l?.function, 'a content-type lane function'), ...requireName(l?.expression, `contentTypeLanes ${String(l?.function)}'s expression`));
    }
    return problems;
  },
  build(facts) {
    return [
      {
        title: 'the Storage rules restate the upload-origin registry exactly',
        description:
          "The Storage rules cannot import the core, so their copy of the upload-origin registry is pinned to it: the cap " +
          "function names every declared origin with exactly the core's raw cap, names no other origin, and falls back " +
          'to 0; every origin-list function lists exactly its declared origins; every declared content-type lane is ' +
          'stated; and the staging block refuses update and delete and grants neither. Fix: change the rules to match the ' +
          'core, or the core and the rules together.',
        async run(context) {
          return (await uploadOriginProblems(context.file(facts.rulesFile).code, facts)).map((detail) => ({ file: facts.rulesFile, detail }));
        },
      },
    ];
  },
};

export interface StorageObjectMetadataFacts {
  /** Package helpers that read a stored object's generation; each takes the whole metadata object. */
  generationReaders: readonly string[];
  /** Package helpers that read a stored object's size; each is handed `<metadata>.size`. */
  sizeReaders: readonly string[];
  /** Package-owned names (the error class, the require helper) no app file may declare again. */
  packageContracts: readonly string[];
  /** Files that read stored-object metadata; each must still read it through a helper. */
  readerAnchors: readonly string[];
  /** Reviewed (file, shape) pairs that are not a stored object's metadata, each with its why. */
  exceptions: ReadonlyArray<{ path: string; shape: string; why: string }>;
}

const MEMBER_SHAPES: readonly RegExp[] = [
  /\b(?:String|Number|BigInt|parseInt|parseFloat)\s*\(\s*[^()]*?\.\s*(?:generation|size)\b/g,
  /[\w$.?]*\.\s*generation\s*\??\.\s*toString\s*\(/g,
  /[\w$.?]*\.\s*(?:generation|size)\s*(?:\?\?|\|\|)/g,
  /[\w$.?]*\.\s*(?:generation|size)\s+as\b/g,
];
const METADATA_MEMBER_READ = /[\w$.?]*\bmeta(?:data)?\s*\??\.\s*(generation|size)\b/g;
const METADATA_DESTRUCTURE = /\{[^{}]*\b(?:generation|size)\b[^{}]*\}\s*=\s*[\w$.?]*\bmeta(?:data)?\b/g;

const alternationOf = (names: readonly string[]) => names.map((n) => n.replace(/[$]/g, '\\$')).join('|');

/** Every hand-rolled generation or size read in one file's comment-stripped code, as `{ index, shape }`. */
export function inlineMetadataReads(code: string, facts: Pick<StorageObjectMetadataFacts, 'sizeReaders'>): Array<{ index: number; shape: string }> {
  const sizeArgument = new RegExp(`\\b(?:${alternationOf(facts.sizeReaders)})\\s*\\(\\s*$`);
  const hits = new Map<string, number>();
  const add = (m: RegExpMatchArray) => {
    const shape = m[0].replace(/\s+/g, ' ').trim();
    if (!hits.has(shape)) hits.set(shape, m.index as number);
  };
  for (const pattern of MEMBER_SHAPES) for (const m of code.matchAll(pattern)) add(m);
  for (const m of code.matchAll(METADATA_MEMBER_READ)) {
    const before = code.slice(Math.max(0, (m.index as number) - 80), m.index);
    if (m[1] === 'size' && sizeArgument.test(before)) continue;
    add(m);
  }
  for (const m of code.matchAll(METADATA_DESTRUCTURE)) add(m);
  return [...hits].map(([shape, index]) => ({ index, shape })).sort((a, b) => a.index - b.index);
}

/** Every local declaration of a package-owned contract name in one file's code. */
export function packageContractCopies(code: string, contracts: readonly string[]): Array<{ index: number; shape: string }> {
  if (!contracts.length) return [];
  const names = alternationOf(contracts);
  const re = new RegExp(`\\b(?:class|function|const|let|var)\\s+(?:${names})\\b`, 'g');
  return [...code.matchAll(re)].map((m) => ({ index: m.index as number, shape: m[0].replace(/\s+/g, ' ') }));
}

const METADATA_SCOPE: Scope = { roots: ['functions', 'app'], optionalRoots: ['functions'], kinds: ['code'], tests: false };

export const storageObjectMetadataGuard: GenericGuardDefinition<StorageObjectMetadataFacts> = {
  id: 'storageObjectMetadata',
  absentWhen: 'the app reads no Cloud Storage object metadata',
  factProblems(facts) {
    return [
      ...nameListProblems(facts?.generationReaders, 'generationReaders'),
      ...nameListProblems(facts?.sizeReaders, 'sizeReaders'),
      ...nameListProblems(facts?.packageContracts, 'packageContracts', { nonEmpty: false }),
      ...nameListProblems(facts?.readerAnchors, 'readerAnchors'),
      ...reviewedListProblems(facts?.exceptions, 'exceptions', 'path'),
      ...(facts?.exceptions ?? []).flatMap((e) => (typeof e?.shape === 'string' && e.shape.trim() ? [] : [`exceptions: ${e?.path} names no shape`])),
    ];
  },
  build(facts) {
    const helperCall = new RegExp(`\\b(?:${alternationOf([...facts.generationReaders, ...facts.sizeReaders])})\\s*\\(`);
    return [
      {
        title: "a stored object's generation and size are read only through the package helpers",
        description:
          "A stored object's generation and size are read only through the package helpers, which answer undefined for a " +
          'missing or unreadable value (or throw, for the require helper) so the caller handles it explicitly. Flagged: a ' +
          'conversion (String / Number / BigInt / parseInt / parseFloat) of a .generation or .size, ' +
          '.generation.toString(), a fallback (?? / ||) or cast on either, any .generation / .size read off a metadata ' +
          'object (meta, metadata) except handing .size to a size helper, the same read by destructuring, and a local ' +
          'declaration of a package-owned contract name. A reviewed exception is a (file, shape) pair with its why; one ' +
          'that matches nothing is stale. Each reader anchor must still call a helper.',
        timeoutMs: 120_000,
        run(context) {
          const findings: Finding[] = [];
          const used = new Set<number>();
          const files = new Map<string, FileView>();
          for (const file of context.files(METADATA_SCOPE)) {
            files.set(file.path, file);
            for (const { index, shape } of packageContractCopies(file.code, facts.packageContracts)) {
              findings.push({ file: file.path, line: file.lineOf(index), detail: `a local copy of a package-owned contract: ${shape}` });
            }
            for (const { index, shape } of inlineMetadataReads(file.code, facts)) {
              const at = facts.exceptions.findIndex((e) => e.path === file.path && e.shape === shape);
              if (at !== -1) used.add(at);
              else findings.push({ file: file.path, line: file.lineOf(index), detail: `inline storage metadata read: ${shape}` });
            }
          }
          facts.exceptions.forEach((e, i) => {
            if (!used.has(i)) findings.push({ file: e.path, detail: `stale exception: "${e.shape}" no longer appears` });
          });
          for (const anchor of facts.readerAnchors) {
            const file = files.get(anchor);
            if (!file) findings.push({ file: anchor, detail: 'reader anchor: the file is gone or outside the scope' });
            else if (!helperCall.test(file.code)) findings.push({ file: anchor, detail: 'reader anchor: no package helper call left in it' });
          }
          return findings;
        },
      },
    ];
  },
};
