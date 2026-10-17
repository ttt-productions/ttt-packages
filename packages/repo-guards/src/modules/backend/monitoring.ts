// The monitoring guards: every Cloud Function entry point reports its failures, monitoring is bound
// once per runtime in its adapters, the provider's SDK is named only where it starts, tests capture
// through the recording seam, telemetry tags survive the content policy, and a service the app does
// not use is named nowhere.

import ts from 'typescript';
import type { GenericGuardDefinition } from '../../config.js';
import type { Finding, Guard } from '../../guard.js';
import type { Scope } from '../../reader/reader.js';
import type { FileView } from '../../reader/view.js';
import type { Reviewed } from '../../reader/layout.js';
import { calleeName, forEachNode, lineOfNode } from '../../support/ast.js';
import { loaderProblem, namesProblem, reviewedProblems, textProblem } from '../../support/facts.js';
import { MODULE_LOADS, moduleImports, namesModule } from '../../support/imports.js';
import { escapeRegExp } from '../../support/text.js';

const FUNCTIONS_CODE: Scope = { roots: ['functions'], kinds: ['code'], tests: false };
const APP_CODE: Scope = { roots: ['app'], kinds: ['code'], tests: false };
const APP_AND_FUNCTIONS_CODE: Scope = { roots: ['app', 'functions'], kinds: ['code'], tests: false };

/** A pattern for a call to `name` (`a.b` matches `a . b (`), never a longer name ending in it. */
function callPattern(name: string): RegExp {
  return new RegExp(`(?<![\\w$])${name.split('.').map(escapeRegExp).join('\\s*\\.\\s*')}\\s*\\(`, 'g');
}

/** The index of every match of a pattern in a file's comment-stripped code. */
function matchIndexes(file: FileView, pattern: RegExp): number[] {
  const re = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`);
  const out: number[] = [];
  for (let m = re.exec(file.code); m; m = re.exec(file.code)) out.push(m.index);
  return out;
}

// ---------------------------------------------------------------------------------------------
// Monitoring: entry points, one init per runtime, the provider SDK, the recording seam.

export interface MonitoringFacts {
  /** The one monitoring package every capture goes through. */
  monitoringPackage: string;
  /** The package's init call, which binds the provider. */
  initCall: string;
  /** The package's capture calls. */
  captureCalls: readonly string[];
  /** App calls through which a callable exits, each capturing every fault. */
  callableExits: readonly string[];
  /** The one Functions module that initializes monitoring. */
  functionsInit: string;
  /** The app root's reporter bindings: the file that initializes, and the layout that mounts it as an element. */
  appReporters: ReadonlyArray<{ file: string; mountedIn: string; element: string }>;
  /** The provider SDK's package names (or scope, `@vendor`), named only where the SDK starts. */
  providerSdks: readonly string[];
  /** The provider SDK's own init call (`Vendor.init`). */
  providerInitCall: string;
  /** The files that start the provider SDK, each with its why; one that no longer starts it is stale. */
  sdkInitFiles: readonly Reviewed[];
  /** The Functions test seam that records captures; tests use it instead of mocking the package. */
  functionsTestRecorder: string;
}

/** Every Cloud Functions entry-point shape, with the label a finding reports. */
const ENTRY_POINT_SHAPES: ReadonlyArray<{ shape: string; re: RegExp }> = [
  { shape: 'onCall', re: /\bonCall\s*(?:<[^>]*>)?\s*\(/ },
  { shape: 'onRequest', re: /\bonRequest\s*\(/ },
  { shape: 'onSchedule', re: /\bonSchedule\s*\(/ },
  { shape: 'onDocument*', re: /\bonDocument\w*\s*\(/ },
  { shape: 'onObjectFinalized', re: /\bonObjectFinalized\s*\(/ },
  { shape: 'onObjectDeleted', re: /\bonObjectDeleted\s*\(/ },
  { shape: 'onMessagePublished', re: /\bonMessagePublished\s*\(/ },
  { shape: 'onTaskDispatched', re: /\bonTaskDispatched\s*\(/ },
  { shape: 'onValue*', re: /\bonValue\w*\s*\(/ },
];

/** The entry-point shapes a file defines, or none when its failures reach monitoring. */
export function unmonitoredEntryPoint(file: FileView, facts: Pick<MonitoringFacts, 'monitoringPackage' | 'captureCalls' | 'callableExits'>): string[] {
  const shapes = ENTRY_POINT_SHAPES.filter(({ re }) => re.test(file.code)).map(({ shape }) => shape);
  if (!shapes.length) return [];
  if (facts.callableExits.some((exit) => callPattern(exit).test(file.code))) return [];
  const importsMonitoring = moduleImports(file.sourceFile, MODULE_LOADS).some(({ spec, typeOnly }) => !typeOnly && namesModule(spec, facts.monitoringPackage));
  const captures = facts.captureCalls.some((capture) => new RegExp(`\\b${escapeRegExp(capture)}\\s*\\(`).test(file.code));
  return importsMonitoring && captures ? [] : shapes;
}

/** Every import of a provider SDK package. */
export function providerSdkImports(file: FileView, sdks: readonly string[]): Array<{ node: ts.Node; spec: string }> {
  return moduleImports(file.sourceFile, MODULE_LOADS)
    .filter(({ spec }) => sdks.some((sdk) => namesModule(spec, sdk)))
    .map(({ node, spec }) => ({ node, spec }));
}

/** Every `vi.mock` / `vi.doMock` of a package. */
export function packageMocks(file: FileView, pkg: string): ts.Node[] {
  return moduleImports(file.sourceFile, ['mock'])
    .filter(({ callee, spec }) => (callee === 'vi.mock' || callee === 'vi.doMock') && namesModule(spec, pkg))
    .map(({ node }) => node);
}

/** True when a file renders `<Element />` (or `<Element>…`). */
const mountsElement = (file: FileView, element: string) => new RegExp(`<${escapeRegExp(element)}(?=[\\s/>])`).test(file.code);

export const monitoringGuard: GenericGuardDefinition<MonitoringFacts> = {
  id: 'monitoring',
  absentWhen: false,
  factProblems(facts) {
    const problems: string[] = [];
    textProblem(facts?.monitoringPackage, 'monitoringPackage', problems);
    textProblem(facts?.initCall, 'initCall', problems);
    namesProblem(facts?.captureCalls, 'captureCalls', problems);
    namesProblem(facts?.callableExits, 'callableExits', problems, { nonEmpty: false });
    textProblem(facts?.functionsInit, 'functionsInit', problems);
    if (!Array.isArray(facts?.appReporters)) problems.push('appReporters is missing (declare [] when the app root binds no reporter)');
    for (const r of facts?.appReporters ?? []) {
      if (!r?.file || !r.mountedIn || !r.element) problems.push('an app reporter needs its file, the layout that mounts it, and the element');
    }
    namesProblem(facts?.providerSdks, 'providerSdks', problems);
    textProblem(facts?.providerInitCall, 'providerInitCall', problems);
    reviewedProblems(facts?.sdkInitFiles, 'sdkInitFiles', problems);
    textProblem(facts?.functionsTestRecorder, 'functionsTestRecorder', problems);
    return problems;
  },
  build(facts) {
    const initPattern = callPattern(facts.initCall);
    const providerInit = callPattern(facts.providerInitCall);
    const entryPoints: Guard = {
      title: 'every Cloud Function entry point reports its failures to monitoring',
      description:
        'Every file that defines a deployed Cloud Function — callable, HTTP, schedule, Firestore, Storage, pub/sub, task, ' +
        `or database trigger — either exits its callable through ${facts.callableExits.join(' / ') || 'the app\'s callable exit'} ` +
        `or imports ${facts.monitoringPackage} and calls ${facts.captureCalls.join(' / ')} on its failure path. A failure ` +
        'path that only writes a log line is not monitored: nothing watches the log, so a background trigger fails ' +
        'invisibly. An import that is never called is not monitoring either.',
      run(context) {
        const findings: Finding[] = [];
        for (const file of context.files(FUNCTIONS_CODE)) {
          const shapes = unmonitoredEntryPoint(file, facts);
          if (shapes.length) findings.push({ file: file.path, detail: `defines ${shapes.join(', ')} and reports no failure to monitoring` });
        }
        return findings;
      },
    };
    const initOnce: Guard = {
      title: 'monitoring is initialized once per runtime, only in its adapters',
      description:
        `The Functions runtime initializes monitoring in ${facts.functionsInit} and nowhere else; the app root binds its ` +
        `reporter only in its declared adapters, each initializing once and mounted by its layout. A second ` +
        `${facts.initCall} is a second configuration nothing keeps aligned with the first and double-reports the moment ` +
        'both run; a missing one leaves every capture writing into an unbound client. Pass the values at the existing ' +
        'adapter instead of opening a new init.',
      run(context) {
        const findings: Finding[] = [];
        let functionsInits = 0;
        for (const file of context.files(FUNCTIONS_CODE)) {
          const sites = matchIndexes(file, initPattern);
          if (file.path === facts.functionsInit) functionsInits += sites.length;
          else for (const i of sites) findings.push({ file: file.path, line: file.lineOf(i), detail: `${facts.initCall} outside the Functions adapter` });
        }
        if (functionsInits !== 1) findings.push({ file: facts.functionsInit, detail: `the Functions adapter calls ${facts.initCall} ${functionsInits} times, not once` });
        const reporters = new Map(facts.appReporters.map((r) => [r.file, r]));
        const reporterInits = new Map<string, number>();
        for (const file of context.files(APP_CODE)) {
          const sites = matchIndexes(file, initPattern);
          if (reporters.has(file.path)) reporterInits.set(file.path, sites.length);
          else for (const i of sites) findings.push({ file: file.path, line: file.lineOf(i), detail: `${facts.initCall} outside the app's reporter adapters` });
        }
        for (const reporter of facts.appReporters) {
          const count = reporterInits.get(reporter.file) ?? 0;
          if (count !== 1) findings.push({ file: reporter.file, detail: `the reporter adapter calls ${facts.initCall} ${count} times, not once` });
          if (!context.reader.exists(reporter.mountedIn)) findings.push({ file: reporter.mountedIn, detail: 'the layout that mounts the reporter no longer exists' });
          else if (!mountsElement(context.file(reporter.mountedIn), reporter.element)) {
            findings.push({ file: reporter.mountedIn, detail: `does not mount <${reporter.element} />, so the reporter is never bound` });
          }
        }
        return findings;
      },
    };
    const providerNamed: Guard = {
      title: 'the monitoring provider SDK is named only where it starts',
      description:
        `No file in the app or Functions roots imports a provider SDK package (${facts.providerSdks.join(', ')}) or calls ` +
        `${facts.providerInitCall}: the provider binds inside ${facts.monitoringPackage}, and a direct import is a third ` +
        'binding site whose DSN, environment, and sample rate the app boundary can no longer supply. Capture through the ' +
        'monitoring package instead. Each declared SDK init file still starts the SDK; one that no longer does is stale.',
      run(context) {
        const findings: Finding[] = [];
        for (const file of context.files(APP_AND_FUNCTIONS_CODE)) {
          for (const { node, spec } of providerSdkImports(file, facts.providerSdks)) {
            findings.push({ file: file.path, line: lineOfNode(file, node), detail: `imports ${spec}` });
          }
          for (const i of matchIndexes(file, providerInit)) findings.push({ file: file.path, line: file.lineOf(i), detail: `calls ${facts.providerInitCall}` });
        }
        for (const entry of facts.sdkInitFiles) {
          if (!context.reader.exists(entry.path)) findings.push({ file: entry.path, detail: 'stale SDK init file: it no longer exists' });
          else if (!matchIndexes(context.file(entry.path), providerInit).length) {
            findings.push({ file: entry.path, detail: `stale SDK init file: it no longer calls ${facts.providerInitCall}` });
          }
        }
        return findings;
      },
    };
    const recorderSeam: Guard = {
      title: 'Functions tests capture through the recording seam, never a local mock of the monitoring package',
      description:
        `No Functions test replaces ${facts.monitoringPackage} with a local vi.mock / vi.doMock. A test that asserts a ` +
        `capture installs the recording adapter (${facts.functionsTestRecorder}) through the package's own adapter seam; a ` +
        'test that only needs the handler to run needs no mock at all. A local mock lists only the exports its author ' +
        'knew, and a stubbed scope wrapper never runs the wrapped handler.',
      run(context) {
        const findings: Finding[] = [];
        let seam = false;
        for (const file of context.files({ roots: ['functions'], kinds: ['code'], tests: 'only' })) {
          if (file.path === facts.functionsTestRecorder) seam = true;
          for (const node of packageMocks(file, facts.monitoringPackage)) {
            findings.push({ file: file.path, line: lineOfNode(file, node), detail: `mocks ${facts.monitoringPackage}` });
          }
        }
        if (!seam) findings.push({ file: facts.functionsTestRecorder, detail: 'the recording seam is gone or is not test code' });
        return findings;
      },
    };
    return [entryPoints, initOnce, providerNamed, recorderSeam];
  },
};

// ---------------------------------------------------------------------------------------------
// Telemetry tag keys survive the content policy.

export interface TelemetryTagFacts {
  /** The app's telemetry content policy, as its monitoring package builds it, loaded at run time. */
  policy: () => Promise<{ isDiagnosticKey(key: string): boolean }> | { isDiagnosticKey(key: string): boolean };
  /** Tag keys whose value is always a flag, which passes under any key; a key set nowhere is stale. */
  flagKeys: ReadonlyArray<{ key: string; why: string }>;
  /** The name suffix of a constant whose values are tag keys (`_TAG_KEYS`). */
  tagKeyMapSuffix: string;
}

/** Every tag key a file sets: a `tags: { … }` literal's keys, `setTag('key', …)`, and a tag-key map's values. */
export function tagKeysSet(file: FileView, mapSuffix: string): Array<{ key: string; node: ts.Node }> {
  const sf = file.sourceFile;
  const out: Array<{ key: string; node: ts.Node }> = [];
  const keyOf = (name: ts.PropertyName) => (ts.isIdentifier(name) || ts.isStringLiteralLike(name) ? name.text : undefined);
  forEachNode(sf, (node) => {
    if (ts.isPropertyAssignment(node) && keyOf(node.name) === 'tags' && ts.isObjectLiteralExpression(node.initializer)) {
      for (const prop of node.initializer.properties) {
        const key = (ts.isPropertyAssignment(prop) || ts.isShorthandPropertyAssignment(prop)) && keyOf(prop.name);
        if (key) out.push({ key, node: prop });
      }
    }
    if (ts.isCallExpression(node) && calleeName(node) === 'setTag' && node.arguments[0] && ts.isStringLiteralLike(node.arguments[0])) {
      out.push({ key: node.arguments[0].text, node });
    }
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text.endsWith(mapSuffix) && node.initializer) {
      let init: ts.Expression = node.initializer;
      while (ts.isAsExpression(init) || ts.isSatisfiesExpression(init)) init = init.expression;
      if (ts.isObjectLiteralExpression(init)) {
        for (const prop of init.properties) {
          if (ts.isPropertyAssignment(prop) && ts.isStringLiteralLike(prop.initializer)) out.push({ key: prop.initializer.text, node: prop });
        }
      }
    }
  });
  return out;
}

export const telemetryTagGuard: GenericGuardDefinition<TelemetryTagFacts> = {
  id: 'telemetryTagKeys',
  absentWhen: 'the app declares no telemetry content policy',
  factProblems(facts) {
    const problems: string[] = [];
    loaderProblem(facts?.policy, 'policy', problems);
    reviewedProblems(facts?.flagKeys, 'flagKeys', problems, { key: 'key' });
    textProblem(facts?.tagKeyMapSuffix, 'tagKeyMapSuffix', problems);
    return problems;
  },
  build(facts) {
    return [
      {
        title: 'every backend telemetry tag key survives the content policy',
        description:
          'A tag the backend sets survives the telemetry content policy only under a diagnostic key, so every tag key a ' +
          "capture site sets — a `tags: { … }` literal's keys, a `setTag('key', …)`, a tag-key map's values — is one; " +
          'otherwise the policy silently drops it. Rename the tag to a diagnostic key, or widen the policy only to a key ' +
          'that never holds prose. A key whose value is always a flag is a reviewed entry with its why.',
        async run(context) {
          const policy = await facts.policy();
          const flags = new Set(facts.flagKeys.map((f) => f.key));
          const findings: Finding[] = [];
          const seen = new Set<string>();
          for (const file of context.files(FUNCTIONS_CODE)) {
            for (const { key, node } of tagKeysSet(file, facts.tagKeyMapSuffix)) {
              seen.add(key);
              if (!flags.has(key) && !policy.isDiagnosticKey(key)) {
                findings.push({ file: file.path, line: lineOfNode(file, node), detail: `tag key ${key} is not a diagnostic key, so the policy drops it` });
              }
            }
          }
          if (!seen.size) findings.push({ file: '(functions)', detail: 'no tag key found, so the guard checks nothing' });
          for (const key of flags) if (!seen.has(key)) findings.push({ file: '(flagKeys)', detail: `stale flag key ${key}: no capture site sets it` });
          return findings;
        },
      },
    ];
  },
};

// ---------------------------------------------------------------------------------------------
// A service the app does not use is named nowhere.

export interface UnusedServiceFacts {
  /** Services the product has no surface for, each with its why. */
  services: ReadonlyArray<{ name: string; why: string }>;
  /** Text that contains a service's name but is not the service (a word it is part of), each with its why. */
  collisions: ReadonlyArray<{ text: string; why: string }>;
  /** Files outside the roots read by name: manifests, deployed configuration, workflows, rules, index files. */
  namedFiles: readonly string[];
}

const SERVICE_SCOPE: Scope = {
  roots: ['app', 'functions', 'e2e', 'hostedE2e', 'scripts', 'workers'],
  optionalRoots: ['functions', 'e2e', 'hostedE2e', 'scripts', 'workers'],
  kinds: ['code', 'config', 'rules'],
  tests: true,
};

/**
 * Where a service's name appears as a name: its lowercase form starting a word and not running on
 * into lowercase letters (`svc`, `svcSessionId`, `svc.`, `'svc'`, `@svc/`); its capitalized form
 * anywhere not running on (`Svc`, `loadSvc`); its uppercase form standing alone between non-letters
 * (`SVC_KEY`). A longer word that merely contains it (`svced`, `pinsvc`) is not the service.
 */
export function serviceNamePatterns(name: string): RegExp[] {
  const lower = escapeRegExp(name.toLowerCase());
  const cap = escapeRegExp(name.charAt(0).toUpperCase() + name.slice(1).toLowerCase());
  const upper = escapeRegExp(name.toUpperCase());
  return [
    new RegExp(`(?<![A-Za-z0-9])${lower}(?![a-z])`, 'g'),
    new RegExp(`${cap}(?![a-z])`, 'g'),
    new RegExp(`(?<![A-Z0-9])${upper}(?![A-Z0-9])`, 'g'),
  ];
}

/** The lines of a file's text a reader of the service name reads: comments skipped by line. */
function readableLines(file: FileView): string[] {
  const lines = file.code.split('\n');
  const name = file.path.slice(file.path.lastIndexOf('/') + 1);
  if (file.kind === 'config' && !/\.jsonc?$/.test(name)) return lines.map((l) => (/^\s*#/.test(l) ? '' : l));
  if (file.kind === 'rules') return lines.map((l) => (/^\s*\/\//.test(l) ? '' : l));
  return lines;
}

/** Every place a file names a service, collisions taken out; `collisionHits` counts each collision seen. */
export function serviceNameSites(
  file: FileView,
  facts: Pick<UnusedServiceFacts, 'services' | 'collisions'>,
  collisionHits?: Map<string, number>,
): Array<{ line: number; detail: string }> {
  const out: Array<{ line: number; detail: string }> = [];
  for (const { name } of facts.services) {
    const segment = new RegExp(`^${escapeRegExp(name)}(?:\\.[cm]?[jt]sx?)?$`, 'i');
    if (file.path.split('/').some((s) => segment.test(s))) out.push({ line: 1, detail: `the file path is named for ${name}` });
  }
  readableLines(file).forEach((line, index) => {
    const covered: Array<[number, number]> = [];
    for (const { text } of facts.collisions) {
      for (let i = line.indexOf(text); i !== -1; i = line.indexOf(text, i + 1)) {
        covered.push([i, i + text.length]);
        collisionHits?.set(text, (collisionHits.get(text) ?? 0) + 1);
      }
    }
    for (const { name } of facts.services) {
      for (const re of serviceNamePatterns(name)) {
        for (let m = re.exec(line); m; m = re.exec(line)) {
          const start = m.index;
          const end = start + m[0].length;
          if (!covered.some(([a, b]) => a <= start && end <= b)) out.push({ line: index + 1, detail: `names ${name}: ${line.trim().slice(0, 100)}` });
        }
      }
    }
  });
  const seen = new Set<string>();
  return out.filter((s) => {
    const key = `${s.line}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export const unusedServiceGuard: GenericGuardDefinition<UnusedServiceFacts> = {
  id: 'unusedService',
  absentWhen: 'the app has no external service it must keep out of the product',
  factProblems(facts) {
    const problems: string[] = [];
    reviewedProblems(facts?.services, 'services', problems, { key: 'name', nonEmpty: true });
    for (const s of facts?.services ?? []) if (typeof s?.name === 'string' && !/^[A-Za-z][A-Za-z0-9]*$/.test(s.name)) problems.push(`service ${s.name} is not one word`);
    reviewedProblems(facts?.collisions, 'collisions', problems, { key: 'text' });
    namesProblem(facts?.namedFiles, 'namedFiles', problems, { nonEmpty: false });
    return problems;
  },
  build(facts) {
    const names = facts.services.map((s) => s.name).join(', ');
    return [
      {
        title: 'a service the product does not use is named nowhere',
        description:
          `The product has no surface for ${names}, so nothing names it: no source, test, or script — not its SDK ` +
          'packages, its client or loader, a module of the tree named for it, a field, callable, hook, or handler built on ' +
          'its name, or its credentials — and no manifest, deployed configuration, workflow, rules file, or index file. The ' +
          'service returns only as a product decision that brings its own adapter, secret binding, rules, and tests. Text ' +
          'that merely contains the name is a reviewed collision with its why; a collision found nowhere is stale.',
        run(context) {
          const findings: Finding[] = [];
          const collisionHits = new Map<string, number>();
          const files = context.files(SERVICE_SCOPE);
          const read = new Set(files.map((f) => f.path));
          for (const path of facts.namedFiles) {
            if (read.has(path)) continue;
            if (!context.reader.exists(path)) findings.push({ file: path, detail: 'a named file no longer exists' });
            else files.push(context.file(path));
          }
          for (const file of files) {
            for (const site of serviceNameSites(file, facts, collisionHits)) findings.push({ file: file.path, line: site.line, detail: site.detail });
          }
          for (const { text } of facts.collisions) if (!collisionHits.get(text)) findings.push({ file: '(collisions)', detail: `stale collision ${text}: it appears nowhere` });
          return findings;
        },
      },
    ];
  },
};
