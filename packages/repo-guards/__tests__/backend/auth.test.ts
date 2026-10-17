// The authority guards: the admin claim read only by its resolver, one request-origin reader, no
// blocking function, and every callable's App Check posture.

import { afterEach, describe, expect, it } from 'vitest';
import {
  adminClaimGuard,
  appCheckGuard,
  noBlockingFunctionGuard,
  requestOriginGuard,
  type AdminClaimFacts,
  type AppCheckFacts,
} from '../../src/modules/backend/auth.js';
import { backendRepo, samplesHold, type BackendRepo } from './repo.js';

let repo: BackendRepo | undefined;
afterEach(() => repo?.remove());

describe('the admin claim is read only by its resolver', () => {
  const facts: AdminClaimFacts = {
    claimKeys: ['isAdmin', 'isJrAdmin'],
    readers: [{ path: 'functions/src/shared/admin-auth.ts', why: 'the resolver: its fast path reads the claim beside the roster read' }],
    appServerZone: { folders: ['src/app/api'], serverModules: ['firebase-admin'] },
  };
  const clean = {
    'functions/src/shared/admin-auth.ts': 'export const fast = (ctx) => ctx.token.isAdmin === true;',
    'functions/src/claims.ts': 'await auth.setCustomUserClaims(uid, { isAdmin: true });\nif (args.isAdmin) run();',
    'functions/src/claims.test.ts': 'const a = request.auth.token.isAdmin;',
    'src/components/nav.tsx': 'if (claims?.isAdmin) show();',
    'src/app/api/ok/route.ts': 'export const ok = 1;',
  };

  it('passes the resolver, a claim write, a resolved role, tests, and client code', async () => {
    repo = backendRepo(clean);
    const [guard] = adminClaimGuard.build(facts);
    expect(await repo.run(guard!)).toEqual([]);
    expect(samplesHold(guard!)).toBe(true);
  });

  it('FLAGS every claim read in Functions and app server code, and a resolver that stops reading it', async () => {
    repo = backendRepo({
      ...clean,
      'functions/src/shared/admin-auth.ts': 'export const fast = () => roster.has(uid);',
      'functions/src/a.ts': [
        'if (request.auth.token.isAdmin === true) return all;',
        'const allowed = claims?.isAdmin === true;',
        "const x = authToken?.['isAdmin'];",
        'const { uid, isAdmin = false } = ctx.token;',
        'const jr = decodedToken.isJrAdmin;',
        '// request.auth.token.isAdmin in prose',
      ].join('\n'),
      'src/app/api/media/route.ts': 'const isAdmin = decoded.isAdmin === true;',
      'src/lib/priv.ts': "import { getAuth } from 'firebase-admin/auth';\nreturn customClaims.isAdmin ? a : b;",
    });
    const [guard] = adminClaimGuard.build(facts);
    expect(await repo.run(guard!)).toEqual([
      { file: 'functions/src/a.ts', line: 1, detail: 'not on the reviewed list: token.isAdmin' },
      { file: 'functions/src/a.ts', line: 2, detail: 'not on the reviewed list: claims?.isAdmin' },
      { file: 'functions/src/a.ts', line: 3, detail: "not on the reviewed list: authToken?.['isAdmin']" },
      { file: 'functions/src/a.ts', line: 4, detail: 'not on the reviewed list: { uid, isAdmin = false } = ctx.token' },
      { file: 'functions/src/a.ts', line: 5, detail: 'not on the reviewed list: decodedToken.isJrAdmin' },
      { file: 'src/app/api/media/route.ts', line: 1, detail: 'not on the reviewed list: decoded.isAdmin' },
      { file: 'src/lib/priv.ts', line: 2, detail: 'not on the reviewed list: customClaims.isAdmin' },
      { file: 'functions/src/shared/admin-auth.ts', detail: 'stale entry: the file no longer holds the pattern (or is gone, or is outside the scope)' },
    ]);
  });

  it('refuses facts that name no resolver', () => {
    expect(adminClaimGuard.factProblems({ ...facts, readers: [] })).toEqual(['readers is empty: name the resolver that answers the admin question']);
  });
});

describe("a request's origin is read in one place", () => {
  const facts = { reader: 'functions/src/shared/request-origin.ts' };
  const owner = "const raw = headers?.['x-forwarded-for'];\nconst h = request.rawRequest?.headers;";

  it('FLAGS a raw-request read, the forwarded header in any case, and req.ip outside the reader; PASSES the reader and prose', async () => {
    repo = backendRepo({
      'functions/src/shared/request-origin.ts': owner,
      'functions/src/b.ts': 'const facts = { ip: context.ip };',
      'functions/src/c.ts': [
        'const ip = request.rawRequest?.ip ?? null;',
        "const hops = headers['X-Forwarded-For'];",
        'const caller = req.ip;',
        '// rawRequest in prose',
      ].join('\n'),
    });
    const [guard] = requestOriginGuard.build(facts);
    expect(await repo.run(guard!)).toEqual([
      { file: 'functions/src/c.ts', line: 1, detail: 'outside its owner: rawRequest' },
      { file: 'functions/src/c.ts', line: 2, detail: 'outside its owner: X-Forwarded-For' },
      { file: 'functions/src/c.ts', line: 3, detail: 'outside its owner: req.ip' },
    ]);
    expect(samplesHold(guard!)).toBe(true);
  });

  it('FLAGS a reader that no longer reads the origin', async () => {
    repo = backendRepo({ 'functions/src/shared/request-origin.ts': 'export const none = 1;' });
    const [guard] = requestOriginGuard.build(facts);
    expect(await repo.run(guard!)).toEqual([
      { file: 'functions/src/shared/request-origin.ts', detail: 'stale owner: the pattern no longer appears in it (or it is outside the scope)' },
    ]);
  });

  it('refuses facts with no reader', () => {
    expect(requestOriginGuard.factProblems({ reader: '' })).toEqual(['reader is missing']);
  });
});

describe('no sign-in waits on a blocking function', () => {
  it('FLAGS the identity module imported or required, and a v1 blocking builder; PASSES other function modules', async () => {
    repo = backendRepo({
      'functions/src/auth.ts': [
        "import { beforeUserSignedIn } from 'firebase-functions/v2/identity';",
        'export const b = functions.auth.user().beforeSignIn((u) => u);',
        "const m = require('firebase-functions/identity');",
      ].join('\n'),
      'functions/src/ok.ts': "import { onCall } from 'firebase-functions/v2/https';\n// beforeSignIn( is never registered",
    });
    const [guard] = noBlockingFunctionGuard.build({});
    expect(await repo.run(guard!)).toEqual([
      { file: 'functions/src/auth.ts', line: 1, detail: 'imports firebase-functions/v2/identity' },
      { file: 'functions/src/auth.ts', line: 3, detail: 'imports firebase-functions/identity' },
      { file: 'functions/src/auth.ts', line: 2, detail: 'registers beforeSignIn' },
    ]);
  });

  it('takes no facts', () => {
    expect(noBlockingFunctionGuard.factProblems({})).toEqual([]);
    expect(noBlockingFunctionGuard.factProblems({ extra: 1 } as never)).toEqual(['this guard takes no facts: declare {}']);
  });
});

describe('every callable declares its App Check posture', () => {
  const facts: AppCheckFacts = {
    consumingFolders: ['functions/src/payments'],
    adminAuth: { call: 'assertAuth', option: 'admin' },
    consumptionExempt: [{ callable: 'adminLiveScore', why: 'live scoring is latency-sensitive and high-volume' }],
  };
  const clean = {
    'functions/src/payments/pay.ts': 'export const pay = onCall({ region: R, enforceAppCheck: true, consumeAppCheckToken: true }, handler);',
    'functions/src/admin/tool.ts': [
      'export const adminTool = onCall<In, Out>({',
      '  enforceAppCheck: true,',
      '  consumeAppCheckToken: true,',
      '}, async (request) => { await assertAuth(request, { admin: {} }); });',
      'export const adminLiveScore = onCall({ enforceAppCheck: true }, async (request) => { await assertAuth(request, { admin: {} }); });',
    ].join('\n'),
    'functions/src/member.ts': 'export const member = onCall({ enforceAppCheck: true }, async (request) => { await assertAuth(request); });',
    'functions/src/factory.ts': [
      'function make(id: string) {',
      '  return onCall({ enforceAppCheck: true, consumeAppCheckToken: true }, async (request) => { await assertAuth(request, { admin: {} }); });',
      '}',
      "export const adminCopyA = make('a');",
    ].join('\n'),
  };

  it('passes enforced callables, consuming folder and admin callables that consume, a factory-made one, and a reviewed exemption', async () => {
    repo = backendRepo(clean);
    const [guard] = appCheckGuard.build(facts);
    expect(await repo.run(guard!)).toEqual([]);
  });

  it('FLAGS a missing, false, or variable enforceAppCheck, unreadable options, and a consuming-folder, admin, or factory-made callable that does not consume', async () => {
    repo = backendRepo({
      'functions/src/payments/pay.ts': 'export const pay = onCall({ region: R, enforceAppCheck: true }, handler);',
      'functions/src/member.ts': [
        "export const a = onCall({ region: R, invoker: 'public' }, handler);",
        'export const b = onCall({ enforceAppCheck: false }, handler);',
        'export const c = onCall({ enforceAppCheck: ENFORCE }, handler);',
        'export const d = onCall(OPTIONS, handler);',
        'export const e = onCall(',
        '  {',
        '    region: R,',
        '    // enforceAppCheck: true,',
        '  },',
        '  handler,',
        ');',
      ].join('\n'),
      'functions/src/admin/tool.ts':
        'export const adminFoo = onCall({ enforceAppCheck: true }, async (request) => { await assertAuth(request, { admin: {} }); });',
      'functions/src/factory.ts': [
        'function make(id: string) {',
        '  return onCall({ enforceAppCheck: true }, async (request) => { await assertAuth(request, { admin: {} }); });',
        '}',
        "export const adminCopyA = make('a');",
      ].join('\n'),
    });
    const [guard] = appCheckGuard.build(facts);
    expect(await repo.run(guard!)).toEqual([
      { file: 'functions/src/admin/tool.ts', line: 1, detail: 'adminFoo: no consumeAppCheckToken: true' },
      { file: 'functions/src/factory.ts', line: 4, detail: 'adminCopyA: no consumeAppCheckToken: true' },
      { file: 'functions/src/member.ts', line: 1, detail: 'a: no enforceAppCheck: true' },
      { file: 'functions/src/member.ts', line: 2, detail: 'b: no enforceAppCheck: true' },
      { file: 'functions/src/member.ts', line: 3, detail: 'c: no enforceAppCheck: true' },
      { file: 'functions/src/member.ts', line: 4, detail: 'd: the onCall options are not an object literal, so the posture cannot be read' },
      { file: 'functions/src/member.ts', line: 5, detail: 'e: no enforceAppCheck: true' },
      { file: 'functions/src/payments/pay.ts', line: 1, detail: 'pay: no consumeAppCheckToken: true' },
      { file: '(consumptionExempt)', detail: 'stale exemption: no callable is named adminLiveScore' },
    ]);
  });

  it('FLAGS an exemption whose callable now consumes or need not, and a consuming folder with no callable', async () => {
    repo = backendRepo({
      'functions/src/admin/tool.ts':
        'export const adminLiveScore = onCall({ enforceAppCheck: true, consumeAppCheckToken: true }, async (request) => { await assertAuth(request, { admin: {} }); });',
      'functions/src/member.ts': 'export const member = onCall({ enforceAppCheck: true }, handler);',
    });
    const [guard] = appCheckGuard.build({
      ...facts,
      consumptionExempt: [...facts.consumptionExempt, { callable: 'member', why: 'x' }],
    });
    expect(await repo.run(guard!)).toEqual([
      { file: 'functions/src/admin/tool.ts', line: 1, detail: 'stale exemption: adminLiveScore now consumes its token' },
      { file: 'functions/src/member.ts', line: 1, detail: 'stale exemption: member is not a consuming callable' },
      { file: 'functions/src/payments', detail: 'stale consuming folder: it holds no callable' },
    ]);
  });

  it('refuses facts without the admin auth call', () => {
    expect(appCheckGuard.factProblems({ ...facts, adminAuth: { call: '', option: 'admin' } })).toEqual(['adminAuth.call is missing']);
  });
});
