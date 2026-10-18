// The monitoring guards: entry points report failures, one init per runtime, the provider SDK named
// only where it starts, the recording seam, telemetry tag keys, and a service named nowhere.

import { afterEach, describe, expect, it } from 'vitest';
import {
  monitoringGuard,
  telemetryTagGuard,
  unusedServiceGuard,
  type MonitoringFacts,
  type UnusedServiceFacts,
} from '../../src/modules/backend/monitoring.js';
import { backendRepo, type BackendRepo } from './repo.js';

let repo: BackendRepo | undefined;
afterEach(() => repo?.remove());

const facts: MonitoringFacts = {
  monitoringPackage: '@pkg/monitoring-core',
  initCall: 'initMonitoring',
  captureCalls: ['captureException', 'captureMessage'],
  callableExits: ['exitCallableCatch'],
  functionsInit: 'functions/src/monitoring-init.ts',
  appReporters: [{ file: 'src/app/monitoring-provider.tsx', mountedIn: 'src/app/layout.tsx', element: 'MonitoringProvider' }],
  providerSdks: ['@vendor'],
  providerInitCall: 'Vendor.init',
  sdkInitFiles: [{ path: 'instrumentation-client.ts', why: "the browser's one SDK start" }],
  functionsTestRecorder: 'functions/src/test/recorder.ts',
  reportedByCore: [],
};

const testHelpers = { testCodePaths: [{ path: 'functions/src/test', why: 'the Functions test seams' }] };

const clean: Record<string, string> = {
  'functions/src/monitoring-init.ts': "import { initMonitoring } from '@pkg/monitoring-core';\nexport const ready = initMonitoring(opts);",
  'functions/src/callable.ts':
    "export const f = onCall({ enforceAppCheck: true }, async (r) => { try { return run(); } catch (e) { exitCallableCatch('f', e, 'x'); } });",
  'functions/src/trigger.ts':
    "import * as mon from '@pkg/monitoring-core';\nexport const t = onDocumentCreated('x/{id}', async (e) => { try { await f(e); } catch (err) { mon.captureException(err); throw err; } });",
  'functions/src/helper.ts': 'export const h = 1;',
  'src/app/monitoring-provider.tsx': 'export function MonitoringProvider() { useEffect(() => { void initMonitoring({}); }, []); return null; }',
  'src/app/layout.tsx': 'export default function L() { return <body><MonitoringProvider /></body>; }',
  'instrumentation-client.ts': "import * as Vendor from '@vendor/nextjs';\nVendor.init({ dsn });",
  'functions/src/test/recorder.ts': 'export function installRecorder() {}',
  'functions/src/a.test.ts': "vi.mock('firebase-functions/logger', () => ({}));",
};

describe('monitoring', () => {
  it('passes a callable that exits through the exit, a captured trigger, the adapters, the SDK start, and the recording seam', async () => {
    repo = backendRepo(clean, testHelpers);
    for (const guard of monitoringGuard.build(facts)) expect(await repo.run(guard), guard.title).toEqual([]);
  });

  it('FLAGS an unmonitored entry point, a second init, the SDK named in app code, a stale SDK start, and a local package mock', async () => {
    repo = backendRepo(
      {
        ...clean,
        'functions/src/sched.ts':
          "import { onSchedule } from 'firebase-functions/v2/scheduler';\nexport const s = onSchedule('every 24 hours', async () => { try { await r(); } catch (e) { logger.error(e); } });",
        'functions/src/imported-only.ts':
          "import { captureException } from '@pkg/monitoring-core';\nexport const p = onObjectFinalized(async () => { await x(); });",
        'functions/src/local.ts':
          "import { captureException } from './local-logger.js';\nexport const w = onDocumentWritten('x', async () => { try { await y(); } catch (e) { captureException(e); } });",
        'functions/src/second-init.ts': "/**\n * Initialized in the adapter.\n */\ninitMonitoring({ provider: 'x' });",
        'functions/src/raw.ts': "import { captureException } from '@vendor/node';",
        'src/components/shell.tsx': "useEffect(() => { void initMonitoring({}); }, []);\nimport * as V from '@vendor/browser';\nVendor.init({});",
        'instrumentation-client.ts': 'export const x = 1;',
        'functions/src/b.test.ts': [
          "vi.mock('@pkg/monitoring-core', async (o) => ({ ...(await o()) }));",
          'vi.doMock("@pkg/monitoring-core", () => ({}));',
          "// vi.mock('@pkg/monitoring-core')",
        ].join('\n'),
      },
      testHelpers,
    );
    const [entryPoints, initOnce, providerNamed, recorder] = monitoringGuard.build(facts);
    expect(await repo.run(entryPoints!)).toEqual([
      { file: 'functions/src/imported-only.ts', detail: 'defines onObjectFinalized and reports no failure to monitoring' },
      { file: 'functions/src/local.ts', detail: 'defines onDocument* and reports no failure to monitoring' },
      { file: 'functions/src/sched.ts', detail: 'defines onSchedule and reports no failure to monitoring' },
    ]);
    expect(await repo.run(initOnce!)).toEqual([
      { file: 'functions/src/second-init.ts', line: 4, detail: 'initMonitoring outside the Functions adapter' },
      { file: 'src/components/shell.tsx', line: 1, detail: "initMonitoring outside the app's reporter adapters" },
    ]);
    expect(await repo.run(providerNamed!)).toEqual([
      { file: 'functions/src/raw.ts', line: 1, detail: 'imports @vendor/node' },
      { file: 'src/components/shell.tsx', line: 2, detail: 'imports @vendor/browser' },
      { file: 'src/components/shell.tsx', line: 3, detail: 'calls Vendor.init' },
      { file: 'instrumentation-client.ts', detail: 'stale SDK init file: it no longer calls Vendor.init' },
    ]);
    expect(await repo.run(recorder!)).toEqual([
      { file: 'functions/src/b.test.ts', line: 1, detail: 'mocks @pkg/monitoring-core' },
      { file: 'functions/src/b.test.ts', line: 2, detail: 'mocks @pkg/monitoring-core' },
    ]);
  });

  it('passes an entry point whose reviewed core reports every failure, and flags each stale entry', async () => {
    const coreCaptures = [
      "import { captureException } from '@pkg/monitoring-core';",
      'export async function runCore(e) { try { await work(e); } catch (err) { captureException(err); throw err; } }',
    ].join('\n');
    const delegates = ["import { runCore } from './run-core.js';", "export const t = onDocumentCreated('x/{id}', async (e) => runCore(e));"].join('\n');
    const why = 'the core captures every failure and throws an expected redelivery signal';
    const reviewedFacts: MonitoringFacts = {
      ...facts,
      reportedByCore: [
        { path: 'functions/src/media/delegate.ts', core: 'functions/src/media/run-core.ts', why },
        { path: 'functions/src/media/self.ts', core: 'functions/src/media/run-core.ts', why },
        { path: 'functions/src/media/other.ts', core: 'functions/src/media/run-core.ts', why },
        { path: 'functions/src/media/silent.ts', core: 'functions/src/media/run-silent.ts', why },
        { path: 'functions/src/media/gone.ts', core: 'functions/src/media/run-core.ts', why },
      ],
    };
    repo = backendRepo(
      {
        ...clean,
        'functions/src/media/run-core.ts': coreCaptures,
        'functions/src/media/run-silent.ts': 'export async function runSilent(e) { await work(e); }',
        'functions/src/media/delegate.ts': delegates,
        'functions/src/media/self.ts': [
          "import { captureException } from '@pkg/monitoring-core';",
          "import { runCore } from './run-core.js';",
          "export const t = onDocumentCreated('x', async (e) => { try { await runCore(e); } catch (err) { captureException(err); throw err; } });",
        ].join('\n'),
        'functions/src/media/other.ts': ["import { other } from './elsewhere.js';", "export const t = onDocumentCreated('x', async (e) => other(e));"].join('\n'),
        'functions/src/media/silent.ts': ["import { runSilent } from './run-silent.js';", "export const t = onDocumentCreated('x', async (e) => runSilent(e));"].join('\n'),
      },
      testHelpers,
    );
    const [entryPoints] = monitoringGuard.build(reviewedFacts);
    expect(await repo.run(entryPoints!)).toEqual([
      { file: 'functions/src/media/other.ts', detail: 'a reportedByCore entry names functions/src/media/run-core.ts, which the entry point does not import' },
      { file: 'functions/src/media/self.ts', detail: 'a reportedByCore entry for an entry point that reports on its own' },
      { file: 'functions/src/media/silent.ts', detail: 'a reportedByCore entry names functions/src/media/run-silent.ts, which reports no failure to monitoring' },
      { file: 'functions/src/media/gone.ts', detail: 'a reportedByCore entry for a file the Functions code does not hold' },
    ]);
  });

  it('refuses a config without reportedByCore, or with an entry missing its core or why', () => {
    const { reportedByCore: _omitted, ...withoutList } = facts;
    expect(monitoringGuard.factProblems(withoutList as MonitoringFacts)).toContain(
      'reportedByCore is missing (declare [] when every entry point reports its own failures)',
    );
    expect(monitoringGuard.factProblems({ ...facts, reportedByCore: [{ path: 'functions/src/t.ts', core: '', why: ' ' }] })).toContain(
      'a reportedByCore entry needs its entry file, its core module, and its why',
    );
  });

  it('FLAGS an adapter that initializes twice, a reporter that never initializes, a layout that never mounts it, and a missing seam', async () => {
    repo = backendRepo({
      ...clean,
      'functions/src/monitoring-init.ts': 'initMonitoring(a);\ninitMonitoring(b);',
      'src/app/monitoring-provider.tsx': 'export function MonitoringProvider() { return null; }',
      'src/app/layout.tsx': 'export default function L() { return <body><MonitoringProviderShell /></body>; }',
      'functions/src/test/recorder.ts': '',
    });
    const [, initOnce, , recorder] = monitoringGuard.build(facts);
    expect(await repo.run(initOnce!)).toEqual([
      { file: 'functions/src/monitoring-init.ts', detail: 'the Functions adapter calls initMonitoring 2 times, not once' },
      { file: 'src/app/monitoring-provider.tsx', detail: 'the reporter adapter calls initMonitoring 0 times, not once' },
      { file: 'src/app/layout.tsx', detail: 'does not mount <MonitoringProvider />, so the reporter is never bound' },
    ]);
    expect(await repo.run(recorder!)).toEqual([{ file: 'functions/src/test/recorder.ts', detail: 'the recording seam is gone or is not test code' }]);
  });

  it('refuses a reporter without its layout and an SDK start without a why', () => {
    expect(
      monitoringGuard.factProblems({
        ...facts,
        appReporters: [{ file: 'src/app/p.tsx', mountedIn: '', element: 'P' }],
        sdkInitFiles: [{ path: 'instrumentation.ts', why: '' }],
      }),
    ).toEqual(['an app reporter needs its file, the layout that mounts it, and the element', 'sdkInitFiles entry instrumentation.ts carries no why']);
  });
});

describe('telemetry tag keys', () => {
  const tagFacts = {
    policy: () => ({ isDiagnosticKey: (key: string) => ['uid', 'stage'].includes(key) || /^[a-z]\w*Id$/.test(key) }),
    flagKeys: [{ key: 'isSafe', why: 'its value is always a flag' }],
    tagKeyMapSuffix: '_TAG_KEYS',
  };

  it("FLAGS a tags literal's key, a setTag key, and a tag-key map's value the policy drops; PASSES diagnostic keys and a reviewed flag key", async () => {
    repo = backendRepo({
      'functions/src/a.ts': [
        "captureException(e, { tags: { uid, stage: 'x', caseId: id, isSafe: true } });",
        "scope.setTag('reason', r);",
        "export const ALARM_TAG_KEYS = { lane: 'deadline_lane', stage: 'stage' } as const;",
        "captureMessage('m', { tags: { freeText: t } });",
      ].join('\n'),
    });
    const [guard] = telemetryTagGuard.build(tagFacts);
    expect(await repo.run(guard!)).toEqual([
      { file: 'functions/src/a.ts', line: 2, detail: 'tag key reason is not a diagnostic key, so the policy drops it' },
      { file: 'functions/src/a.ts', line: 3, detail: 'tag key deadline_lane is not a diagnostic key, so the policy drops it' },
      { file: 'functions/src/a.ts', line: 4, detail: 'tag key freeText is not a diagnostic key, so the policy drops it' },
    ]);
  });

  it('FLAGS a flag key no capture site sets', async () => {
    repo = backendRepo({ 'functions/src/a.ts': "captureException(e, { tags: { uid } });" });
    const [guard] = telemetryTagGuard.build(tagFacts);
    expect(await repo.run(guard!)).toEqual([{ file: '(flagKeys)', detail: 'stale flag key isSafe: no capture site sets it' }]);
  });

  it('refuses a policy that is not a loader', () => {
    expect(telemetryTagGuard.factProblems({ ...tagFacts, policy: undefined as never })).toEqual(['policy needs a loader function']);
  });
});

describe('a service the product does not use is named nowhere', () => {
  const serviceFacts: UnusedServiceFacts = {
    services: [{ name: 'paysvc', why: 'the product has no payment surface' }],
    collisions: [
      { text: 'row-paysvc', why: "a table's row-stripe class" },
      { text: 'rowPaysvc', why: "a table's row-stripe flag" },
    ],
    namedFiles: ['package.json', 'deploy.yaml', 'firestore.rules'],
  };
  const table = "const cls = 'q-row-paysvc';\nconst rowPaysvc = true;\nconst paysvced = 1; const showPaysvcs = 2; const PAYSVCED = 3; const pinpaysvc = 4;";
  const named = {
    'package.json': '{\n  "dependencies": { "react": "^19" }\n}',
    'deploy.yaml': '# PAYSVC_KEY is gone\nenv: []',
    'firestore.rules': '// no paysvcId is granted\nallow read: if true;',
  };

  it('passes words that merely contain the name, reviewed collisions, and comments in configuration and rules', async () => {
    repo = backendRepo({ 'src/table.tsx': table, ...named });
    const [guard] = unusedServiceGuard.build(serviceFacts);
    expect(await repo.run(guard!)).toEqual([]);
  });

  it('FLAGS the SDK, its import, a field, a credential, its webhook header, a module named for it, a dependency, a deployed setting, and a rules field', async () => {
    repo = backendRepo({
      'src/table.tsx': table,
      'functions/src/store/checkout.ts': [
        'const client = new Paysvc(key);',
        "import Pay from 'paysvc';",
        'const x = order.paysvcSessionId;',
        'const k = process.env.NEXT_PUBLIC_PAYSVC_KEY;',
        "const sig = req.headers['paysvc-signature'];",
        '// Paysvc named in a comment',
      ].join('\n'),
      'functions/src/shared/paysvc.ts': 'export const c = 1;',
      'package.json': '{\n  "dependencies": { "paysvc": "^1" }\n}',
      'deploy.yaml': '# PAYSVC_KEY is gone\nenv:\n  - variable: PAYSVC_SECRET',
      'firestore.rules': '// no paysvcId is granted\nallow update: if request.resource.data.paysvcId == null;',
    });
    const [guard] = unusedServiceGuard.build(serviceFacts);
    expect(await repo.run(guard!)).toEqual([
      { file: 'functions/src/shared/paysvc.ts', line: 1, detail: 'the file path is named for paysvc' },
      { file: 'functions/src/store/checkout.ts', line: 1, detail: 'names paysvc: const client = new Paysvc(key);' },
      { file: 'functions/src/store/checkout.ts', line: 2, detail: "names paysvc: import Pay from 'paysvc';" },
      { file: 'functions/src/store/checkout.ts', line: 3, detail: 'names paysvc: const x = order.paysvcSessionId;' },
      { file: 'functions/src/store/checkout.ts', line: 4, detail: 'names paysvc: const k = process.env.NEXT_PUBLIC_PAYSVC_KEY;' },
      { file: 'functions/src/store/checkout.ts', line: 5, detail: "names paysvc: const sig = req.headers['paysvc-signature'];" },
      { file: 'package.json', line: 2, detail: 'names paysvc: "dependencies": { "paysvc": "^1" }' },
      { file: 'deploy.yaml', line: 3, detail: 'names paysvc: - variable: PAYSVC_SECRET' },
      { file: 'firestore.rules', line: 2, detail: 'names paysvc: allow update: if request.resource.data.paysvcId == null;' },
    ]);
  });

  it('FLAGS a collision that appears nowhere and a named file that is gone', async () => {
    repo = backendRepo({ 'package.json': named['package.json'], 'deploy.yaml': named['deploy.yaml'] });
    const [guard] = unusedServiceGuard.build(serviceFacts);
    expect(await repo.run(guard!)).toEqual([
      { file: 'firestore.rules', detail: 'a named file no longer exists' },
      { file: '(collisions)', detail: 'stale collision row-paysvc: it appears nowhere' },
      { file: '(collisions)', detail: 'stale collision rowPaysvc: it appears nowhere' },
    ]);
  });

  it('refuses a service name that is not one word and an empty service list', () => {
    expect(unusedServiceGuard.factProblems({ ...serviceFacts, services: [{ name: 'pay svc', why: 'x' }] })).toEqual(['service pay svc is not one word']);
    expect(unusedServiceGuard.factProblems({ ...serviceFacts, services: [] })).toEqual(['services is empty']);
  });
});
