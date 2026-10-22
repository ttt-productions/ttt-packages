import type { GenericGuardDefinition } from '../../node/suite/config.js';
import type { Finding, Guard, GuardContext } from '../../guard.js';
import type { Scope } from '../../node/reader.js';
import type { FileView } from '../../reader/view.js';
import { reviewedAllowlist, type AllowlistEntry, type Hit } from '../../shapes/shapes.js';
import {
  allowlistProblems,
  namesProblem,
  objectProblem,
  textProblem,
} from '../../support/facts.js';
import { fromStatements, moduleImports, namesModule } from '../../support/imports.js';
import { escapeRegExp, isUnder } from '../../support/text.js';
import {
  CALLABLE_KINDS,
  declarationFactProblems,
  readDeclarations,
  type CallableDeclarationFacts,
  type CallableKind,
} from './declarations.js';
import {
  balancedArgs,
  callArgs,
  exportBlocks,
  exportedName,
  handlersFor,
  localDeclarations,
  memberOrBareCalls,
  throughNamespace,
  tryCatchPairs,
} from './text.js';
import { forEachNode, isPlainString } from '../../support/ast.js';

const APP_CODE: Scope = { roots: ['app'], kinds: ['code'], tests: false };
const REACT_HOOK = 'use[A-Z]\\w*';

const withExtraCheck = (guard: Guard, extra: (context: GuardContext) => Finding[]): Guard => ({
  ...guard,
  async run(context) {
    return [...(await guard.run(context)), ...extra(context)];
  },
});

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
  new RegExp(
    `\\bexport\\s+(?:async\\s+)?(?:function\\s*\\*?|const|let)\\s+${escapeRegExp(name)}\\b`,
  ).test(code) || new RegExp(`\\bexport\\s*\\{[^}]*\\b${escapeRegExp(name)}\\b[^}]*\\}`).test(code);

export interface CallableErrorCopyFacts {
  owner: { file: string; exportName: string };
  allowlist: readonly AllowlistEntry[];
}

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
    allowlistProblems(facts?.allowlist, 'allowlist', problems);
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
        file.path === owner
          ? []
          : lineHits(file, (line) =>
              RAW_MESSAGE_SHAPES.some((re) => re.test(line)) ? 'raw error message' : null,
            ),
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
        if (!context.reader.exists(owner))
          return [{ file: owner, detail: 'the copy owner no longer exists' }];
        return declaresExport(context.file(owner).code, exportName)
          ? []
          : [{ file: owner, detail: `the copy owner no longer exports ${exportName}` }];
      }),
    ];
  },
};

export interface CallableTransportFacts {
  transports: ReadonlyArray<{ module: string; symbols: readonly string[]; owner?: string }>;
}

function transportHits(
  file: FileView,
  transport: { module: string; symbols: readonly string[] },
): Hit[] {
  const { code, sourceFile } = file;
  const hits: Hit[] = [];
  const namespaces: string[] = [];
  for (const site of fromStatements(sourceFile)) {
    if (!namesModule(site.spec, transport.module)) continue;
    if (site.namespace) namespaces.push(site.namespace);
    for (const symbol of transport.symbols) {
      if (site.named.some((n) => n.imported === symbol || n.local === symbol)) {
        hits.push({
          index: site.node.getStart(sourceFile),
          detail: `imports ${symbol} from ${site.spec}`,
        });
      }
    }
  }
  for (const namespace of namespaces) {
    for (const symbol of transport.symbols) {
      const re = new RegExp(
        `\\b${escapeRegExp(namespace)}\\s*\\.\\s*${escapeRegExp(symbol)}\\b`,
        'g',
      );
      for (let m = re.exec(code); m; m = re.exec(code))
        hits.push({ index: m.index, detail: `reaches ${namespace}.${symbol}` });
    }
  }
  for (const symbol of transport.symbols) {
    for (const index of memberOrBareCalls(code, symbol)) {
      if (!throughNamespace(code, index, namespaces))
        hits.push({ index, detail: `calls ${symbol}(` });
    }
  }
  return hits;
}

export const callableTransportGuard: GenericGuardDefinition<CallableTransportFacts> = {
  id: 'callableTransport',
  absentWhen: false,
  factProblems(facts) {
    const problems: string[] = [];
    if (!Array.isArray(facts?.transports) || !facts.transports.length)
      return ['transports is missing or empty'];
    for (const t of facts.transports) {
      textProblem(t?.module, 'a transport module', problems);
      if (t?.owner !== undefined)
        textProblem(t.owner, `transport ${String(t?.module)}'s owner`, problems);
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
          'invocation deadline, the error normalization, and the one capture — or, for a transport with no owner, by ' +
          'no app file at all. Nothing else imports, re-exports, reaches through a namespace, or calls them: call the ' +
          'hook or function the owner exports.',
        run(context) {
          const findings: Finding[] = [];
          const held = new Set<string>();
          for (const file of context.files(APP_CODE)) {
            for (const transport of facts.transports) {
              const hits = transportHits(file, transport);
              if (!hits.length) continue;
              if (transport.owner !== undefined && file.path === transport.owner)
                held.add(transport.owner);
              else {
                const where =
                  transport.owner === undefined
                    ? 'no app file may name it'
                    : `outside its owner ${transport.owner}`;
                for (const hit of hits)
                  findings.push({
                    file: file.path,
                    line: file.lineOf(hit.index),
                    detail: `${where}: ${hit.detail}`,
                  });
              }
            }
          }
          for (const transport of facts.transports) {
            if (transport.owner === undefined) continue;
            if (!context.reader.exists(transport.owner))
              findings.push({
                file: transport.owner,
                detail: 'the transport owner no longer exists',
              });
            else if (!held.has(transport.owner))
              findings.push({
                file: transport.owner,
                detail: `stale owner: it no longer names any of ${transport.symbols.join(', ')}`,
              });
          }
          return findings;
        },
      },
    ];
  },
};

const TOAST_OPTION = 'showErrorToast';
const ANSWER_OPTION = 'isAnswerSurfacedByCaller';
const ACTION_MEMBERS = ['mutate', 'mutateAsync'];

interface HookBinding {
  name: string;
  calls: readonly string[];
  hook: string;
  args: string;
  index: number;
}

function hookBindings(code: string, hooks: ReadonlySet<string>): HookBinding[] {
  const out: HookBinding[] = [];
  const whole = new RegExp(
    `(?:const|let|var)\\s+([\\w$]+)\\s*=\\s*(${REACT_HOOK})\\s*(?:<[^()]*?>)?\\s*\\(`,
    'g',
  );
  for (let m = whole.exec(code); m; m = whole.exec(code)) {
    if (!hooks.has(m[2])) continue;
    const args = balancedArgs(code, m.index + m[0].length - 1);
    out.push({
      name: m[1],
      calls: [...ACTION_MEMBERS.map((member) => `${m![1]}.${member}`), m[1]],
      hook: m[2],
      args,
      index: m.index,
    });
  }
  const destructured = new RegExp(
    `(?:const|let|var)\\s*\\{([^}]*)\\}\\s*=\\s*(${REACT_HOOK})\\s*(?:<[^()]*?>)?\\s*\\(`,
    'g',
  );
  for (let m = destructured.exec(code); m; m = destructured.exec(code)) {
    if (!hooks.has(m[2])) continue;
    const args = balancedArgs(code, m.index + m[0].length - 1);
    for (const part of m[1].split(',')) {
      const [key, alias] = part.split(':').map((p) => p.trim());
      if (!ACTION_MEMBERS.includes(key)) continue;
      const local = alias || key;
      if (/^[\w$]+$/.test(local))
        out.push({ name: local, calls: [local], hook: m[2], args, index: m.index });
    }
  }
  return out;
}

function resolveOptions(args: string, code: string): string | null {
  const trimmed = args.trim();
  if (trimmed === '' || trimmed.startsWith('{')) return trimmed;
  if (!/^\w+$/.test(trimmed)) return null;
  const decl = new RegExp(`(?:const|let|var)\\s+${trimmed}\\s*(?::[^=]+)?=\\s*(\\{[^}]*\\})`).exec(
    code,
  );
  return decl ? decl[1] : null;
}

const toastIsOn = (args: string, code: string) => {
  const options = resolveOptions(args, code);
  return options === null || !new RegExp(`\\b${TOAST_OPTION}\\s*:\\s*false\\b`).test(options);
};

export interface CallableNameFacts {
  declarations: CallableDeclarationFacts;
  allowlist: readonly AllowlistEntry[];
}

export function callableNameHits(file: FileView, names: ReadonlyMap<string, string>): Hit[] {
  const hits: Hit[] = [];
  const sf = file.sourceFile;
  forEachNode(sf, (node) => {
    if (isPlainString(node) && names.has(node.text)) {
      hits.push({
        index: node.getStart(sf),
        detail: `names the callable ${node.text}: call its declared hook ${names.get(node.text)}`,
      });
    }
  });
  return hits;
}

export const callableNameGuard: GenericGuardDefinition<CallableNameFacts> = {
  id: 'callableNames',
  absentWhen: false,
  factProblems(facts) {
    const problems: string[] = [];
    declarationFactProblems(facts?.declarations, 'declarations', problems);
    allowlistProblems(facts?.allowlist, 'allowlist', problems);
    return problems;
  },
  build(facts) {
    return [
      {
        title: "a callable's name is written only in its declaration",
        description:
          `Each callable is declared once, in ${facts.declarations.modules.join(', ')}, as a named hook built by one of the ` +
          `callable factories (${CALLABLE_KINDS.map((k) => facts.declarations.factories[k]).join(', ')}), with its name ` +
          'as a string literal. No other app source writes that name: call the declared hook, so a renamed or removed ' +
          'callable fails to compile in one place instead of failing when clicked. A file that holds the same string ' +
          'for another reason is a reviewed allowlist entry with its why; an entry whose file no longer holds it is stale.',
        run(context) {
          const { declared, findings } = readDeclarations(context, facts.declarations);
          const names = new Map(
            declared.filter((d) => d.callable !== null).map((d) => [d.callable!, d.hook]),
          );
          const modules = new Set(facts.declarations.modules);
          const reviewed = new Map(facts.allowlist.map((e) => [e.path, e]));
          const held = new Map<string, number>();
          for (const file of context.files(APP_CODE)) {
            if (modules.has(file.path)) continue;
            const hits = callableNameHits(file, names);
            if (!hits.length) continue;
            const entry = reviewed.get(file.path);
            const allowed = entry ? (entry.count ?? hits.length) : 0;
            if (entry) held.set(file.path, hits.length);
            for (const hit of hits.slice(allowed)) {
              findings.push({
                file: file.path,
                line: file.lineOf(hit.index),
                detail: entry ? `more than the ${allowed} reviewed: ${hit.detail}` : hit.detail!,
              });
            }
          }
          for (const entry of facts.allowlist) {
            const found = held.get(entry.path) ?? 0;
            if (!found)
              findings.push({
                file: entry.path,
                detail: 'stale entry: the file no longer holds a callable name (or is gone)',
              });
            else if (entry.count !== undefined && found < entry.count)
              findings.push({
                file: entry.path,
                detail: `stale count: reviewed ${entry.count}, found ${found}`,
              });
          }
          return findings;
        },
      },
    ];
  },
};

export interface CallableReadFacts {
  declarations: CallableDeclarationFacts;
  hooksRoot: string;
  readFailureSurface: { component: string; errorProp: string };
  anchorReads: readonly string[];
}

interface CallableRead {
  path: string;
  where: string;
  binding: string;
  hook: string;
  kind: CallableKind;
  index: number;
}

function readQueryCalls(block: string): Array<{ args: string; index: number }> {
  const out: Array<{ args: string; index: number }> = [];
  const re =
    /\b(?:useQuery|useInfiniteQuery|useQueries|useSuspenseQuery|useSuspenseInfiniteQuery)\b/g;
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

export function callableReadsIn(
  file: { path: string; code: string },
  kinds: ReadonlyMap<string, CallableKind>,
): CallableRead[] {
  const reads: CallableRead[] = [];
  const hooks = new Set(kinds.keys());
  for (const block of exportBlocks(file.code)) {
    const text = block.text;
    const bindings = hookBindings(text, hooks);
    if (!bindings.length) continue;
    const where =
      exportedName(text) ??
      new RegExp(`\\bfunction\\s+(${REACT_HOOK})`).exec(text)?.[1] ??
      '(module scope)';
    const decls = localDeclarations(text);
    for (const call of readQueryCalls(text)) {
      for (const binding of bindings) {
        const ref = new RegExp(`(?<![\\w$.])${escapeRegExp(binding.name)}\\b`);
        const direct = ref.test(call.args);
        const viaHelper = [...decls].some(
          ([name, decl]) =>
            name !== binding.name &&
            new RegExp(`\\b${escapeRegExp(name)}\\b`).test(call.args) &&
            ref.test(decl),
        );
        if (direct || viaHelper) {
          reads.push({
            path: file.path,
            where,
            binding: binding.name,
            hook: binding.hook,
            kind: kinds.get(binding.hook)!,
            index: block.start + call.index,
          });
        }
      }
    }
  }
  return reads;
}

export function callableReadFindings(read: CallableRead, hooksRoot: string): string[] {
  const where = `${read.where} (${read.binding})`;
  return [
    ...(isUnder(read.path, hooksRoot) ? [] : [`${where} is a callable read outside ${hooksRoot}`]),
    ...(read.kind === 'reader'
      ? []
      : [
          `${where} reads through ${read.hook}, a declared ${read.kind}: declare the callable as a reader`,
        ]),
  ];
}

export function unhandedReadFailures(
  code: string,
  readHooks: readonly string[],
  surface: CallableReadFacts['readFailureSurface'],
): Array<{ index: number; binding: string }> {
  const names: string[] = [];
  for (const hook of readHooks) {
    const h = escapeRegExp(hook);
    for (const m of code.matchAll(new RegExp(`(?:const|let)\\s+(\\w+)\\s*=\\s*${h}\\s*[(<]`, 'g')))
      names.push(m[1]);
    for (const m of code.matchAll(
      new RegExp(`(?:const|let)\\s*\\{([^}]*)\\}\\s*=\\s*${h}\\s*[(<]`, 'g'),
    )) {
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
    const bound = names.find((name) =>
      new RegExp(`\\b${escapeRegExp(name)}\\b`).test(lead + attrs),
    );
    if (bound && !new RegExp(`\\b${escapeRegExp(surface.errorProp)}\\s*=`).test(attrs))
      out.push({ index: i, binding: bound });
  }
  return out;
}

export const callableReadGuard: GenericGuardDefinition<CallableReadFacts> = {
  id: 'callableReads',
  absentWhen: false,
  factProblems(facts) {
    const problems: string[] = [];
    declarationFactProblems(facts?.declarations, 'declarations', problems);
    textProblem(facts?.hooksRoot, 'hooksRoot', problems);
    if (objectProblem(facts?.readFailureSurface, 'readFailureSurface', problems)) {
      textProblem(facts.readFailureSurface.component, 'readFailureSurface.component', problems);
      textProblem(facts.readFailureSurface.errorProp, 'readFailureSurface.errorProp', problems);
    }
    namesProblem(facts?.anchorReads, 'anchorReads', problems);
    return problems;
  },
  build(facts) {
    const reader = facts.declarations.factories.reader;
    return [
      {
        title: 'a callable-backed read lives in a hook and goes through a reader',
        description:
          `A React Query read that reaches a callable lives in ${facts.hooksRoot} and calls a hook declared with ` +
          `\`${reader}\`: a reader shows no toast and captures nothing, because the read's failure renders through ` +
          `${facts.readFailureSurface.component} and the query layer captures it once. An action, a resumable action, ` +
          `or an invoker inside a read toasts and captures that failure a second time — declare the callable with ` +
          `\`${reader}\` instead. Every ${facts.readFailureSurface.component} that renders a callable-backed read's ` +
          `failure is handed that read's error through \`${facts.readFailureSurface.errorProp}\`, so an answer the ` +
          'server refused renders as that answer, never as a load failure.',
        run(context) {
          const { declared, findings } = readDeclarations(context, facts.declarations);
          const kinds = new Map(declared.map((d) => [d.hook, d.kind]));
          const modules = new Set(facts.declarations.modules);
          const files = context.files(APP_CODE).filter((f) => !modules.has(f.path));
          const reads = files.flatMap((file) => callableReadsIn(file, kinds));
          const byFile = new Map(files.map((f) => [f.path, f]));
          for (const read of reads) {
            for (const detail of callableReadFindings(read, facts.hooksRoot)) {
              findings.push({
                file: read.path,
                line: byFile.get(read.path)!.lineOf(read.index),
                detail,
              });
            }
          }
          const readHooks = [...new Set(reads.map((r) => r.where))];
          for (const anchor of facts.anchorReads) {
            if (!readHooks.includes(anchor))
              findings.push({
                file: '(anchorReads)',
                detail: `no callable-backed read found in ${anchor} — the detector no longer recognizes it, or the anchor is stale`,
              });
          }
          for (const file of files) {
            if (isUnder(file.path, facts.hooksRoot)) continue;
            for (const hit of unhandedReadFailures(
              file.code,
              readHooks,
              facts.readFailureSurface,
            )) {
              findings.push({
                file: file.path,
                line: file.lineOf(hit.index),
                detail: `${facts.readFailureSurface.component} renders ${hit.binding}'s failure without its ${facts.readFailureSurface.errorProp}`,
              });
            }
          }
          return findings;
        },
      },
    ];
  },
};

export interface DoubleSurfaceFacts {
  declarations: CallableDeclarationFacts;
  toastCall: string;
  nonCallableLegGuards: readonly string[];
  appImportPrefixes: readonly string[];
}

type ToastingHooks = ReadonlyMap<string, string>;

export function wrappingHooks(
  files: ReadonlyArray<{ path: string; code: string }>,
  declared: ToastingHooks,
): Map<string, string> {
  const hooks = new Map<string, string>();
  const names = new Set(declared.keys());
  for (const file of files) {
    for (const block of exportBlocks(file.code)) {
      const name = new RegExp(`export\\s+(?:async\\s+)?(?:function|const)\\s+(${REACT_HOOK})`).exec(
        block.text,
      )?.[1];
      if (!name || names.has(name)) continue;
      if (hookBindings(block.text, names).some((b) => toastIsOn(b.args, file.code)))
        hooks.set(name, file.path);
    }
  }
  return hooks;
}

export function doubleSurfaces(
  file: FileView,
  toasting: ToastingHooks,
  wrappers: ToastingHooks,
  facts: Pick<DoubleSurfaceFacts, 'toastCall' | 'nonCallableLegGuards' | 'appImportPrefixes'>,
): Array<{ index: number; detail: string }> {
  const code = file.code;
  const imported = new Set<string>();
  for (const site of moduleImports(file.sourceFile, ['import'])) {
    const fromApp =
      site.spec.startsWith('.') || facts.appImportPrefixes.some((p) => site.spec.startsWith(p));
    if (fromApp) for (const name of site.named) imported.add(name.local);
  }
  const visible = new Map<string, string>(toasting);
  for (const [hook, origin] of wrappers)
    if (origin !== file.path && imported.has(hook)) visible.set(hook, origin);
  const toast = new RegExp(`\\b${escapeRegExp(facts.toastCall)}\\s*\\(`);
  const out: Array<{ index: number; detail: string }> = [];
  const seen = new Set<string>();
  const report = (index: number, detail: string) => {
    if (seen.has(`${index}:${detail}`)) return;
    seen.add(`${index}:${detail}`);
    out.push({ index, detail });
  };
  for (const binding of hookBindings(code, new Set(visible.keys()))) {
    if (!wrappers.has(binding.hook) && !toastIsOn(binding.args, code)) continue;
    const answer = new RegExp(`\\b${ANSWER_OPTION}\\s*:\\s*([\\w$]+)`).exec(binding.args)?.[1];
    const gated = (text: string) =>
      facts.nonCallableLegGuards.some((g) => new RegExp(`\\b${escapeRegExp(g)}\\b`).test(text)) ||
      (!!answer && new RegExp(`\\b${escapeRegExp(answer)}\\s*\\(`).test(text));
    const surfaces = (handler: string) => toast.test(handler) && !gated(handler);
    const who = `${binding.name} (${binding.hook}, ${visible.get(binding.hook)})`;
    if (handlersFor(binding.args, 'onError').some(surfaces))
      report(binding.index, `${who} toasts again in the onError it hands the hook`);
    for (const name of binding.calls) {
      for (const call of callArgs(code, name)) {
        if (handlersFor(call.args, 'onError').some(surfaces))
          report(call.index, `${who} toasts again in its onError`);
      }
    }
    const ref = new RegExp(`(?<![\\w$.])${escapeRegExp(binding.name)}\\b`);
    for (const pair of tryCatchPairs(code)) {
      if (ref.test(pair.tryBody) && surfaces(pair.catchBody))
        report(pair.index, `${who} toasts again in a catch`);
    }
    for (const mutation of callArgs(code, 'useMutation')) {
      if (ref.test(mutation.args) && handlersFor(mutation.args, 'onError').some(surfaces)) {
        report(mutation.index, `${who} toasts again in the onError of the mutation that calls it`);
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
    declarationFactProblems(facts?.declarations, 'declarations', problems);
    textProblem(facts?.toastCall, 'toastCall', problems);
    namesProblem(facts?.nonCallableLegGuards, 'nonCallableLegGuards', problems);
    namesProblem(facts?.appImportPrefixes, 'appImportPrefixes', problems, { nonEmpty: false });
    return problems;
  },
  build(facts) {
    return [
      {
        title: 'one callable rejection surfaces exactly once',
        description:
          'A hook declared as an action, a resumable action, or an invoker shows the shared error toast for every ' +
          `rejection unless its call site passes \`{ ${TOAST_OPTION}: false }\`, and so does an app hook built over one. ` +
          `While that toast is on, nothing toasts the same rejection again — not an onError handed to the hook or to ` +
          'its mutate call, not a catch around it, and not the onError of a mutation that calls it. Fix one of: pass ' +
          `\`{ ${TOAST_OPTION}: false }\` and own the only surface; drop the local toast (an empty catch keeps any ` +
          'finally reset); or gate the local toast on a predicate that sees only the leg the shared toast cannot ' +
          `(${facts.nonCallableLegGuards.join(', ')}), or on the predicate the call site hands \`${ANSWER_OPTION}\`, ` +
          "which makes the caller that answer's only surface.",
        run(context) {
          const { declared, findings } = readDeclarations(context, facts.declarations);
          const toasting = new Map(
            declared.filter((d) => d.kind !== 'reader').map((d) => [d.hook, d.file]),
          );
          if (!toasting.size && !findings.length) {
            findings.push({
              file: '(declarations)',
              detail:
                'no action, resumable action, or invoker is declared, so the check sees no toasting hook',
            });
          }
          const modules = new Set(facts.declarations.modules);
          const files = context.files(APP_CODE).filter((f) => !modules.has(f.path));
          const wrappers = wrappingHooks(files, toasting);
          for (const file of files) {
            for (const hit of doubleSurfaces(file, toasting, wrappers, facts))
              findings.push({ file: file.path, line: file.lineOf(hit.index), detail: hit.detail });
          }
          return findings;
        },
      },
    ];
  },
};

export interface ErrorInternalsFacts {
  renderRoots: readonly string[];
  captureCalls: readonly string[];
  allowlist: readonly AllowlistEntry[];
}

const LEAK =
  /(?:\b(?:\w*[Ee]rror|err|e)\s*\??\.\s*message\b|as\s+Error\s*\)\s*\.\s*message\b|\bString\s*\(\s*(?:\w*[Ee]rror|err|e)\s*\))/;
const BRACE_GROUP = /\{[^{}]*\}/g;

export function errorInternalsOnLine(line: string, captureCalls: readonly string[]): string | null {
  const logging = new RegExp(
    `\\b(?:console\\s*\\.\\s*\\w+|logger\\s*\\.\\s*\\w+${captureCalls.map((c) => `|${escapeRegExp(c)}`).join('')})\\s*\\(`,
  );
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
    allowlistProblems(facts?.allowlist, 'allowlist', problems);
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
        'object property value (a toast description, which the callable policy owns).',
      scope: APP_CODE,
      match: (file) =>
        facts.renderRoots.some((root) => isUnder(file.path, root))
          ? lineHits(file, (line) => errorInternalsOnLine(line, facts.captureCalls))
          : [],
      allowlist: facts.allowlist,
      samples: {
        flags: [
          { path: `${facts.renderRoots[0]}/probe.tsx`, text: '<p>Failed: {error.message}</p>' },
          {
            path: `${facts.renderRoots[0]}/probe.tsx`,
            text: '<p>{(result.error as Error).message}</p>',
          },
          { path: `${facts.renderRoots[0]}/probe.tsx`, text: '<p>{String(error)}</p>' },
          { path: `${facts.renderRoots[0]}/probe.tsx`, text: 'error={error?.message || null}' },
        ],
        passes: [
          {
            path: `${facts.renderRoots[0]}/probe.tsx`,
            text: "toast({ title: 'Failed', description: e.message });",
          },
          {
            path: `${facts.renderRoots[0]}/probe.tsx`,
            text: "console.error('read failed', error.message);",
          },
          { path: `${facts.renderRoots[0]}/probe.tsx`, text: '<p>{errors.title.message}</p>' },
        ],
      },
    });
    return [guard];
  },
};
