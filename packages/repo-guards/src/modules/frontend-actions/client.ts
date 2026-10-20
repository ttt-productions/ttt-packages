// The guards over client resources with one owner each: the app config document, browser storage,
// upload-progress listeners, media rendering, media classification, motion, age derivation, and the
// test mocks of pure package roots.

import ts from 'typescript';
import type { GenericGuardDefinition } from '../../node/suite/config.js';
import type { Finding, Guard } from '../../guard.js';
import type { Reviewed } from '../../node/layout.js';
import type { Scope } from '../../node/reader.js';
import type { FileView } from '../../reader/view.js';
import type { GuardContext } from '../../guard.js';
import type { SharedFakeFacts } from '../repo/shared-fakes.js';
import {
  matchPattern,
  ownerOnly,
  reviewedAllowlist,
  type AllowlistEntry,
  type Hit,
} from '../../shapes/shapes.js';
import {
  allowlistProblems,
  namesProblem,
  reviewedProblems,
  textProblem,
} from '../../support/facts.js';
import { fromStatements, namesModule } from '../../support/imports.js';
import { escapeRegExp, isUnder } from '../../support/text.js';
import { isPlainString } from '../../support/ast.js';
import { aliasList, resolveSpecifier } from '../../support/resolve-specifier.js';

const APP_CODE: Scope = { roots: ['app'], kinds: ['code'], tests: false };

/** A dotted code spelling (`A.b`) as a pattern that allows whitespace around each dot. */
const dottedPattern = (spelling: string) =>
  spelling
    .split('.')
    .map((part) => escapeRegExp(part.trim()))
    .join('\\s*\\.\\s*');

/** A name in any quote: `'x'`, `"x"`, or a backtick literal. */
const quotedPattern = (name: string) => `(['"\`])${escapeRegExp(name)}\\1`;

// ---------------------------------------------------------------------------------------------
// App config: one client module names the app config document.

export interface AppConfigReaderFacts {
  /** The one client module that reads the app config document. */
  provider: string;
  /** The code spellings that name the document (`PATHS.appConfig`). */
  docSpellings: readonly string[];
  /** The document's collection name, matched when quoted. */
  collectionName: string;
  /** Server-side folders that read the document as the backend, each with why (declare [] when none). */
  serverPaths: readonly Reviewed[];
}

export const appConfigReaderGuard: GenericGuardDefinition<AppConfigReaderFacts> = {
  id: 'appConfigReader',
  absentWhen: 'the app has no app config document',
  factProblems(facts) {
    const problems: string[] = [];
    textProblem(facts?.provider, 'provider', problems);
    namesProblem(facts?.docSpellings, 'docSpellings', problems);
    textProblem(facts?.collectionName, 'collectionName', problems);
    reviewedProblems(facts?.serverPaths, 'serverPaths', problems);
    return problems;
  },
  build(facts) {
    const pattern = new RegExp(
      [
        ...facts.docSpellings.map((s) => `\\b${dottedPattern(s)}\\b`),
        quotedPattern(facts.collectionName),
      ].join('|'),
      'g',
    );
    const names = matchPattern(pattern);
    const guard = ownerOnly({
      title: 'one client module reads the app config document',
      description:
        `${facts.provider} is the one client source that names the app config document: it reads every value through ` +
        'its checked readers and hands consumers the checked state. A second client read would see the raw, untrusted ' +
        "value and bypass the provider's status. Read it through the provider's accessor; server code under the declared " +
        'server paths reads it as the backend.',
      scope: APP_CODE,
      match: (file) =>
        facts.serverPaths.some((p) => isUnder(file.path, p.path)) ? [] : names(file),
      owners: [facts.provider],
      samples: {
        flags: [
          `const ref = doc(db, ${facts.docSpellings[0]}());`,
          `doc(db, '${facts.collectionName}', 'app')`,
        ],
        passes: [
          `// reads ${facts.docSpellings[0]}() live`,
          `const hint = 'the field on ${facts.collectionName}/app is invalid';`,
        ],
      },
    });
    return [
      {
        ...guard,
        async run(context) {
          const findings = await guard.run(context);
          for (const p of facts.serverPaths)
            if (!context.reader.exists(p.path))
              findings.push({ file: p.path, detail: 'stale server path: it no longer exists' });
          return findings;
        },
      },
    ];
  },
};

// ---------------------------------------------------------------------------------------------
// Browser storage: touched only through the guarded helper.

export interface BrowserStorageFacts {
  /** The guarded helper every read and write goes through. */
  helper: string;
  allowlist: readonly AllowlistEntry[];
}

export const browserStorageGuard: GenericGuardDefinition<BrowserStorageFacts> = {
  id: 'browserStorage',
  absentWhen: false,
  factProblems(facts) {
    const problems: string[] = [];
    textProblem(facts?.helper, 'helper', problems);
    allowlistProblems(facts?.allowlist, 'allowlist', problems);
    return problems;
  },
  build(facts) {
    return [
      reviewedAllowlist({
        title: 'browser storage is touched only through the guarded helper',
        description:
          `Read and write browser storage through ${facts.helper}. A raw \`localStorage\` / \`sessionStorage\` access ` +
          'throws for a viewer whose browser blocks site data, and inside a store the shell mounts that takes down every route.',
        scope: APP_CODE,
        match: matchPattern(/\b(?:localStorage|sessionStorage)\s*(?:\.|\[)/),
        allowlist: facts.allowlist,
        samples: {
          flags: [
            'window.localStorage.getItem(KEY)',
            "sessionStorage.removeItem('k')",
            'localStorage[KEY] = v',
          ],
          passes: [
            "readStoredValue(KEY, 'session')",
            '`stored in localStorage: ${v}`',
            '// localStorage.getItem(KEY)',
          ],
        },
      }),
    ];
  },
};

// ---------------------------------------------------------------------------------------------
// Upload listeners: no component subscribes to the upload-processing collection itself.

export interface UploadListenerFacts {
  /** The upload-processing collection's name, matched when quoted. */
  collectionName: string;
  /** Code spellings that name the collection (`COLLECTIONS.UPLOADS`). */
  collectionSpellings: readonly string[];
  /** The one global subscriber and the hooks feature code reads instead. */
  subscriber: string;
}

export const uploadListenerGuard: GenericGuardDefinition<UploadListenerFacts> = {
  id: 'uploadListeners',
  absentWhen: 'the app has no upload-processing collection',
  factProblems(facts) {
    const problems: string[] = [];
    textProblem(facts?.collectionName, 'collectionName', problems);
    namesProblem(facts?.collectionSpellings, 'collectionSpellings', problems, { nonEmpty: false });
    textProblem(facts?.subscriber, 'subscriber', problems);
    return problems;
  },
  build(facts) {
    const names = new RegExp(
      [
        quotedPattern(facts.collectionName),
        ...facts.collectionSpellings.map((s) => `\\b${dottedPattern(s)}\\b`),
      ].join('|'),
    );
    const subscribe = matchPattern(/\bonSnapshot\b/, () => 'onSnapshot');
    return [
      reviewedAllowlist({
        title: 'no component subscribes to upload processing itself',
        description:
          `Upload processing has one global subscriber (${facts.subscriber}). No file that names the ` +
          `${facts.collectionName} collection calls onSnapshot: read an upload's progress through the subscriber's hooks.`,
        scope: APP_CODE,
        match: (file) => (names.test(file.code) ? subscribe(file) : []),
        allowlist: [],
        samples: {
          flags: [`onSnapshot(doc(db, '${facts.collectionName}', id), cb);`],
          passes: [
            `onSnapshot(doc(db, 'otherThings', id), cb);`,
            `getDoc(doc(db, '${facts.collectionName}', id));`,
          ],
        },
      }),
    ];
  },
};

// ---------------------------------------------------------------------------------------------
// Media renderer: every stored picture draws through the app's renderer owners.

export interface MediaRendererFacts {
  /** Each renderer owner: the one file that may import the listed names (or every import) from a module. */
  renderers: ReadonlyArray<{ owner: string; module: string; imports: readonly string[] | 'all' }>;
  /** Files that may draw a raw image, each with why (declare [] when none). */
  rawImageAllowlist: readonly AllowlistEntry[];
}

const RAW_IMAGE =
  /<img\b|from\s*['"]next\/image['"]|\bbackgroundImage\s*:|background(?:-image)?\s*:\s*url\(/g;

/** Each import of a renderer's names (or of anything, for `all`) from its module or a subpath. */
export function rendererImports(
  file: FileView,
  renderer: MediaRendererFacts['renderers'][number],
): Hit[] {
  const hits: Hit[] = [];
  for (const site of fromStatements(file.sourceFile)) {
    if (!namesModule(site.spec, renderer.module)) continue;
    const index = site.node.getStart(file.sourceFile);
    if (renderer.imports === 'all') {
      hits.push({ index, detail: `imports from ${site.spec}` });
      continue;
    }
    for (const name of renderer.imports) {
      if (site.named.some((n) => n.imported === name || n.local === name))
        hits.push({ index, detail: `imports ${name} from ${site.spec}` });
    }
  }
  return hits;
}

export const mediaRendererGuard: GenericGuardDefinition<MediaRendererFacts> = {
  id: 'mediaRenderer',
  absentWhen: false,
  factProblems(facts) {
    const problems: string[] = [];
    if (!Array.isArray(facts?.renderers) || !facts.renderers.length)
      problems.push('renderers is missing or empty');
    else {
      for (const r of facts.renderers) {
        textProblem(r?.owner, 'a renderer owner', problems);
        textProblem(r?.module, `renderer ${String(r?.owner)}'s module`, problems);
        if (r?.imports !== 'all')
          namesProblem(r?.imports, `renderer ${String(r?.owner)}'s imports (or 'all')`, problems);
      }
    }
    allowlistProblems(facts?.rawImageAllowlist, 'rawImageAllowlist', problems);
    return problems;
  },
  build(facts) {
    const raw = reviewedAllowlist({
      title: 'a stored picture draws only through its renderer owners',
      description:
        'No component draws a raw `<img>`, a `next/image`, or a background image: a stored picture renders through the ' +
        `app's renderer owners (${facts.renderers.map((r) => r.owner).join(', ')}), and each owner is the one file that ` +
        'imports what it wraps from its module — a second caller is a second render path. A file that must draw a raw ' +
        'image is a reviewed entry with its why.',
      scope: APP_CODE,
      match: matchPattern(RAW_IMAGE),
      allowlist: facts.rawImageAllowlist,
      samples: {
        flags: [
          '<img src={url} alt="" />',
          "import Image from 'next/image';",
          '<div style={{ backgroundImage: `url(${url})` }} />',
        ],
        passes: [
          "import { Image } from 'lucide-react';",
          '<Image className="icon-sm" />',
          '// never an <img>',
          "const tag = 'img';",
        ],
      },
    });
    return [
      {
        ...raw,
        async run(context) {
          const findings: Finding[] = await raw.run(context);
          const held = new Set<string>();
          for (const file of context.files(APP_CODE)) {
            for (const renderer of facts.renderers) {
              const hits = rendererImports(file, renderer);
              if (!hits.length) continue;
              if (file.path === renderer.owner) held.add(renderer.owner);
              else
                for (const hit of hits)
                  findings.push({
                    file: file.path,
                    line: file.lineOf(hit.index),
                    detail: `outside its renderer owner ${renderer.owner}: ${hit.detail}`,
                  });
            }
          }
          for (const renderer of facts.renderers) {
            if (!context.reader.exists(renderer.owner))
              findings.push({
                file: renderer.owner,
                detail: 'the renderer owner no longer exists',
              });
            else if (!held.has(renderer.owner))
              findings.push({
                file: renderer.owner,
                detail: `stale owner: it no longer imports from ${renderer.module}`,
              });
          }
          return findings;
        },
      },
    ];
  },
};

// ---------------------------------------------------------------------------------------------
// MIME prefix classification: what a file IS comes from the server's inspection, never a MIME prefix.

export type MimePrefixFacts = Record<string, never>;

const MIME_PREFIX = /^(image|video|audio)\/$/;
const MIME_PREFIX_REGEX = /\^\(?\??:?(image|video|audio)/;

/** Each MIME-prefix classification: a bare prefix literal, a regex anchored on a media type, or `split('/')[0]`. */
export function mimePrefixClassifications(file: FileView): Hit[] {
  const sf = file.sourceFile;
  const hits: Hit[] = [];
  const visit = (node: ts.Node) => {
    if (isPlainString(node) && MIME_PREFIX.test(node.text)) {
      hits.push({ index: node.getStart(sf), detail: `'${node.text}'` });
    }
    if (ts.isRegularExpressionLiteral(node) && MIME_PREFIX_REGEX.test(node.text))
      hits.push({ index: node.getStart(sf), detail: node.text });
    if (
      ts.isElementAccessExpression(node) &&
      ts.isNumericLiteral(node.argumentExpression) &&
      node.argumentExpression.text === '0' &&
      ts.isCallExpression(node.expression) &&
      ts.isPropertyAccessExpression(node.expression.expression) &&
      node.expression.expression.name.text === 'split' &&
      node.expression.arguments.length === 1 &&
      ts.isStringLiteral(node.expression.arguments[0]) &&
      node.expression.arguments[0].text === '/'
    ) {
      hits.push({ index: node.getStart(sf), detail: "split('/')[0]" });
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return hits;
}

export const mimePrefixGuard: GenericGuardDefinition<MimePrefixFacts> = {
  id: 'mimePrefixClassification',
  absentWhen: false,
  factProblems(facts) {
    if (!facts || typeof facts !== 'object') return ['the facts are missing (declare {})'];
    return Object.keys(facts).length ? [`unknown facts: ${Object.keys(facts).join(', ')}`] : [];
  },
  build() {
    return [
      reviewedAllowlist({
        title: 'no code classifies media from a MIME prefix',
        description:
          "Code never decides what a stored or uploaded file is from a MIME prefix (`startsWith('image/')`, a regex " +
          "anchored on a media type, `type.split('/')[0]`): a client-declared type may be neutral, so the kind a surface " +
          "renders or routes on is the server's inspection of the bytes.",
        scope: APP_CODE,
        match: mimePrefixClassifications,
        allowlist: [],
        samples: {
          flags: [
            "const a = contentType.startsWith('video/');",
            'const b = /^audio\\//.test(contentType);',
            "const c = contentType.split('/')[0];",
            'const e = mime.includes(`image/`);',
          ],
          passes: [
            "// contentType.startsWith('image/')",
            "const d = new File([blob], 'x.jpg', { type: 'image/jpeg' });",
          ],
        },
      }),
    ];
  },
};

// ---------------------------------------------------------------------------------------------
// Effective motion: one store reads the device's reduced-motion request.

export interface EffectiveMotionFacts {
  /** The store that owns the effective-motion value. */
  store: string;
}

export const effectiveMotionGuard: GenericGuardDefinition<EffectiveMotionFacts> = {
  id: 'effectiveMotion',
  absentWhen: false,
  factProblems(facts) {
    const problems: string[] = [];
    textProblem(facts?.store, 'store', problems);
    return problems;
  },
  build(facts) {
    const query = matchPattern(/matchMedia\([^)]*prefers-reduced-motion/);
    // The store may hold the media query itself or build on a package store that does, so it is
    // exempt rather than required to hold it; it must still exist.
    const guard = reviewedAllowlist({
      title: 'one store reads the reduced-motion request',
      description:
        `The effective motion value comes from ${facts.store}, which combines the device request with the saved ` +
        'choice. No other code checks the `prefers-reduced-motion` media query itself: read the store.',
      scope: APP_CODE,
      match: (file) => (file.path === facts.store ? [] : query(file)),
      allowlist: [],
      samples: {
        flags: ["const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;"],
        passes: [
          '// the store owns prefers-reduced-motion',
          "window.matchMedia('(min-width: 768px)')",
        ],
      },
    });
    return [
      {
        ...guard,
        async run(context) {
          const findings = await guard.run(context);
          if (!context.reader.exists(facts.store))
            findings.push({ file: facts.store, detail: 'the motion store no longer exists' });
          return findings;
        },
      },
    ];
  },
};

// ---------------------------------------------------------------------------------------------
// Date-of-birth derivation: one owner computes whole years from a date.

export interface DateOfBirthFacts {
  /** The one file that derives an age from a date of birth (may be in the core package's build). */
  owner: string;
}

export const dateOfBirthGuard: GenericGuardDefinition<DateOfBirthFacts> = {
  id: 'dateOfBirthDerivation',
  absentWhen: 'the app never derives an age from a date of birth',
  factProblems(facts) {
    const problems: string[] = [];
    textProblem(facts?.owner, 'owner', problems);
    return problems;
  },
  build(facts) {
    return [
      ownerOnly({
        title: 'a date of birth becomes an age in one place',
        description:
          `Whole years are computed from a date only in ${facts.owner}. A second year subtraction anywhere else is a ` +
          'copy that drifts from the owner at a boundary birthday: call the owner.',
        scope: {
          roots: ['app', 'functions', 'coreDist'],
          kinds: ['code'],
          tests: false,
          optionalRoots: ['functions', 'coreDist'],
        },
        match: matchPattern(/\.get(?:UTC)?FullYear\(\)\s*-/),
        owners: [facts.owner],
        samples: {
          flags: [
            'const age = now.getFullYear() - dob.getFullYear();',
            'let years = asOf.getUTCFullYear() - dob.year;',
          ],
          passes: [
            'const year = now.getUTCFullYear();',
            '// now.getFullYear() - dob.getFullYear()',
          ],
        },
      }),
    ];
  },
};

// ---------------------------------------------------------------------------------------------
// Partial mocks: a test mock of a listed package root keeps the root's real exports.

export interface PartialMockFacts {
  /** Package roots whose mocks must spread the real module, each with what breaks when one does not. */
  packageRoots: ReadonlyArray<{ module: string; why: string }>;
  /**
   * The app's shared fakes: a mock whose factory loads a listed root's shared fake keeps the root's
   * real exports when that fake does.
   */
  sharedFakes?: Pick<SharedFakeFacts, 'importAliases' | 'fakes'>;
}

/** Each `vi.mock` / `vi.doMock` call on exactly `module`, as its balanced source slice. */
export function moduleMockCalls(
  code: string,
  module: string,
): Array<{ call: string; index: number }> {
  const opener = new RegExp(`vi\\.(?:mock|doMock)\\(\\s*(['"\`])${escapeRegExp(module)}\\1`, 'g');
  const calls: Array<{ call: string; index: number }> = [];
  for (let m = opener.exec(code); m; m = opener.exec(code)) {
    const open = code.indexOf('(', m.index);
    let depth = 0;
    let end = open;
    for (; end < code.length; end++) {
      if (code[end] === '(') depth++;
      else if (code[end] === ')' && --depth === 0) break;
    }
    calls.push({ call: code.slice(m.index, end + 1), index: m.index });
  }
  return calls;
}

/** True when a mock call spreads the real module, inline or through a binding. */
export function spreadsImportOriginal(call: string): boolean {
  if (/\.\.\.\s*\(\s*await\s+importOriginal\b/.test(call)) return true;
  const binding = /const\s+([A-Za-z_$][\w$]*)\s*=\s*await\s+importOriginal\b/.exec(call);
  return binding !== null && new RegExp(`\\.\\.\\.\\s*${escapeRegExp(binding[1])}\\b`).test(call);
}

/** The specifiers a mock call's factory loads with `import()`. */
function factoryLoads(call: string): string[] {
  const loads: string[] = [];
  const load = /\bimport\(\s*(['"`])([^'"`]+)\1\s*\)/g;
  for (let m = load.exec(call); m; m = load.exec(call)) loads.push(m[2]);
  return loads;
}

/** The source of a function `name` declares, as a declaration or a variable holding a function. */
function functionText(file: FileView, name: string): string | null {
  for (const statement of file.sourceFile.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name?.text === name)
      return statement.getText(file.sourceFile);
    if (ts.isVariableStatement(statement))
      for (const d of statement.declarationList.declarations)
        if (ts.isIdentifier(d.name) && d.name.text === name && d.initializer)
          return d.initializer.getText(file.sourceFile);
  }
  return null;
}

/**
 * True when a shared fake keeps its module's real exports: it spreads `importOriginal` itself, or it
 * calls a helper from a local file whose own body does.
 */
function ownerKeepsRealExports(
  context: GuardContext,
  owner: string,
  aliases: ReadonlyArray<[string, string]>,
): boolean {
  if (!context.reader.exists(owner)) return false;
  const file = context.file(owner);
  if (spreadsImportOriginal(file.code)) return true;
  for (const site of file.imports) {
    if (site.typeOnly) continue;
    const target = resolveSpecifier(context.reader, owner, site.spec, aliases);
    if (target === site.spec || !context.reader.exists(target)) continue;
    for (const name of site.named) {
      if (name.typeOnly || !new RegExp(`\\b${escapeRegExp(name.local)}\\s*[<(]`).test(file.code))
        continue;
      const helper = functionText(context.file(target), name.imported);
      if (helper !== null && spreadsImportOriginal(helper)) return true;
    }
  }
  return false;
}

export const partialMockGuard: GenericGuardDefinition<PartialMockFacts> = {
  id: 'partialMocks',
  absentWhen: false,
  factProblems(facts) {
    const problems: string[] = [];
    if (!Array.isArray(facts?.packageRoots) || !facts.packageRoots.length)
      return ['packageRoots is missing or empty'];
    for (const r of facts.packageRoots) {
      textProblem(r?.module, 'a package root', problems);
      textProblem(r?.why, `package root ${String(r?.module)}'s why`, problems);
    }
    if (facts.sharedFakes !== undefined) {
      if (
        typeof facts.sharedFakes?.importAliases !== 'object' ||
        facts.sharedFakes.importAliases === null
      )
        problems.push('sharedFakes.importAliases is missing');
      if (!Array.isArray(facts.sharedFakes?.fakes)) problems.push('sharedFakes.fakes is missing');
    }
    return problems;
  },
  build(facts): Guard[] {
    return [
      {
        title: "a mock of a listed package root keeps the root's real exports",
        description:
          'A `vi.mock` of a listed package root spreads the real module: ' +
          "`vi.mock('<root>', async (importOriginal) => ({ ...(await importOriginal()), <override> }))`. A factory that " +
          'returns only the exports one test steers deletes the rest, and code that needs them fails away from the ' +
          "assertion. A mock whose factory loads the root's shared fake passes when that fake spreads the real module. " +
          facts.packageRoots.map((r) => `${r.module}: ${r.why}.`).join(' '),
        run(context) {
          const findings: Finding[] = [];
          const mocked = new Set<string>();
          const aliases = aliasList(facts.sharedFakes?.importAliases ?? {});
          const ownerOf = (module: string, rootName: string): string | undefined =>
            facts.sharedFakes?.fakes.find(
              (f) =>
                f.module === module &&
                context.reader.exists(f.owner) &&
                context.file(f.owner).rootName === rootName,
            )?.owner;
          const loadsKeepingOwner = (file: FileView, module: string, call: string): boolean => {
            const owner = ownerOf(module, file.rootName);
            return (
              owner !== undefined &&
              factoryLoads(call).some(
                (spec) => resolveSpecifier(context.reader, file.path, spec, aliases) === owner,
              ) &&
              ownerKeepsRealExports(context, owner, aliases)
            );
          };
          const files = context.files({
            roots: ['app', 'functions'],
            kinds: ['code'],
            tests: true,
            optionalRoots: ['functions'],
          });
          for (const file of files) {
            for (const { module } of facts.packageRoots) {
              for (const { call, index } of moduleMockCalls(file.code, module)) {
                mocked.add(module);
                if (!spreadsImportOriginal(call) && !loadsKeepingOwner(file, module, call))
                  findings.push({
                    file: file.path,
                    line: file.lineOf(index),
                    detail: `a full-module mock of ${module}`,
                  });
              }
            }
          }
          for (const { module } of facts.packageRoots) {
            if (!mocked.has(module))
              findings.push({
                file: '(packageRoots)',
                detail: `stale entry: nothing mocks ${module}`,
              });
          }
          return findings;
        },
      },
    ];
  },
};
