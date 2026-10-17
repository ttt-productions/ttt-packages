// The auth guards: one client auth boundary, banned auth calls, auth failures that reach
// monitoring, one sign-out liveness owner, and editors no permission read can unmount.

import { describe, expect, it } from 'vitest';
import {
  authFailureCaptureGuard,
  bannedAuthCallGuard,
  clientAuthBoundaryGuard,
  editorPermissionGateGuard,
  signOutLivenessGuard,
  type ClientAuthBoundaryFacts,
} from '../../src/modules/frontend-actions/auth.js';
import { findingsOf } from './run.js';

const lines = (...l: string[]) => l.join('\n');

// ---------------------------------------------------------------------------------------------
describe('client auth boundary', () => {
  const facts: ClientAuthBoundaryFacts = {
    boundaryModules: [
      { path: 'src/context/auth-context.tsx', why: 'mounts the one provider' },
      { path: 'src/lib/auth-config.ts', why: 'configures the provider' },
      { path: 'src/hooks/use-auth.ts', why: 'the one accessor' },
    ],
    accessor: { file: 'src/hooks/use-auth.ts', name: 'useAuth' },
    derivationSymbols: ['useAuthState', 'parseClaims', 'onAuthStateChanged', 'onIdTokenChanged'],
    authSourceModules: ['firebase/auth', '@kit/auth'],
    authContextVocabulary: ['claimsLoading', 'isAuthenticated'],
  };
  const base = {
    'src/context/auth-context.tsx': "import { AuthProvider } from '@kit/auth/react';\nconst C = createContext<{ isAuthenticated: boolean }>(null);",
    'src/lib/auth-config.ts': "import { parseClaims } from '@kit/auth';",
    'src/hooks/use-auth.ts': "import { useAuth as useAuthCore } from '@kit/auth/react';\nexport function useAuth() { return useAuthCore(); }",
  };
  const run = (files: Record<string, string>, f = facts) => findingsOf(clientAuthBoundaryGuard, f, { ...base, ...files });

  it('passes the boundary modules, accessor readers, a type-only import, other contexts, prose, a non-auth redirect, and an in-place gate', async () => {
    const files = {
      'src/components/nav.tsx': "import { useAuth } from '@/hooks/use-auth';\nconst { claims } = useAuth();",
      'src/components/badge.tsx': "import type { parseClaims } from '@kit/auth';\n// never call useAuthState() here",
      'src/context/stats-context.tsx': 'const S = createContext<Stats | undefined>(undefined);',
      'src/app/league/page.tsx': lines('useEffect(() => {', "  if (!leagueId) router.replace('/leagues');", '}, [leagueId]);'),
      'src/app/admin/layout.tsx': lines('const { claims, loading } = useAuth();', 'if (!claims.admin) return <Denied />;'),
    };
    expect(await run(files)).toEqual([]);
  });

  it('flags a named, aliased, multi-line, namespace, and bare derivation outside the boundary', async () => {
    expect(
      await run({
        'src/a.tsx': "import { useAuthState } from '@kit/auth/react';",
        'src/b.ts': "import {\n  parseClaims as read,\n} from '@kit/auth';",
        'src/c.ts': "import * as core from '@kit/auth/react';\nconst watch = core.useAuthState;",
        'src/d.ts': 'onAuthStateChanged(auth, (u) => set(u));',
      }),
    ).toEqual([
      'src/a.tsx:1 imports useAuthState',
      'src/b.ts:1 imports parseClaims',
      'src/c.ts:2 reaches core.useAuthState',
      'src/d.ts:1 calls onAuthStateChanged(',
    ]);
  });

  it('flags a derivation called as a member of an auth instance or of a call that returns one', async () => {
    expect(
      await run({
        'src/e.ts': 'const stop = auth.onAuthStateChanged((u) => set(u));',
        'src/f.ts': 'const w = 1;\ngetAuth().onIdTokenChanged(cb);',
        'src/g.ts': "import * as core from '@kit/auth/react';\nconst s = core.useAuthState();",
      }),
    ).toEqual([
      'src/e.ts:1 calls onAuthStateChanged(',
      'src/f.ts:2 calls onIdTokenChanged(',
      'src/g.ts:2 reaches core.useAuthState',
    ]);
  });

  it('flags a second accessor export, a re-exported accessor, and a second auth context', async () => {
    expect(
      await run({
        'src/hooks/use-session.ts': 'export function useAuth() { return useContext(S); }',
        'src/hooks/index.ts': "export { useAuth } from './use-session';",
        'src/context/session.tsx': 'const S = createContext<{ claimsLoading: boolean }>(null);',
      }),
    ).toEqual([
      'src/context/session.tsx:1 a second auth context',
      'src/hooks/index.ts:1 a second export of useAuth',
      'src/hooks/use-session.ts:1 a second export of useAuth',
    ]);
  });

  it('leaves an effect that sends a signed-out visitor to sign in alone: where a visitor is sent is business', async () => {
    expect(
      await run({
        'src/app/a.tsx': lines('useEffect(() => {', "  if (!user) navigate('/login', { replace: true });", '}, [user]);'),
        'src/app/b.tsx': lines('useEffect(() => {', "  if (!isAuthenticated) appRouter.push('/login');", '}, [isAuthenticated]);'),
      }),
    ).toEqual([]);
  });

  it('flags a boundary module that is gone and an accessor that no longer exports its name', async () => {
    expect(await findingsOf(clientAuthBoundaryGuard, facts, { 'src/hooks/use-auth.ts': 'export const other = 1;' })).toEqual([
      'src/context/auth-context.tsx stale boundary module: it no longer exists',
      'src/lib/auth-config.ts stale boundary module: it no longer exists',
      'src/hooks/use-auth.ts the accessor no longer exports useAuth',
    ]);
  });

  it('refuses an accessor outside the boundary modules and an empty vocabulary', () => {
    expect(clientAuthBoundaryGuard.factProblems({ ...facts, accessor: { file: 'src/x.ts', name: 'useAuth' }, authContextVocabulary: [] })).toEqual([
      'the accessor src/x.ts is not one of the boundaryModules',
      'authContextVocabulary is empty',
    ]);
  });
});

// ---------------------------------------------------------------------------------------------
describe('banned auth calls', () => {
  const facts = {
    surfaces: ['src/components/auth', 'src/hooks'],
    banned: [{ name: 'deleteUser', why: 'registration never deletes the account it created' }],
    anchor: 'src/components/auth/register-dialog.tsx',
  };
  const base = { 'src/components/auth/register-dialog.tsx': '// deleteUser is never called here\nexport const R = 1;' };

  it('passes a surface that only explains the ban, and a non-surface file that names the call', async () => {
    expect(await findingsOf(bannedAuthCallGuard, facts, { ...base, 'src/settings/delete.ts': "import { deleteUser } from 'firebase/auth';" })).toEqual([]);
  });

  it('flags an import and a call in an auth surface', async () => {
    expect(
      await findingsOf(bannedAuthCallGuard, facts, { ...base, 'src/hooks/use-register.ts': "import { deleteUser } from 'firebase/auth';\nawait deleteUser(user);" }),
    ).toEqual([
      'src/hooks/use-register.ts:1 names deleteUser: registration never deletes the account it created',
      'src/hooks/use-register.ts:2 names deleteUser: registration never deletes the account it created',
    ]);
  });

  it('flags an anchor the scan no longer reaches', async () => {
    expect(await findingsOf(bannedAuthCallGuard, facts, {})).toEqual([
      'src/components/auth/register-dialog.tsx the anchor surface was not reached (gone, or outside the surfaces)',
    ]);
  });

  it('refuses a banned call with no why and an anchor outside the surfaces', () => {
    expect(bannedAuthCallGuard.factProblems({ ...facts, banned: [{ name: 'deleteUser', why: '' }], anchor: 'src/app/x.tsx' })).toEqual([
      "banned call deleteUser's why is missing",
      'the anchor src/app/x.tsx is not inside any surface',
    ]);
  });
});

// ---------------------------------------------------------------------------------------------
describe('auth failure capture', () => {
  const facts = {
    reporter: 'reportAuthFailure',
    reportedElsewhere: [
      { path: 'src/auth/verify-action.tsx', why: 'runs inside the one-shot hook, which reports', reportedBy: 'src/auth/use-one-shot.ts' },
      { path: 'src/hooks/use-forced-sign-out.ts', why: 'rethrows; its one caller catches and reports', reportedBy: 'src/auth/sign-out-button.tsx' },
    ],
  };
  const base = {
    'src/auth/sign-in.tsx': "import { signInWithEmailAndPassword } from 'firebase/auth';\ntry { await signInWithEmailAndPassword(a, e, p); } catch (e) { reportAuthFailure(e); }",
    'src/auth/verify-action.tsx': "import { applyActionCode } from 'firebase/auth';\nexport const run = () => applyActionCode(a, c);",
    'src/auth/use-one-shot.ts': 'export function useOneShot(p) { p.catch((e) => reportAuthFailure(e)); }',
    'src/hooks/use-forced-sign-out.ts': "import { signOut, type User } from 'firebase/auth';\nexport const out = () => signOut(a);",
    'src/auth/sign-out-button.tsx': "import { out } from '../hooks/use-forced-sign-out';\nexport const click = () => out().catch((e) => reportAuthFailure(e));",
    'src/types.ts': "import type { User } from 'firebase/auth';",
  };

  it('passes a reporting caller, the reviewed entries, and a type-only import', async () => {
    expect(await findingsOf(authFailureCaptureGuard, facts, base)).toEqual([]);
  });

  it('flags a caller that never reports (a comment naming the reporter does not count)', async () => {
    expect(
      await findingsOf(authFailureCaptureGuard, facts, {
        ...base,
        'src/auth/reset.tsx': "import { sendPasswordResetEmail as send } from 'firebase/auth';\n// reportAuthFailure(e)\nawait send(a, e);",
      }),
    ).toEqual(['src/auth/reset.tsx calls sendPasswordResetEmail and never reports a failure']);
  });

  it('flags a stale entry: no failing call, a self-reporting one, and a reporter that stopped reporting', async () => {
    expect(
      await findingsOf(authFailureCaptureGuard, facts, {
        ...base,
        'src/auth/verify-action.tsx': 'export const run = () => 1;',
        'src/auth/use-one-shot.ts': 'export function useOneShot(p) { return p; }',
        'src/hooks/use-forced-sign-out.ts': "import { signOut } from 'firebase/auth';\nexport const out = () => signOut(a).catch(reportAuthFailure);\nreportAuthFailure(x);",
      }),
    ).toEqual([
      'src/auth/verify-action.tsx stale entry: it no longer calls a failing auth operation',
      'src/auth/use-one-shot.ts the reporter named for src/auth/verify-action.tsx no longer reports',
      'src/hooks/use-forced-sign-out.ts stale entry: it reports its own failures now',
    ]);
  });

  it('flags a scan that finds no auth surface', async () => {
    expect(await findingsOf(authFailureCaptureGuard, { reporter: 'reportAuthFailure', reportedElsewhere: [] }, {})).toEqual([
      '(app) no source imports a failing Firebase Auth operation — the scan found no auth surface',
    ]);
  });

  it('refuses a missing reporter and an entry that names no reporting file', () => {
    expect(
      authFailureCaptureGuard.factProblems({
        reporter: '',
        reportedElsewhere: [
          { path: 'a.ts', why: 'w', reportedBy: '' },
          { path: 'b.ts', why: 'w', reportedBy: null as never },
        ],
      }),
    ).toEqual([
      'reporter is missing',
      'reportedElsewhere entry a.ts names no reportedBy file (the file that reports its failures)',
      'reportedElsewhere entry b.ts names no reportedBy file (the file that reports its failures)',
    ]);
  });

  it('flags a reviewed entry whose reporting file is gone', async () => {
    const { 'src/auth/sign-out-button.tsx': _gone, ...rest } = base;
    expect(await findingsOf(authFailureCaptureGuard, facts, rest)).toEqual([
      'src/auth/sign-out-button.tsx the reporter named for src/hooks/use-forced-sign-out.ts no longer exists',
    ]);
  });
});

// ---------------------------------------------------------------------------------------------
describe('sign-out liveness owner', () => {
  const facts = { owner: 'src/lib/still-signed-in.ts', ownerExports: ['assertStillSignedIn', 'isStillSignedIn'], authAccessor: 'getAuthInstance' };
  const base = {
    'src/lib/still-signed-in.ts': 'export function assertStillSignedIn() {}\nexport const isStillSignedIn = () => !!getAuthInstance()?.currentUser;\nif (!getAuthInstance().currentUser) {}',
  };

  it('passes the owner and a non-guard read of the current user', async () => {
    expect(await findingsOf(signOutLivenessGuard, facts, { ...base, 'src/a.ts': 'const u = getAuthInstance()?.currentUser;' })).toEqual([]);
  });

  it('flags a re-declared liveness check and a hand-rolled negated skip guard', async () => {
    expect(
      await findingsOf(signOutLivenessGuard, facts, {
        ...base,
        'src/a.ts': 'const isStillSignedIn = () => true;\nfunction assertStillSignedIn() {}',
        'src/b.ts': 'if (!getAuthInstance()?.currentUser) return;',
      }),
    ).toEqual(['src/a.ts:1 re-declares isStillSignedIn', 'src/a.ts:2 re-declares assertStillSignedIn', 'src/b.ts:1 hand-rolls a negated currentUser skip guard']);
  });

  it('flags an owner that no longer declares an export', async () => {
    expect(await findingsOf(signOutLivenessGuard, facts, { 'src/lib/still-signed-in.ts': 'export function assertStillSignedIn() {}' })).toEqual([
      'src/lib/still-signed-in.ts the owner no longer declares isStillSignedIn',
    ]);
  });

  it('refuses no owner exports', () => {
    expect(signOutLivenessGuard.factProblems({ ...facts, ownerExports: [] })).toEqual(['ownerExports is empty']);
  });

  it('refuses an owner export listed twice', () => {
    expect(signOutLivenessGuard.factProblems({ ...facts, ownerExports: ['isStillSignedIn', 'isStillSignedIn'] })).toEqual([
      'ownerExports lists isStillSignedIn twice',
    ]);
  });
});

// ---------------------------------------------------------------------------------------------
describe('editor never under a permission gate', () => {
  const facts = { editorMarker: 'useUnsavedGuard', editorElement: 'Dialog', permissionNamePrefix: 'can', permissionCalls: ['permissionAllows'] };

  it('passes an editor whose trigger alone is gated', async () => {
    const ok = lines('function X() {', '  useUnsavedGuard(form);', '  return <>{canEdit && <Button />}<Dialog open={o}><Content /></Dialog></>;', '}');
    expect(await findingsOf(editorPermissionGateGuard, facts, { 'src/editor.tsx': ok })).toEqual([]);
  });

  it('flags an editor under a can-named read and under a permission call', async () => {
    const bad = lines(
      'function X() {',
      '  useUnsavedGuard(form);',
      '  return <>',
      '    {canModifyDetails && (<Dialog open={o}><Content /></Dialog>)}',
      "    {permissionAllows(p, 'edit') && <Dialog open={o} />}",
      '  </>;',
      '}',
    );
    expect(await findingsOf(editorPermissionGateGuard, facts, { 'src/editor.tsx': bad })).toEqual([
      'src/editor.tsx:4 <Dialog> mounted under a permission gate',
      'src/editor.tsx:5 <Dialog> mounted under a permission gate',
    ]);
  });

  it('leaves a gated dialog in a component holding no typed input, and flags a scan that finds no editor', async () => {
    expect(await findingsOf(editorPermissionGateGuard, facts, { 'src/viewer.tsx': '<>{canSee && <Dialog />}</>' })).toEqual([
      '(app) no component calls useUnsavedGuard — the scan found no editor to check',
    ]);
  });

  it('refuses a missing editor element', () => {
    expect(editorPermissionGateGuard.factProblems({ ...facts, editorElement: '' })).toEqual(['editorElement is missing']);
  });
});
