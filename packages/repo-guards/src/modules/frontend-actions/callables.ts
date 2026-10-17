// The guards over how the client reaches a callable and surfaces its failure: one transport, one
// copy owner, one toast and one capture per failure, and reads that live in hooks.

import type { GenericGuardDefinition } from '../../config.js';
import type { Finding, Guard, GuardContext } from '../../guard.js';
import type { Scope } from '../../reader/reader.js';
import type { FileView } from '../../reader/view.js';
import { reviewedAllowlist, type AllowlistEntry, type Hit } from '../../shapes/shapes.js';
import {
  balancedArgs,
  bindingNames,
  callArgs,
  catchBodies,
  escapeRegExp,
  exportBlocks,
  exportedName,
  handlersFor,
  isModuleOrSubpath,
  isUnder,
  localDeclarations,
  moduleStatements,
  namedImports,
  namesProblem,
  objectProblem,
  textProblem,
  tryCatchPairs,
} from './text.js';

const APP_CODE: Scope = { roots: ['app'], kinds: ['code'], tests: false };
const REACT_HOOK = 'use[A-Z]\\w*';

const allowlistProblems = (entries: unknown, problems: string[]) => {
  if (!Array.isArray(entries)) {
    problems.push('allowlist is missing (declare [] when there is none)');
    return;
  }
  for (const entry of entries as AllowlistEntry[]) {
    if (!entry?.path) problems.push('an allowlist entry names no file');
    else if (typeof entry.why !== 'string' || !entry.why.trim()) problems.push(`allowlist entry ${entry.path} carries no why`);
  }
};

/** Runs a shape-built guard and adds the findings of an extra check to it. */
const withExtraCheck = (guard: Guard, extra: (context: GuardContext) => Finding[]): Guard => ({
  ...guard,
  async run(context) {
    return [...(await guard.run(context)), ...extra(context)];
  },
});

/** Each line of a file's code that one of `shapes` matches, at the line's index. */
const lineHits = (file: FileView, test: (line: string) => string | null): Hit[] => {
  const hits: Hit[] = [];
  let index = 0;
  for (const line of file.code.split('\n')) {
    const detail = test(line);
    if (detail !== null) hits.push({ index, detail });
    index += line.length + 1;
  }
  return hits;
};

const declaresExport = (code: string, name: string) =>
  new RegExp(`\\bexport\\s+(?:async\\s+)?(?:function\\s*\\*?|const|let)\\s+${escapeRegExp(name)}\\b`).test(code) ||
  new RegExp(`\\bexport\\s*\\{[^}]*\\b${escapeRegExp(name)}\\b[^}]*\\}`).test(code);

// ---------------------------------------------------------------------------------------------
// Callable error copy: a failure surface never shows a raw error message.

export interface CallableErrorCopyFacts {
  /** The one module that turns a callable failure into user-facing copy, and the function it exports. */
  owner: { file: string; exportName: string };
  /** Surfaces whose error is not a callable rejection, each with why. */
  allowlist: readonly AllowlistEntry[];
}

/** An error-ish receiver followed immediately by `.message`, so `errors.title.message` never matches. */
const ERRISH = String.raw`(?:\w*[Ee]rror\w*|err|e)`;
const RAW_MESSAGE_SHAPES = [
  new RegExp(String.raw`description:\s*${ERRISH}\s*\??\.\s*message\b`),
  new RegExp(String.raw`\btitle:\s*${ERRISH}\s*\??\.\s*message\b`),
  new RegExp(String.raw`\bset\w*Error\(\s*${ERRISH}\s*\??\.\s*message\s*\)`),
  new RegExp(String.raw`\b${ERRISH}\s+instanceof Error\s*\?\s*${ERRISH}\s*\.\s*message\b`),
  new RegExp(String.raw`\b${ERRISH}\s*\?\.\s*message\s*\|\|`),
  new RegExp(String.raw`\{\s*${ERRISH}\s*\??\.\s*message\s*\}`),
];

export const callableErrorCopyGuard: GenericGuardDefinition<CallableErrorCopyFacts> = {
  id: 'callableErrorCopy',
  absentWhen: false,
  factProblems(facts) {
    const problems: string[] = [];
    if (objectProblem(facts?.owner, 'owner', problems)) {
      textProblem(facts.owner.file, 'owner.file', problems);
      textProblem(facts.owner.exportName, 'owner.exportName', problems);
    }
    allowlistProblems(facts?.allowlist, problems);
    return problems;
  },
  build(facts) {
    const { file: owner, exportName } = facts.owner;
    const guard = reviewedAllowlist({
      title: 'a failure surface describes a callable failure through its one copy owner',
      description:
        `A toast, an error state, or a rendered element never shows a raw error message (\`error.message\`): ` +
        `route the failure through \`${exportName}\` (${owner}), so a transport failure shows its canonical copy instead ` +
        'of an SDK string. A surface whose error is genuinely not a callable rejection is a reviewed allowlist entry ' +
        'with its why; an entry whose file no longer holds the shape is stale.',
      scope: APP_CODE,
      match: (file) =>
        file.path === owner ? [] : lineHits(file, (line) => (RAW_MESSAGE_SHAPES.some((re) => re.test(line)) ? 'raw error message' : null)),
      allowlist: facts.allowlist,
      samples: {
        flags: [
          "toast({ title: 'Failed', description: error.message, variant: 'destructive' });",
          'onError: (e) => setError(e.message),',
          "const message = error instanceof Error ? error.message : 'Failed.';",
          "? linkError?.message || 'This link is invalid.'",
          '<div>Error: {errorContent.message}</div>',
        ],
        passes: [
          `description: ${exportName}(error),`,
          '<p>{errors.title.message}</p>',
          'captureException(error, { extra: { message: error.message } });',
          "if (error?.message === 'content-rejected') {}",
        ],
      },
    });
    return [
      withExtraCheck(guard, (context) => {
        if (!context.reader.exists(owner)) return [{ file: owner, detail: 'the copy owner no longer exists' }];
        return declaresExport(context.file(owner).code, exportName)
          ? []
          : [{ file: owner, detail: `the copy owner no longer exports ${exportName}` }];
      }),
    ];
  },
};

// ---------------------------------------------------------------------------------------------
// Callable transport: the callable SDK and its transport helpers are named only by their owner.

export interface CallableTransportFacts {
  /** Each module that reaches a callable, the symbols that do, and the one file that may name them. */
  transports: ReadonlyArray<{ module: string; symbols: readonly string[]; owner: string }>;
}

function transportHits(code: string, transport: { module: string; symbols: readonly string[] }): Hit[] {
  const hits: Hit[] = [];
  const namespaces: string[] = [];
  for (const statement of moduleStatements(code)) {
    if (!isModuleOrSubpath(statement.module, transport.module)) continue;
    const namespace = /\*\s+as\s+([A-Za-z_$][\w$]*)/.exec(statement.clause);
    if (namespace) namespaces.push(namespace[1]);
    const named = /\{([\s\S]*)\}/.exec(statement.clause)?.[1] ?? '';
    for (const symbol of transport.symbols) {
      if (new RegExp(`\\b${escapeRegExp(symbol)}\\b`).test(named)) hits.push({ index: statement.index, detail: `imports ${symbol} from ${statement.module}` });
    }
  }
  for (const namespace of namespaces) {
    for (const symbol of transport.symbols) {
      const re = new RegExp(`\\b${escapeRegExp(namespace)}\\s*\\.\\s*${escapeRegExp(symbol)}\\b`, 'g');
      for (let m = re.exec(code); m; m = re.exec(code)) hits.push({ index: m.index, detail: `reaches ${namespace}.${symbol}` });
    }
  }
  for (const symbol of transport.symbols) {
    const re = new RegExp(`(?<![\\w$.])${escapeRegExp(symbol)}\\s*\\(`, 'g');
    for (let m = re.exec(code); m; m = re.exec(code)) hits.push({ index: m.index, detail: `calls ${symbol}(` });
  }
  return hits;
}

export const callableTransportGuard: GenericGuardDefinition<CallableTransportFacts> = {
  id: 'callableTransport',
  absentWhen: false,
  factProblems(facts) {
    const problems: string[] = [];
    if (!Array.isArray(facts?.transports) || !facts.transports.length) return ['transports is missing or empty'];
    for (const t of facts.transports) {
      textProblem(t?.module, 'a transport module', problems);
      textProblem(t?.owner, `transport ${String(t?.module)}'s owner`, problems);
      namesProblem(t?.symbols, `transport ${String(t?.module)}'s symbols`, problems);
    }
    return problems;
  },
  build(facts) {
    return [
      {
        title: 'a callable is reached only through its transport owner',
        description:
          'The callable SDK and each transport helper are named only inside their owner module, which holds the ' +
          "invocation deadline, the error normalization, and the one capture. Nothing else imports, re-exports, " +
          'reaches through a namespace, or calls them: call the hook or function the owner exports.',
        run(context) {
          const findings: Finding[] = [];
          const held = new Set<string>();
          for (const file of context.files(APP_CODE)) {
            for (const transport of facts.transports) {
              const hits = transportHits(file.code, transport);
              if (!hits.length) continue;
              if (file.path === transport.owner) held.add(transport.owner);
              else for (const hit of hits) findings.push({ file: file.path, line: file.lineOf(hit.index), detail: `outside its owner ${transport.owner}: ${hit.detail}` });
            }
          }
          for (const transport of facts.transports) {
            if (!context.reader.exists(transport.owner)) findings.push({ file: transport.owner, detail: 'the transport owner no longer exists' });
            else if (!held.has(transport.owner)) findings.push({ file: transport.owner, detail: `stale owner: it no longer names any of ${transport.symbols.join(', ')}` });
          }
          return findings;
        },
      },
    ];
  },
};

// ---------------------------------------------------------------------------------------------
// The two ways an app can hand a component a callable, shared by the read and double-surface guards.

/** A hook that returns an invoke function, configured per call with options. */
export interface CallableWrapper {
  /** The hook (`useX`). */
  hook: string;
  /** The member of its result that invokes a callable. */
  invokeMember: string;
  /** The option that, set to `false`, turns the wrapper's error toast off. */
  toastOption: string;
  /** The option that, set to `false`, turns the wrapper's error capture off. */
  captureOption: string;
}

/** A module that exports one named hook per callable, each built by a factory of a known kind. */
export interface CallableFactoryModule {
  module: string;
  /** A reader turns the toast and capture off; a mutation hook and an invoker keep both. */
  factories: ReadonlyArray<{ name: string; kind: 'reader' | 'mutation' | 'invoker' }>;
}

type FactoryKind = CallableFactoryModule['factories'][number]['kind'];

const wrapperProblems = (value: unknown, what: string, problems: string[], keys: readonly string[]) => {
  if (!objectProblem(value, what, problems)) return;
  for (const key of keys) textProblem((value as Record<string, unknown>)[key], `${what}.${key}`, problems);
};

/** The hooks each factory module builds, with the kind of each, and each factory that builds nothing. */
function factoryHookKinds(code: string, module: CallableFactoryModule) {
  const kinds = new Map<string, FactoryKind>();
  const used = new Set<string>();
  const names = module.factories.map((f) => escapeRegExp(f.name)).join('|');
  const re = new RegExp(`export\\s+const\\s+(${REACT_HOOK})\\s*=\\s*(${names})\\b`, 'g');
  for (let m = re.exec(code); m; m = re.exec(code)) {
    const factory = module.factories.find((f) => f.name === m![2])!;
    kinds.set(m[1], factory.kind);
    used.add(factory.name);
  }
  return { kinds, unused: module.factories.filter((f) => !used.has(f.name)).map((f) => f.name) };
}

// ---------------------------------------------------------------------------------------------
// Callable-backed reads: live in the hooks folder, keep neither the wrapper toast nor its capture,
// and hand their failure to the read-failure surface.

export interface CallableReadFacts {
  /** The folder every read hook lives in. */
  hooksRoot: string;
  /** Wrapper hooks the app reaches callables through (declare [] when there is none). */
  wrappers: readonly CallableWrapper[];
  /** Factory modules the app reaches callables through (declare [] when there is none). */
  factoryModules: readonly CallableFactoryModule[];
  /** The component that renders a read failure, and the prop it takes the read's error through. */
  readFailureSurface: { component: string; errorProp: string };
  /** Hooks the detector must find a callable-backed read in — proof it still recognizes the reads. */
  anchorReads: readonly string[];
}

interface CallableRead {
  path: string;
  hook: string;
  binding: string;
  index: number;
  toastOn: boolean | null;
  captureOn: boolean | null;
}

/** Each React Query read call's argument text, with where the call starts. */
function readQueryCalls(block: string): Array<{ args: string; index: number }> {
  const out: Array<{ args: string; index: number }> = [];
  const re = /\b(?:useQuery|useInfiniteQuery|useQueries|useSuspenseQuery|useSuspenseInfiniteQuery)\b/g;
  for (let m = re.exec(block); m; m = re.exec(block)) {
    let i = m.index + m[0].length;
    while (/\s/.test(block[i] ?? '')) i++;
    if (block[i] === '<') {
      let depth = 0;
      for (; i < block.length; i++) {
        if (block[i] === '=' && block[i + 1] === '>') {
          i++;
          continue;
        }
        if (block[i] === '<') depth++;
        else if (block[i] === '>' && --depth === 0) break;
      }
      i++;
      while (/\s/.test(block[i] ?? '')) i++;
    }
    if (block[i] === '(') out.push({ args: balancedArgs(block, i), index: m.index });
  }
  return out;
}

/** A wrapper's options text for its argument, a same-file constant resolved; null when it cannot be seen. */
function resolveOptions(args: string, code: string): string | null {
  const trimmed = args.trim();
  if (trimmed === '' || trimmed.startsWith('{')) return trimmed;
  if (!/^\w+$/.test(trimmed)) return null;
  const decl = new RegExp(`(?:const|let|var)\\s+${trimmed}\\s*(?::[^=]+)?=\\s*(\\{[^}]*\\})`).exec(code);
  return decl ? decl[1] : null;
}

const optionOff = (options: string, option: string) => new RegExp(`\\b${escapeRegExp(option)}\\s*:\\s*false\\b`).test(options);

function callableReadsIn(file: { path: string; code: string }, facts: CallableReadFacts, kinds: ReadonlyMap<string, FactoryKind>): CallableRead[] {
  const reads: CallableRead[] = [];
  for (const block of exportBlocks(file.code)) {
    const text = block.text;
    const hook = exportedName(text) ?? new RegExp(`\\bfunction\\s+(${REACT_HOOK})`).exec(text)?.[1] ?? '(module scope)';
    const bindings: Array<{ name: string; ref: RegExp; toastOn: boolean | null; captureOn: boolean | null }> = [];
    for (const wrapper of facts.wrappers) {
      const hookName = escapeRegExp(wrapper.hook);
      const state = (args: string) => {
        const options = resolveOptions(args, file.code);
        return options === null
          ? { toastOn: null, captureOn: null }
          : { toastOn: !optionOff(options, wrapper.toastOption), captureOn: !optionOff(options, wrapper.captureOption) };
      };
      const destructured = new RegExp(`(?:const|let|var)\\s*\\{([^}]*)\\}\\s*=\\s*${hookName}\\s*\\(`, 'g');
      for (let m = destructured.exec(text); m; m = destructured.exec(text)) {
        const s = state(balancedArgs(text, m.index + m[0].length - 1));
        for (const part of m[1].split(',')) {
          const [key, alias] = part.split(':').map((p) => p.trim());
          if (key !== wrapper.invokeMember) continue;
          const local = alias || key;
          bindings.push({ name: local, ref: new RegExp(`\\b${escapeRegExp(local)}\\b`), ...s });
        }
      }
      const whole = new RegExp(`(?:const|let|var)\\s+(\\w+)\\s*=\\s*${hookName}\\s*\\(`, 'g');
      for (let m = whole.exec(text); m; m = whole.exec(text)) {
        const s = state(balancedArgs(text, m.index + m[0].length - 1));
        bindings.push({ name: `${m[1]}.${wrapper.invokeMember}`, ref: new RegExp(`\\b${m[1]}\\s*\\.\\s*${escapeRegExp(wrapper.invokeMember)}\\b`), ...s });
      }
    }
    if (kinds.size) {
      const whole = new RegExp(`(?:const|let|var)\\s+(\\w+)\\s*=\\s*(${REACT_HOOK})\\s*\\(`, 'g');
      for (let m = whole.exec(text); m; m = whole.exec(text)) {
        const kind = kinds.get(m[2]);
        if (!kind) continue;
        const on = kind !== 'reader';
        if (kind === 'mutation') bindings.push({ name: `${m[1]}.mutateAsync`, ref: new RegExp(`\\b${m[1]}\\s*\\.\\s*mutate(?:Async)?\\b`), toastOn: on, captureOn: on });
        else bindings.push({ name: m[1], ref: new RegExp(`\\b${m[1]}\\b`), toastOn: on, captureOn: on });
      }
      const destructured = new RegExp(`(?:const|let|var)\\s*\\{([^}]*)\\}\\s*=\\s*(${REACT_HOOK})\\s*\\(`, 'g');
      for (let m = destructured.exec(text); m; m = destructured.exec(text)) {
        if (kinds.get(m[2]) !== 'mutation') continue;
        for (const part of m[1].split(',')) {
          const [key, alias] = part.split(':').map((p) => p.trim());
          if (key !== 'mutateAsync' && key !== 'mutate') continue;
          const local = alias || key;
          bindings.push({ name: local, ref: new RegExp(`\\b${escapeRegExp(local)}\\b`), toastOn: true, captureOn: true });
        }
      }
    }
    if (!bindings.length) continue;
    const decls = localDeclarations(text);
    for (const call of readQueryCalls(text)) {
      for (const binding of bindings) {
        const direct = binding.ref.test(call.args);
        const viaHelper = [...decls].some(([name, decl]) => new RegExp(`\\b${escapeRegExp(name)}\\b`).test(call.args) && binding.ref.test(decl));
        if (direct || viaHelper) {
          reads.push({ path: file.path, hook, binding: binding.name, index: block.start + call.index, toastOn: binding.toastOn, captureOn: binding.captureOn });
        }
      }
    }
  }
  return reads;
}

/** Every finding about one read: where it lives and what it keeps. */
export function callableReadFindings(read: CallableRead, hooksRoot: string): string[] {
  const where = `${read.hook} (${read.binding})`;
  if (!isUnder(read.path, hooksRoot)) return [`${where} is a callable read outside ${hooksRoot}`];
  if (read.toastOn === null) return [`${where} passes wrapper options that are not statically visible`];
  return [...(read.toastOn ? [`${where} keeps the wrapper toast`] : []), ...(read.captureOn ? [`${where} keeps the wrapper capture`] : [])];
}

/** Each read-failure element rendering a read hook's failure without being handed the read's error. */
export function unhandedReadFailures(code: string, readHooks: readonly string[], surface: CallableReadFacts['readFailureSurface']): Array<{ index: number; binding: string }> {
  const names: string[] = [];
  for (const hook of readHooks) {
    const h = escapeRegExp(hook);
    for (const m of code.matchAll(new RegExp(`(?:const|let)\\s+(\\w+)\\s*=\\s*${h}\\s*[(<]`, 'g'))) names.push(m[1]);
    for (const m of code.matchAll(new RegExp(`(?:const|let)\\s*\\{([^}]*)\\}\\s*=\\s*${h}\\s*[(<]`, 'g'))) {
      for (const part of m[1].split(',')) {
        const [key, alias] = part.split(':').map((s) => s.trim().replace(/\s*=.*$/, ''));
        if (key && key !== 'data') names.push(alias || key);
      }
    }
  }
  if (!names.length) return [];
  const out: Array<{ index: number; binding: string }> = [];
  const tag = `<${surface.component}`;
  for (let i = code.indexOf(tag); i >= 0; i = code.indexOf(tag, i + tag.length)) {
    if (/[\w$]/.test(code[i + tag.length] ?? '')) continue;
    let j = i + tag.length;
    let depth = 0;
    for (; j < code.length; j++) {
      const c = code[j];
      if (c === '{') depth++;
      else if (c === '}') depth--;
      else if (depth === 0 && (c === '>' || (c === '/' && code[j + 1] === '>'))) break;
    }
    const lead = code.slice(Math.max(0, i - 250), i);
    const attrs = code.slice(i + tag.length, j);
    const bound = names.find((name) => new RegExp(`\\b${escapeRegExp(name)}\\b`).test(lead + attrs));
    if (bound && !new RegExp(`\\b${escapeRegExp(surface.errorProp)}\\s*=`).test(attrs)) out.push({ index: i, binding: bound });
  }
  return out;
}

export const callableReadGuard: GenericGuardDefinition<CallableReadFacts> = {
  id: 'callableReads',
  absentWhen: false,
  factProblems(facts) {
    const problems: string[] = [];
    textProblem(facts?.hooksRoot, 'hooksRoot', problems);
    if (!Array.isArray(facts?.wrappers)) problems.push('wrappers is missing (declare [] when there is none)');
    else facts.wrappers.forEach((w, i) => wrapperProblems(w, `wrappers[${i}]`, problems, ['hook', 'invokeMember', 'toastOption', 'captureOption']));
    if (!Array.isArray(facts?.factoryModules)) problems.push('factoryModules is missing (declare [] when there is none)');
    else {
      for (const m of facts.factoryModules) {
        textProblem(m?.module, 'a factory module', problems);
        if (!Array.isArray(m?.factories) || !m.factories.length) problems.push(`factory module ${String(m?.module)} names no factory`);
        else {
          for (const f of m.factories) {
            textProblem(f?.name, `a factory of ${m.module}`, problems);
            if (!['reader', 'mutation', 'invoker'].includes(f?.kind)) problems.push(`factory ${String(f?.name)} has no kind (reader, mutation, or invoker)`);
          }
        }
      }
    }
    if (Array.isArray(facts?.wrappers) && Array.isArray(facts?.factoryModules) && !facts.wrappers.length && !facts.factoryModules.length) {
      problems.push('the app declares no way to reach a callable (no wrapper and no factory module)');
    }
    wrapperProblems(facts?.readFailureSurface, 'readFailureSurface', problems, ['component', 'errorProp']);
    namesProblem(facts?.anchorReads, 'anchorReads', problems);
    return problems;
  },
  build(facts) {
    return [
      {
        title: 'a callable-backed read lives in a hook and keeps neither the wrapper toast nor its capture',
        description:
          `A React Query read that reaches a callable lives in ${facts.hooksRoot}, and the callable it reaches turns the ` +
          `wrapper's error toast and its capture off — a read failure renders through ${facts.readFailureSurface.component} ` +
          'and the query layer captures it once. Pass the opt-out options visibly (inline or a same-file constant), or ' +
          `reach the callable through a reader. Every ${facts.readFailureSurface.component} that renders a callable-backed ` +
          `read's failure is handed that read's error through \`${facts.readFailureSurface.errorProp}\`, so an answer the ` +
          'server refused renders as that answer, never as a load failure.',
        run(context) {
          const findings: Finding[] = [];
          const kinds = new Map<string, FactoryKind>();
          const moduleFiles = new Set<string>();
          for (const module of facts.factoryModules) {
            moduleFiles.add(module.module);
            if (!context.reader.exists(module.module)) {
              findings.push({ file: module.module, detail: 'the callable factory module no longer exists' });
              continue;
            }
            const read = factoryHookKinds(context.file(module.module).code, module);
            for (const [hook, kind] of read.kinds) kinds.set(hook, kind);
            for (const name of read.unused) findings.push({ file: module.module, detail: `stale factory: ${name} builds no exported hook` });
          }
          const files = context.files(APP_CODE).filter((f) => !moduleFiles.has(f.path));
          const reads = files.flatMap((file) => callableReadsIn(file, facts, kinds));
          const byFile = new Map(files.map((f) => [f.path, f]));
          for (const read of reads) {
            for (const detail of callableReadFindings(read, facts.hooksRoot)) {
              findings.push({ file: read.path, line: byFile.get(read.path)!.lineOf(read.index), detail });
            }
          }
          const readHooks = [...new Set(reads.map((r) => r.hook))];
          for (const anchor of facts.anchorReads) {
            if (!readHooks.includes(anchor)) findings.push({ file: '(anchorReads)', detail: `no callable-backed read found in ${anchor} — the detector no longer recognizes it, or the anchor is stale` });
          }
          for (const file of files) {
            if (isUnder(file.path, facts.hooksRoot)) continue;
            for (const hit of unhandedReadFailures(file.code, readHooks, facts.readFailureSurface)) {
              findings.push({ file: file.path, line: file.lineOf(hit.index), detail: `${facts.readFailureSurface.component} renders ${hit.binding}'s failure without its ${facts.readFailureSurface.errorProp}` });
            }
          }
          return findings;
        },
      },
    ];
  },
};

// ---------------------------------------------------------------------------------------------
// Double surface: one callable rejection is toasted once — by the wrapper, or by the caller.

export interface DoubleSurfaceFacts {
  /** The wrapper hook, its invoke member, its toast option, and the option naming answers the caller surfaces itself. */
  wrapper: { hook: string; invokeMember: string; toastOption: string; answerOption: string };
  /** The function that raises a toast. */
  toastCall: string;
  /** The toast variants that mark a failure toast. */
  destructiveVariants: readonly string[];
  /** Predicates that gate a local toast to a leg the wrapper cannot see. */
  nonCallableLegGuards: readonly string[];
  /** Import specifier prefixes that reach app source (relative imports always do). */
  appImportPrefixes: readonly string[];
  /** Hooks the guard must find keeping the wrapper toast — proof the pairing still sees them. */
  anchorHooks: readonly string[];
}

/** True when a text calls the wrapper with its error toast still on (a bare call, or options with no opt-out). */
const wrapperToastIsOn = (text: string, wrapper: DoubleSurfaceFacts['wrapper']) =>
  new RegExp(`${escapeRegExp(wrapper.hook)}\\(\\s*(?:\\)|\\{(?![^}]*${escapeRegExp(wrapper.toastOption)}\\s*:\\s*false)[^}]*\\})`).test(text);

/** Every export block that keeps the wrapper toast and toasts the same rejection again. */
export function sameFileDoubleSurfaces(code: string, facts: DoubleSurfaceFacts): Array<{ index: number; detail: string }> {
  const out: Array<{ index: number; detail: string }> = [];
  if (!code.includes(`${facts.wrapper.hook}(`)) return out;
  const toast = new RegExp(`\\b${escapeRegExp(facts.toastCall)}\\s*\\(`);
  const variants = facts.destructiveVariants.map(escapeRegExp).join('|');
  const failureVariant = new RegExp(`variant:\\s*['"](?:${variants})['"]`);
  const gated = (text: string) => facts.nonCallableLegGuards.some((g) => new RegExp(`\\b${escapeRegExp(g)}\\b`).test(text));
  for (const block of exportBlocks(code)) {
    const text = block.text;
    if (!wrapperToastIsOn(text, facts.wrapper)) continue;
    const name = exportedName(text) ?? '(module scope)';
    const onError = text.indexOf('onError');
    if (onError >= 0 && failureVariant.test(text) && !gated(text)) {
      out.push({ index: block.start + onError, detail: `${name} keeps the wrapper toast and toasts the failure again in onError` });
    }
    const answer = new RegExp(`\\b${escapeRegExp(facts.wrapper.answerOption)}\\s*:\\s*(\\w+)`).exec(text)?.[1];
    for (const { body, index } of catchBodies(text)) {
      if (!toast.test(body) || gated(body)) continue;
      if (answer && new RegExp(`\\b${answer}\\s*\\(`).test(body)) continue;
      out.push({ index: block.start + index, detail: `${name} keeps the wrapper toast and toasts the failure again in a catch` });
    }
  }
  return out;
}

/** Exported hooks whose block keeps the wrapper toast on, so each already surfaces every rejection. */
export function wrapperToastingHooks(files: ReadonlyArray<{ path: string; code: string }>, wrapper: DoubleSurfaceFacts['wrapper']): Map<string, string> {
  const hooks = new Map<string, string>();
  for (const file of files) {
    if (!file.code.includes(`${wrapper.hook}(`)) continue;
    for (const block of exportBlocks(file.code)) {
      if (!wrapperToastIsOn(block.text, wrapper)) continue;
      const name = new RegExp(`export\\s+(?:async\\s+)?(?:function|const)\\s+(${REACT_HOOK})`).exec(block.text)?.[1];
      if (name) hooks.set(name, file.path);
    }
  }
  return hooks;
}

const ACTION_MEMBERS = new Set(['mutate', 'mutateAsync', 'refetch']);

/** Every call site that toasts a rejection an imported wrapper-toasting hook already toasted. */
export function crossFileDoubleSurfaces(
  file: { path: string; code: string },
  hooks: ReadonlyMap<string, string>,
  facts: DoubleSurfaceFacts,
): Array<{ index: number; detail: string }> {
  const out: Array<{ index: number; detail: string }> = [];
  const code = file.code;
  const imported = new Set<string>();
  for (const clause of namedImports(code)) {
    const fromApp = clause.module.startsWith('.') || facts.appImportPrefixes.some((p) => clause.module.startsWith(p));
    if (fromApp) for (const binding of clause.names) imported.add(bindingNames(binding).local);
  }
  const toast = new RegExp(`\\b${escapeRegExp(facts.toastCall)}\\s*\\(`);
  const gated = (text: string) => facts.nonCallableLegGuards.some((g) => new RegExp(`\\b${escapeRegExp(g)}\\b`).test(text));
  const actionMembers = new Set([...ACTION_MEMBERS, facts.wrapper.invokeMember]);
  const seen = new Set<string>();
  const report = (index: number, detail: string) => {
    if (seen.has(detail)) return;
    seen.add(detail);
    out.push({ index, detail });
  };
  for (const [hook, hookFile] of hooks) {
    if (file.path === hookFile || !imported.has(hook)) continue;
    const bindings = new Set<string>();
    for (const m of code.matchAll(new RegExp(`(?:const|let|var)\\s+(\\w+)\\s*=\\s*${escapeRegExp(hook)}\\s*\\(`, 'g'))) bindings.add(m[1]);
    for (const m of code.matchAll(new RegExp(`(?:const|let|var)\\s*\\{([^}]*)\\}\\s*=\\s*${escapeRegExp(hook)}\\s*\\(`, 'g'))) {
      for (const part of m[1].split(',')) {
        const [key, alias] = part.split(':').map((s) => s.trim());
        if (!actionMembers.has(key)) continue;
        const local = alias || key;
        if (/^\w+$/.test(local)) bindings.add(local);
      }
    }
    for (const binding of bindings) {
      const calls = [...callArgs(code, `${binding}.mutate`), ...callArgs(code, `${binding}.mutateAsync`), ...callArgs(code, binding)];
      for (const call of calls) {
        for (const handler of handlersFor(call.args, 'onError')) {
          if (toast.test(handler) && !gated(handler)) report(call.index, `${binding} (${hook}, ${hookFile}) toasts again in its onError`);
        }
      }
      for (const pair of tryCatchPairs(code)) {
        if (!new RegExp(`\\b${escapeRegExp(binding)}\\b`).test(pair.tryBody)) continue;
        if (toast.test(pair.catchBody) && !gated(pair.catchBody)) report(pair.index, `${binding} (${hook}, ${hookFile}) toasts again in a catch`);
      }
    }
  }
  return out;
}

export const doubleSurfaceGuard: GenericGuardDefinition<DoubleSurfaceFacts> = {
  id: 'callableDoubleSurface',
  absentWhen: false,
  factProblems(facts) {
    const problems: string[] = [];
    wrapperProblems(facts?.wrapper, 'wrapper', problems, ['hook', 'invokeMember', 'toastOption', 'answerOption']);
    textProblem(facts?.toastCall, 'toastCall', problems);
    namesProblem(facts?.destructiveVariants, 'destructiveVariants', problems);
    namesProblem(facts?.nonCallableLegGuards, 'nonCallableLegGuards', problems);
    namesProblem(facts?.appImportPrefixes, 'appImportPrefixes', problems, { nonEmpty: false });
    namesProblem(facts?.anchorHooks, 'anchorHooks', problems);
    return problems;
  },
  build(facts) {
    return [
      {
        title: 'one callable rejection surfaces exactly once',
        description:
          `A hook that calls \`${facts.wrapper.hook}\` with its error toast on already toasts every rejection, so nothing ` +
          `toasts that rejection again — not the hook's own onError or catch, and not a call site that imports the hook. ` +
          `Fix one of: pass \`{ ${facts.wrapper.toastOption}: false }\` and own the only copy; drop the local toast and ` +
          `let the wrapper own the surface (an empty catch keeps any finally reset); or gate the local toast on a ` +
          `predicate that sees only the leg the wrapper cannot (${facts.nonCallableLegGuards.join(', ')}). A catch ` +
          `toast gated on the wrapper's own \`${facts.wrapper.answerOption}\` predicate is that answer's only surface.`,
        run(context) {
          const files = context.files(APP_CODE);
          const findings: Finding[] = [];
          for (const file of files) {
            for (const hit of sameFileDoubleSurfaces(file.code, facts)) findings.push({ file: file.path, line: file.lineOf(hit.index), detail: hit.detail });
          }
          const hooks = wrapperToastingHooks(files, facts.wrapper);
          for (const anchor of facts.anchorHooks) {
            if (!hooks.has(anchor)) findings.push({ file: '(anchorHooks)', detail: `${anchor} is not found keeping the wrapper toast — the pairing no longer sees it, or the anchor is stale` });
          }
          for (const file of files) {
            for (const hit of crossFileDoubleSurfaces(file, hooks, facts)) findings.push({ file: file.path, line: file.lineOf(hit.index), detail: hit.detail });
          }
          return findings;
        },
      },
    ];
  },
};

// ---------------------------------------------------------------------------------------------
// Error internals: a rendered element never shows a thrown error's message or stringification.

export interface ErrorInternalsFacts {
  /** The folders whose files render to the user. */
  renderRoots: readonly string[];
  /** Monitoring calls where error internals belong (besides `console.*` and `logger.*`). */
  captureCalls: readonly string[];
  allowlist: readonly AllowlistEntry[];
}

const LEAK = /(?:\b(?:\w*[Ee]rror|err|e)\s*\??\.\s*message\b|as\s+Error\s*\)\s*\.\s*message\b|\bString\s*\(\s*(?:\w*[Ee]rror|err|e)\s*\))/;
const BRACE_GROUP = /\{[^{}]*\}/g;

/** The render of error internals on one line, or null: a brace group holding one that is not an object property value. */
export function errorInternalsOnLine(line: string, captureCalls: readonly string[]): string | null {
  const logging = new RegExp(`\\b(?:console\\s*\\.\\s*\\w+|logger\\s*\\.\\s*\\w+${captureCalls.map((c) => `|${escapeRegExp(c)}`).join('')})\\s*\\(`);
  if (logging.test(line)) return null;
  for (const match of line.matchAll(BRACE_GROUP)) {
    const inner = match[0].slice(1, -1);
    const hit = LEAK.exec(inner);
    if (!hit) continue;
    if (/\w+\s*:/.test(inner.slice(0, hit.index))) continue;
    return hit[0];
  }
  return null;
}

export const errorInternalsGuard: GenericGuardDefinition<ErrorInternalsFacts> = {
  id: 'errorInternalsRender',
  absentWhen: false,
  factProblems(facts) {
    const problems: string[] = [];
    namesProblem(facts?.renderRoots, 'renderRoots', problems);
    namesProblem(facts?.captureCalls, 'captureCalls', problems, { nonEmpty: false });
    allowlistProblems(facts?.allowlist, problems);
    return problems;
  },
  build(facts) {
    const guard = reviewedAllowlist({
      title: "a rendered element never shows a thrown error's internals",
      description:
        `A surface under ${facts.renderRoots.join(', ')} never renders an error's message, an \`(x as Error).message\`, or a ` +
        "`String(error)` — in JSX, a template hole, or a prop. A thrown error's text leaks infrastructure detail and " +
        'tells the user nothing they can act on: render a fixed title naming what failed and a next-step sentence. ' +
        'Error internals belong in logging and monitoring capture, which this check leaves alone, as it does an ' +
        'object property value (a toast description owned by the callable wrapper).',
      scope: APP_CODE,
      match: (file) =>
        facts.renderRoots.some((root) => isUnder(file.path, root)) ? lineHits(file, (line) => errorInternalsOnLine(line, facts.captureCalls)) : [],
      allowlist: facts.allowlist,
      samples: {
        flags: [
          { path: `${facts.renderRoots[0]}/probe.tsx`, text: '<p>Failed: {error.message}</p>' },
          { path: `${facts.renderRoots[0]}/probe.tsx`, text: '<p>{(result.error as Error).message}</p>' },
          { path: `${facts.renderRoots[0]}/probe.tsx`, text: '<p>{String(error)}</p>' },
          { path: `${facts.renderRoots[0]}/probe.tsx`, text: 'error={error?.message || null}' },
        ],
        passes: [
          { path: `${facts.renderRoots[0]}/probe.tsx`, text: "toast({ title: 'Failed', description: e.message });" },
          { path: `${facts.renderRoots[0]}/probe.tsx`, text: "console.error('read failed', error.message);" },
          { path: `${facts.renderRoots[0]}/probe.tsx`, text: '<p>{errors.title.message}</p>' },
        ],
      },
    });
    return [guard];
  },
};
