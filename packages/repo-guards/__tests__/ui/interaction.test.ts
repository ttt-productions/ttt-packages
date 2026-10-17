// The interaction guards: navigation through the helper, pending through the shared primitives,
// one show-more control, one pending-name seat, and the root layout's provider order.

import { describe, expect, it } from 'vitest';
import {
  layoutOrderGuard,
  loadingFeedbackGuard,
  navigationGuard,
  pendingNameSeatGuard,
  showMoreGuard,
  type LayoutOrderFacts,
  type LoadingFeedbackFacts,
  type NavigationFacts,
} from '../../src/modules/ui/interaction.js';
import { allFindings } from './helpers.js';

const HELPER = 'src/nav/navigation.tsx';

describe('every in-app navigation runs through the navigation helper', () => {
  const facts: NavigationFacts = { helper: HELPER, helperExports: ['AppLink', 'useAppNavigation'], guardedNavigationOwner: HELPER };
  const helper = [
    "import Link from 'next/link';",
    "import { useRouter } from 'next/navigation';",
    "import { useGuardedNavigation } from '@ttt-productions/upload-ui/react/guard';",
    'export function useAppNavigation() { const router = useRouter(); return (h: string) => router.push(h); }',
    'export const AppLink = (p: object) => <Link {...p} />;',
    'export const hardNavigate = (url: string) => window.location.assign(url);',
  ].join('\n');
  const clean = {
    [HELPER]: helper,
    'src/ui/page.tsx': [
      "import { usePathname, useSearchParams } from 'next/navigation';",
      "import { AppLink, useAppNavigation } from '@/nav/navigation';",
      'const here = window.location.pathname; if (window.location.href === target) {}',
      "window.history.replaceState({}, '', url);",
      '// router.push( and next/link named in a comment only',
    ].join('\n'),
  };

  it('passes the helper and the navigation reads around it', async () => {
    expect(await allFindings(navigationGuard, facts, clean)).toEqual([]);
  });

  it('flags a raw link, a router import or call, a location navigation, and a guarded-navigation import outside the helper', async () => {
    const findings = await allFindings(navigationGuard, facts, {
      ...clean,
      'src/ui/probe.tsx': [
        "import Link from 'next/link';",
        "import { usePathname, useRouter } from 'next/navigation';",
        'router.push(`/league/${id}`); router.back();',
        "window.location.href = '/admin';",
        'window.location = url;',
        'window.location.replace(url); location.reload();',
        "import { GuardedLink } from '@ttt-productions/upload-ui/react/guard';",
      ].join('\n'),
    });
    expect(findings).toEqual([
      'src/ui/probe.tsx:1 outside its owner: import of next/link',
      "src/ui/probe.tsx:2 outside its owner: import { usePathname, useRouter } from 'next/navigation'",
      'src/ui/probe.tsx:3 outside its owner: router.push(',
      'src/ui/probe.tsx:3 outside its owner: router.back(',
      'src/ui/probe.tsx:4 outside its owner: window.location.href =',
      'src/ui/probe.tsx:5 outside its owner: window.location =',
      'src/ui/probe.tsx:6 outside its owner: location.replace(',
      'src/ui/probe.tsx:6 outside its owner: location.reload(',
      "src/ui/probe.tsx:7 outside its owner: import { GuardedLink } from '@ttt-productions/upload-ui/react/guard'",
    ]);
  });

  it('flags a helper that stopped owning a navigation or stopped exporting what the app navigates with', async () => {
    const findings = await allFindings(navigationGuard, facts, { ...clean, [HELPER]: "import Link from 'next/link';\nexport const AppLink = (p: object) => <Link {...p} />;" });
    expect(findings).toEqual([
      'src/nav/navigation.tsx stale owner: the pattern no longer appears in it (or it is outside the scope)',
      'src/nav/navigation.tsx stale owner: the pattern no longer appears in it (or it is outside the scope)',
      'src/nav/navigation.tsx stale owner: the pattern no longer appears in it (or it is outside the scope)',
      'src/nav/navigation.tsx no longer exports useAppNavigation',
    ]);
  });

  it('bans the guarded navigation everywhere when the app has no upload guard', async () => {
    expect(await allFindings(navigationGuard, { ...facts, guardedNavigationOwner: null }, clean)).toEqual([
      "src/nav/navigation.tsx:3 not on the reviewed list: import { useGuardedNavigation } from '@ttt-productions/upload-ui/react/guard'",
    ]);
  });

  it('refuses facts that name nothing the helper exports', () => {
    expect(navigationGuard.factProblems({ ...facts, helperExports: [] })).toEqual(['helperExports is empty']);
  });
});

describe('pending feedback comes from the shared primitives', () => {
  const WRAPPER = 'src/ui/page-pull-to-refresh.tsx';
  const READER = 'src/admin/diagnostics.tsx';
  const facts: LoadingFeedbackFacts = {
    pullToRefreshWrapper: WRAPPER,
    hookWideFlags: [{ hook: 'useFunctions', flag: 'isLoading', readers: [{ path: READER, why: 'a diagnostics view kept as it is' }] }],
  };
  const clean = {
    [WRAPPER]: "import { PullToRefreshContainer } from '@ttt-productions/mobile-core/react';",
    [READER]: 'const { callFunction, isLoading } = useFunctions();',
    'src/ui/save.tsx': "import { RefreshCw } from 'lucide-react';\nconst { callFunction } = useFunctions(); const { isLoading } = useQuery(q);\nexport const s = <Spinner size=\"xs\" />;",
    'src/app/styles/a.css': '.a { animation: fade var(--motion-base) var(--motion-ease); }',
  };

  it('passes the shared spinner, the wrapper, and the reviewed reader', async () => {
    expect(await allFindings(loadingFeedbackGuard, facts, clean)).toEqual([]);
  });

  it('flags a spinner icon, a hand-spun class or stylesheet, a direct pull-to-refresh, and an unreviewed hook-wide flag read', async () => {
    const findings = await allFindings(loadingFeedbackGuard, facts, {
      ...clean,
      'src/ui/bad.tsx': [
        "import { Loader2, X } from 'lucide-react';",
        'export const a = <RefreshCw className="icon-xs animate-spin" />;',
        "import { PullToRefreshContainer } from '@ttt-productions/mobile-core/react';",
        'const busy = useFunctions({ x: 1 }).isLoading;',
        'const fns = useFunctions(); const b = fns.isLoading;',
      ].join('\n'),
      'src/app/styles/spin.css': '.a { animation: spin 1s linear infinite; }\n@keyframes spin { to { transform: rotate(360deg); } }',
    });
    expect(findings).toEqual([
      "src/ui/bad.tsx:1 not on the reviewed list: import { Loader2, X } from 'lucide-react'",
      'src/ui/bad.tsx:2 not on the reviewed list: animate-spin',
      'src/app/styles/spin.css:1 not on the reviewed list: animation: spin',
      'src/app/styles/spin.css:2 not on the reviewed list: @keyframes spin',
      "src/ui/bad.tsx:3 outside its owner: import { PullToRefreshContainer } from '@ttt-productions/mobile-core/react'",
      'src/ui/bad.tsx:4 not on the reviewed list: useFunctions({ x: 1 }).isLoading',
      'src/ui/bad.tsx:5 not on the reviewed list: fns.isLoading',
    ]);
  });

  it('flags a reviewed reader that no longer reads the flag, and bans the container when the app has no wrapper', async () => {
    expect(await allFindings(loadingFeedbackGuard, { ...facts, pullToRefreshWrapper: null }, { ...clean, [READER]: 'export {};' })).toEqual([
      "src/ui/page-pull-to-refresh.tsx:1 not on the reviewed list: import { PullToRefreshContainer } from '@ttt-productions/mobile-core/react'",
      'src/admin/diagnostics.tsx stale entry: the file no longer holds the pattern (or is gone, or is outside the scope)',
    ]);
  });

  it('refuses a hook-wide flag reader that carries no why', () => {
    expect(loadingFeedbackGuard.factProblems({ pullToRefreshWrapper: null, hookWideFlags: [{ hook: 'useFunctions', flag: 'isLoading', readers: [{ path: READER, why: '' }] }] })).toEqual([
      'hookWideFlags useFunctions().isLoading readers entry src/admin/diagnostics.tsx carries no why',
    ]);
  });
});

describe('every show-more disclosure renders through the one toggle', () => {
  it('flags text, chevron, and native-details disclosures, and passes the toggle, a combobox, a menu trigger, and a plain toggle', async () => {
    const findings = await allFindings(showMoreGuard, { toggle: 'ShowMoreToggle' }, {
      'src/ui/a.tsx': [
        "export const a = <button type=\"button\" onClick={() => setOpen((p) => !p)} aria-expanded={open}>{open ? 'Show less' : 'Show more'}</button>;",
        'export const b = <Button aria-expanded={open}>Chapters<ChevronRight className="icon-xs" /></Button>;',
        'export const c = <details><summary>Tales</summary></details>;',
      ].join('\n'),
      'src/ui/b.tsx': [
        'export const a = <ShowMoreToggle expanded={open} onExpandedChange={setOpen} openLabel="Show more" closeLabel="Show less" />;',
        'export const b = <button role="combobox" aria-expanded={open}>Pick one<ChevronsUpDown /></button>;',
        'export const c = <Button aria-haspopup="menu" aria-expanded={open}>Show options<ChevronDown /></Button>;',
        'export const d = <Button aria-label="Files" aria-expanded={open}><Folder />Files</Button>;',
      ].join('\n'),
    });
    expect(findings).toEqual([
      'src/ui/a.tsx:1 not on the reviewed list: <button type="button" onClick={() => setOpen((p) => !p)} aria-expanded={open}>',
      'src/ui/a.tsx:2 not on the reviewed list: <Button aria-expanded={open}>',
      'src/ui/a.tsx:3 not on the reviewed list: <details>',
    ]);
  });
});

describe('a loading name holds its place only through the one seat', () => {
  const SEAT = 'src/ui/loading-state.tsx';
  const seat = 'export const PendingNameSeat = () => <span aria-busy="true">…</span>;';

  it('passes the seat and copy that merely ends in an ellipsis', async () => {
    expect(await allFindings(pendingNameSeatGuard, { seat: SEAT }, { [SEAT]: seat, 'src/ui/list.tsx': 'export const l = <p>by <PendingNameSeat /> <span>Loading more…</span></p>;' })).toEqual([]);
  });

  it('flags every hand-written busy or ellipsis-only span outside the seat', async () => {
    const findings = await allFindings(pendingNameSeatGuard, { seat: SEAT }, {
      [SEAT]: seat,
      'src/ui/list.tsx': ['<span className="x" aria-busy>…</span>', '<span>...</span>', "<span className=\"pending\">{'…'}</span>"].map((s, i) => `export const s${i} = ${s};`).join('\n'),
    });
    expect(findings).toEqual([
      'src/ui/list.tsx:1 outside its owner: <span className="x" aria-busy',
      'src/ui/list.tsx:2 outside its owner: <span>...</span>',
      "src/ui/list.tsx:3 outside its owner: <span className=\"pending\">{'…'}</span>",
    ]);
  });
});

describe('the root layout mounts its providers in their declared order', () => {
  const LAYOUT = 'src/app/layout.tsx';
  const facts: LayoutOrderFacts = {
    layoutModule: LAYOUT,
    mountedOnce: ['UploadGuard', 'NavigationProvider'],
    wraps: [
      { outer: 'UploadGuard', inner: 'NavigationProvider' },
      { outer: 'NavigationProvider', inner: 'Shell' },
    ],
    outside: [{ element: 'IdentityWatcher', container: 'Shell' }],
    precedes: [{ first: 'IdentityWatcher', then: 'Shell' }],
  };
  const layout = (body: string) => `export default function RootLayout({ children }) {\n  return (\n${body}\n  );\n}`;
  const clean = layout('<Query><UploadGuard><NavigationProvider>\n<IdentityWatcher />\n<Shell>{children}</Shell>\n</NavigationProvider></UploadGuard></Query>');

  it('passes the declared nesting and order', async () => {
    expect(await allFindings(layoutOrderGuard, facts, { [LAYOUT]: clean })).toEqual([]);
  });

  it('flags a provider outside the one it must sit in, a watcher inside its container, and a second mount', async () => {
    const swapped = layout('<NavigationProvider><UploadGuard>\n<Shell>\n<IdentityWatcher />{children}</Shell>\n</UploadGuard></NavigationProvider>');
    expect(await allFindings(layoutOrderGuard, facts, { [LAYOUT]: swapped })).toEqual([
      'src/app/layout.tsx:3 <UploadGuard> does not wrap <NavigationProvider>',
      'src/app/layout.tsx:5 <IdentityWatcher> sits inside <Shell>',
      'src/app/layout.tsx:5 <IdentityWatcher> does not open before <Shell>',
    ]);
    const twice = layout('<UploadGuard><NavigationProvider>\n<IdentityWatcher />\n<Shell><NavigationProvider />{children}</Shell>\n</NavigationProvider></UploadGuard>');
    expect(await allFindings(layoutOrderGuard, facts, { [LAYOUT]: twice })).toEqual([
      'src/app/layout.tsx <NavigationProvider> is mounted 2 times; it is mounted exactly once',
      'src/app/layout.tsx <NavigationProvider> is mounted 2 times; the order checks need exactly one',
    ]);
  });

  it('refuses facts that declare no order to check', () => {
    expect(layoutOrderGuard.factProblems({ layoutModule: LAYOUT, mountedOnce: [], wraps: [], outside: [], precedes: [] })).toEqual(['declares no order to check']);
  });
});
