// The single-owner client guards: the app config reader, browser storage, upload listeners, media
// rendering, MIME classification, motion, date-of-birth derivation, and partial package mocks.

import { describe, expect, it } from 'vitest';
import {
  appConfigReaderGuard,
  browserStorageGuard,
  dateOfBirthGuard,
  effectiveMotionGuard,
  mediaRendererGuard,
  mimePrefixGuard,
  partialMockGuard,
  uploadListenerGuard,
  type MediaRendererFacts,
} from '../../src/modules/frontend-actions/client.js';
import { findingsOf, samplesProve } from './run.js';

const lines = (...l: string[]) => l.join('\n');

// ---------------------------------------------------------------------------------------------
describe('app config read only by its provider', () => {
  const facts = {
    provider: 'src/components/app-config-provider.tsx',
    docSpellings: ['PATHS.appConfig', 'SPECIAL_DOCS.APP_CONFIG'],
    collectionName: '_appConfig',
    serverPaths: [{ path: 'src/server', why: 'route handlers read it as the backend' }],
  };
  const base = {
    'src/components/app-config-provider.tsx': 'const ref = doc(db, ...PATHS.appConfig());',
    'src/server/config.ts': "const ref = db.doc('_appConfig/app'); const s = SPECIAL_DOCS.APP_CONFIG;",
  };

  it('passes the provider, server code, comments, and prose', async () => {
    expect(await findingsOf(appConfigReaderGuard, facts, { ...base, 'src/a.ts': "// PATHS.appConfig()\nconst hint = 'the field on _appConfig/app is invalid';" })).toEqual([]);
  });

  it('flags every spelling of the document in a second client file', async () => {
    expect(
      await findingsOf(appConfigReaderGuard, facts, {
        ...base,
        'src/a.ts': "doc(db, PATHS . appConfig());\ndoc(db, X, SPECIAL_DOCS.APP_CONFIG);\ndoc(db, '_appConfig', 'app');",
      }),
    ).toEqual([
      'src/a.ts:1 outside its owner: PATHS . appConfig',
      'src/a.ts:2 outside its owner: SPECIAL_DOCS.APP_CONFIG',
      "src/a.ts:3 outside its owner: '_appConfig'",
    ]);
  });

  it('flags a provider that no longer names the document, and a server path that is gone', async () => {
    expect(await findingsOf(appConfigReaderGuard, facts, { 'src/components/app-config-provider.tsx': 'export {};' })).toEqual([
      'src/components/app-config-provider.tsx stale owner: the pattern no longer appears in it (or it is outside the scope)',
      'src/server stale server path: it no longer exists',
    ]);
  });

  it('proves its samples', () => samplesProve(appConfigReaderGuard, facts));

  it('refuses a server path with no why', () => {
    expect(appConfigReaderGuard.factProblems({ ...facts, serverPaths: [{ path: 'src/server', why: '' }] })).toEqual(['serverPaths entry src/server carries no why']);
  });
});

// ---------------------------------------------------------------------------------------------
describe('browser storage through the guarded helper', () => {
  const facts = { helper: 'readStoredValue / writeStoredValue', allowlist: [] };

  it('passes the helper, prose, and a comment', async () => {
    expect(await findingsOf(browserStorageGuard, facts, { 'src/a.ts': "readStoredValue(KEY, 'session');\nconst s = `stored in localStorage: ${v}`;\n// localStorage.getItem(K)" })).toEqual([]);
  });

  it('flags a member access and an index access on either storage', async () => {
    expect(await findingsOf(browserStorageGuard, facts, { 'src/a.ts': "window.localStorage.getItem(K);\nsessionStorage['k'] = v;" })).toEqual([
      'src/a.ts:1 not on the reviewed list: localStorage.',
      'src/a.ts:2 not on the reviewed list: sessionStorage[',
    ]);
  });

  it('proves its samples', () => samplesProve(browserStorageGuard, facts));

  it('refuses a missing helper', () => {
    expect(browserStorageGuard.factProblems({ helper: '', allowlist: [] })).toEqual(['helper is missing']);
  });
});

// ---------------------------------------------------------------------------------------------
describe('no per-component upload listeners', () => {
  const facts = { collectionName: 'pendingUploads', collectionSpellings: ['COLLECTIONS.PENDING_UPLOADS'], subscriber: 'the tray subscriber' };

  it('passes a one-shot read of the collection and a listener on another collection', async () => {
    expect(
      await findingsOf(uploadListenerGuard, facts, {
        'src/a.ts': "getDoc(doc(db, 'pendingUploads', id));",
        'src/b.ts': "onSnapshot(doc(db, 'things', id), cb);",
      }),
    ).toEqual([]);
  });

  it('flags onSnapshot in a file naming the collection, quoted or through a constant', async () => {
    expect(
      await findingsOf(uploadListenerGuard, facts, {
        'src/a.ts': "const r = doc(db, \"pendingUploads\", id);\nonSnapshot(r, cb);",
        'src/b.ts': 'import { onSnapshot } from "firebase/firestore";\nconst r = doc(db, COLLECTIONS.PENDING_UPLOADS, id);',
      }),
    ).toEqual(['src/a.ts:2 not on the reviewed list: onSnapshot', 'src/b.ts:1 not on the reviewed list: onSnapshot']);
  });

  it('proves its samples', () => samplesProve(uploadListenerGuard, facts));

  it('refuses a missing collection name', () => {
    expect(uploadListenerGuard.factProblems({ ...facts, collectionName: '' })).toEqual(['collectionName is missing']);
  });
});

// ---------------------------------------------------------------------------------------------
describe('media renderer owners', () => {
  const facts: MediaRendererFacts = {
    renderers: [
      { owner: 'src/components/picture.tsx', module: '@kit/media-viewer', imports: 'all' },
      { owner: 'src/components/profile-picture.tsx', module: '@kit/ui', imports: ['Avatar', 'AvatarImage'] },
    ],
    rawImageAllowlist: [{ path: 'src/components/og-image.tsx', why: 'renders a social card image, not a stored picture' }],
  };
  const base = {
    'src/components/picture.tsx': "import { MediaPreview } from '@kit/media-viewer/react';",
    'src/components/profile-picture.tsx': "import { Avatar, Button } from '@kit/ui/react';",
    'src/components/og-image.tsx': '<img src={card} alt="" />',
  };

  it('passes the owners, other names from a shared module, an icon named Image, and prose', async () => {
    const ok = "import { Button } from '@kit/ui/react';\nimport { Image } from 'lucide-react';\n<Image className=\"icon\" />\n// never an <img>";
    expect(await findingsOf(mediaRendererGuard, facts, { ...base, 'src/components/probe.tsx': ok })).toEqual([]);
  });

  it('flags a raw image, next/image, a background image, and a second caller of either renderer', async () => {
    const bad = lines(
      "import Image from 'next/image';",
      "import type { MediaProps } from '@kit/media-viewer';",
      "import { AvatarImage } from '@kit/ui/react';",
      '<img src={url} alt="" />',
      '<div style={{ backgroundImage: `url(${url})` }} />',
    );
    expect(await findingsOf(mediaRendererGuard, facts, { ...base, 'src/components/probe.tsx': bad })).toEqual([
      "src/components/probe.tsx:1 not on the reviewed list: from 'next/image'",
      'src/components/probe.tsx:4 not on the reviewed list: <img',
      'src/components/probe.tsx:5 not on the reviewed list: backgroundImage:',
      'src/components/probe.tsx:2 outside its renderer owner src/components/picture.tsx: imports from @kit/media-viewer',
      'src/components/probe.tsx:3 outside its renderer owner src/components/profile-picture.tsx: imports AvatarImage from @kit/ui/react',
    ]);
  });

  it('flags an owner that no longer imports what it wraps', async () => {
    expect(await findingsOf(mediaRendererGuard, facts, { ...base, 'src/components/profile-picture.tsx': "import { Button } from '@kit/ui/react';" })).toEqual([
      'src/components/profile-picture.tsx stale owner: it no longer imports from @kit/ui',
    ]);
  });

  it('proves its samples', () => samplesProve(mediaRendererGuard, facts));

  it('refuses a renderer with neither a name list nor all', () => {
    expect(mediaRendererGuard.factProblems({ ...facts, renderers: [{ owner: 'a.tsx', module: 'm', imports: [] }] })).toEqual([
      "renderer a.tsx's imports (or 'all') is empty",
    ]);
  });
});

// ---------------------------------------------------------------------------------------------
describe('no MIME-prefix media classification', () => {
  it('passes a full type and a comment', async () => {
    expect(await findingsOf(mimePrefixGuard, {}, { 'src/a.ts': "// startsWith('image/')\nconst f = new File([b], 'x.jpg', { type: 'image/jpeg' });" })).toEqual([]);
  });

  it('flags a prefix literal, an anchored regex, a split read, and a template prefix', async () => {
    const bad = lines("const a = t.startsWith('video/');", 'const b = /^audio\\//.test(t);', "const c = t.split('/')[0];", 'const e = t.includes(`image/`);');
    expect(await findingsOf(mimePrefixGuard, {}, { 'src/a.ts': bad })).toEqual([
      "src/a.ts:1 not on the reviewed list: 'video/'",
      'src/a.ts:2 not on the reviewed list: /^audio\\//',
      "src/a.ts:3 not on the reviewed list: split('/')[0]",
      "src/a.ts:4 not on the reviewed list: 'image/'",
    ]);
  });

  it('proves its samples', () => samplesProve(mimePrefixGuard, {}));

  it('refuses facts it does not take', () => {
    expect(mimePrefixGuard.factProblems({ owner: 'x' } as never)).toEqual(['unknown facts: owner']);
  });
});

// ---------------------------------------------------------------------------------------------
describe('one effective-motion source', () => {
  const facts = { store: 'src/shared/reduced-motion.ts' };
  const store = { 'src/shared/reduced-motion.ts': "const q = window.matchMedia('(prefers-reduced-motion: reduce)');" };

  it('passes the store and other media queries', async () => {
    expect(await findingsOf(effectiveMotionGuard, facts, { ...store, 'src/a.ts': "window.matchMedia('(min-width: 768px)');" })).toEqual([]);
  });

  it('passes a store that builds on a package store and holds no media query itself', async () => {
    expect(await findingsOf(effectiveMotionGuard, facts, { 'src/shared/reduced-motion.ts': "import { createStore } from '@kit/theme';" })).toEqual([]);
  });

  it('flags a direct reduced-motion check outside the store, and a store that is gone', async () => {
    expect(await findingsOf(effectiveMotionGuard, facts, { ...store, 'src/a.ts': "const r = matchMedia('(prefers-reduced-motion: reduce)').matches;" })).toEqual([
      "src/a.ts:1 not on the reviewed list: matchMedia('(prefers-reduced-motion",
    ]);
    expect(await findingsOf(effectiveMotionGuard, facts, {})).toEqual(['src/shared/reduced-motion.ts the motion store no longer exists']);
  });

  it('proves its samples', () => samplesProve(effectiveMotionGuard, facts));

  it('refuses a missing store', () => {
    expect(effectiveMotionGuard.factProblems({ store: '' })).toEqual(['store is missing']);
  });
});

// ---------------------------------------------------------------------------------------------
describe('one date-of-birth derivation owner', () => {
  const core = {
    'node_modules/@kit/core/dist/index.js': 'export * from "./age.js";',
    'node_modules/@kit/core/dist/age.js': 'export function deriveAge(asOf, dob) { let years = asOf.getUTCFullYear() - dob.year; return years; }',
  };
  const roots = { coreDist: { path: 'node_modules/@kit/core/dist', anchor: 'node_modules/@kit/core/dist/index.js' } };
  const facts = { owner: 'node_modules/@kit/core/dist/age.js' };

  it("passes the owner in the core package's build and a plain year read", async () => {
    expect(await findingsOf(dateOfBirthGuard, facts, { ...core, 'src/a.ts': 'const y = now.getUTCFullYear();' }, roots)).toEqual([]);
  });

  it('flags whole-year math in the app and in Functions', async () => {
    expect(
      await findingsOf(
        dateOfBirthGuard,
        facts,
        { ...core, 'src/a.ts': 'const age = now.getFullYear() - dob.getFullYear();', 'functions/src/b.ts': 'const y = d.getUTCFullYear() - 18;' },
        roots,
      ),
    ).toEqual(['functions/src/b.ts:1 outside its owner: .getUTCFullYear() -', 'src/a.ts:1 outside its owner: .getFullYear() -']);
  });

  it('flags an owner that no longer derives the age', async () => {
    expect(await findingsOf(dateOfBirthGuard, facts, { ...core, 'node_modules/@kit/core/dist/age.js': 'export const x = 1;' }, roots)).toEqual([
      'node_modules/@kit/core/dist/age.js stale owner: the pattern no longer appears in it (or it is outside the scope)',
    ]);
  });

  it('proves its samples', () => samplesProve(dateOfBirthGuard, facts));

  it('refuses a missing owner', () => {
    expect(dateOfBirthGuard.factProblems({ owner: '' })).toEqual(['owner is missing']);
  });
});

// ---------------------------------------------------------------------------------------------
describe('partial mocks keep a pure root', () => {
  const facts = { packageRoots: [{ module: '@kit/helpers', why: 'the error path imports its classifiers' }, { module: 'icons', why: 'package components render from it' }] };
  const spread = lines(
    "vi.mock('@kit/helpers', async (importOriginal) => ({ ...(await importOriginal()), toMillis: vi.fn() }));",
    "vi.mock('icons', async (importOriginal) => {",
    '  const actual = await importOriginal();',
    '  return { ...actual, Info: () => null };',
    '});',
  );

  it('passes both spread shapes and a mock of a subpath', async () => {
    expect(
      await findingsOf(partialMockGuard, facts, { 'src/__tests__/a.test.ts': spread, 'src/__tests__/b.test.ts': "vi.mock('@kit/helpers/client', () => ({ call: vi.fn() }));" }),
    ).toEqual([]);
  });

  it('flags a full-module factory and one that only names importOriginal, in app and Functions tests', async () => {
    expect(
      await findingsOf(partialMockGuard, facts, {
        'src/__tests__/a.test.ts': spread,
        'src/test/setup.ts': "vi.doMock('icons', async (importOriginal) => ({ Info: () => null }));",
        'functions/src/run.test.ts': "vi.mock('@kit/helpers', () => ({ a: vi.fn(() => (1)) }));\nconst x = 1;",
      }),
    ).toEqual(['functions/src/run.test.ts:1 a full-module mock of @kit/helpers', 'src/test/setup.ts:1 a full-module mock of icons']);
  });

  it('flags a listed root nothing mocks any more', async () => {
    expect(await findingsOf(partialMockGuard, facts, { 'src/__tests__/a.test.ts': spread.split('\n')[0] })).toEqual(['(packageRoots) stale entry: nothing mocks icons']);
  });

  it('refuses a root with no why', () => {
    expect(partialMockGuard.factProblems({ packageRoots: [{ module: 'icons', why: '' }] })).toEqual(["package root icons's why is missing"]);
  });
});
