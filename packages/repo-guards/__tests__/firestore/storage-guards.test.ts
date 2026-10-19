// The Storage guards: the Storage rules restate the declared upload-origin registry exactly, and a
// stored object's generation and size are read only through the package helpers.

import { afterEach, describe, expect, it } from 'vitest';
import {
  storageObjectMetadataGuard,
  storageUploadOriginGuard,
  uploadOriginProblems,
  type StorageObjectMetadataFacts,
  type StorageUploadOriginFacts,
} from '../../src/modules/firestore/storage-guards.js';
import { createRepoReader } from '../../src/node/reader.js';
import { contextOf } from '../helpers/context.js';
import { tempRepo, type TempRepo } from '../helpers/temp-repo.js';

let repo: TempRepo | undefined;
afterEach(() => repo?.remove());

const MB = 1024 * 1024;
const uploadFacts = (over: Partial<StorageUploadOriginFacts> = {}): StorageUploadOriginFacts => ({
  capFunction: 'uploadMaxBytes',
  originCaps: () => ({ 'league-picture': 10 * MB, 'waiver-signature': 1 * MB }),
  originLists: [
    { function: 'pictureUploadOrigins', origins: () => ['league-picture'] },
    { function: 'signatureUploadOrigins', origins: () => ['waiver-signature'] },
  ],
  contentTypeLanes: [
    { function: 'uploadContentTypeAllowed', expression: "origin in pictureUploadOrigins() && request.resource.contentType.matches('image/.*')" },
  ],
  stagingPath: 'uploads/{origin}/{userId}/{stagingId}',
  ...over,
});

const CANONICAL = [
  'service firebase.storage {',
  '  match /b/{bucket}/o {',
  '    // An origin the registry retired, kept in prose: origin == \'old\' ? 5 * 1024',
  '    match /uploads/{origin}/{userId}/{stagingId} {',
  '      allow create: if request.auth != null && request.resource.size <= uploadMaxBytes(origin);',
  '      allow update, delete: if false;',
  '    }',
  "    function pictureUploadOrigins() { return ['league-picture']; }",
  "    function signatureUploadOrigins() { return ['waiver-signature']; }",
  '    function uploadMaxBytes(origin) {',
  "      return origin == 'league-picture' ? 10 * 1024 * 1024",
  "        : origin == 'waiver-signature' ? 1 * 1024 * 1024",
  '        : 0;',
  '    }',
  '    function uploadContentTypeAllowed(origin) {',
  "      return (origin in pictureUploadOrigins()\n        && request.resource.contentType.matches('image/.*'));",
  '    }',
  '  }',
  '}',
].join('\n');

describe('the Storage rules restate the upload-origin registry exactly', () => {
  it('PASSES rules built from the registry, comments and line breaks included', async () => {
    repo = tempRepo({ 'src/anchor.ts': 'export {};', 'storage.rules': CANONICAL });
    const reader = createRepoReader({ repoRoot: repo.root, roots: { app: { path: 'src', anchor: 'src/anchor.ts' } }, rulesFiles: ['storage.rules'] });
    const [guard] = storageUploadOriginGuard.build(uploadFacts());
    expect(await guard.run(contextOf(reader))).toEqual([]);
  });

  it('reads every Storage rules file the layout lists, and never a Firestore rules file', async () => {
    repo = tempRepo({
      'src/anchor.ts': 'export {};',
      'storage.rules': CANONICAL,
      'media.rules': CANONICAL.replace('allow update, delete: if false;', 'allow update: if false;'),
      'firestore.rules': 'service cloud.firestore { match /databases/{database}/documents { } }',
    });
    const reader = createRepoReader({
      repoRoot: repo.root,
      roots: { app: { path: 'src', anchor: 'src/anchor.ts' } },
      rulesFiles: ['firestore.rules', 'storage.rules', 'media.rules'],
    });
    const [guard] = storageUploadOriginGuard.build(uploadFacts());
    expect(await guard.run(contextOf(reader))).toEqual([
      { file: 'media.rules', detail: 'the staging block does not refuse delete (allow delete: if false)' },
    ]);
  });

  it('FLAGS a drifted cap, an undeclared origin, a missing origin, no zero fallback, a drifted list, a missing lane, and an overwritable staging block', async () => {
    const drifted = [
      'match /uploads/{origin}/{userId}/{stagingId} {',
      '  allow create: if request.auth != null;',
      '  allow update: if false;',
      '  allow delete: if request.auth != null;',
      '}',
      "function pictureUploadOrigins() { return ['league-picture', 'products']; }",
      'function uploadMaxBytes(origin) {',
      "  return origin == 'league-picture' ? 5 * 1024 * 1024",
      "    : origin == 'products' ? 1 * 1024",
      '    : 10;',
      '}',
      "function uploadContentTypeAllowed(origin) { return request.resource.contentType == 'image/png'; }",
    ].join('\n');
    expect(await uploadOriginProblems(drifted, uploadFacts())).toEqual([
      "uploadMaxBytes('league-picture') is 5242880, the core declares 10485760",
      "uploadMaxBytes('waiver-signature') is undefined, the core declares 1048576",
      "uploadMaxBytes names an undeclared origin 'products'",
      'uploadMaxBytes does not fall back to 0 for an unknown origin',
      'pictureUploadOrigins() lists [league-picture, products], the core declares [league-picture]',
      'no signatureUploadOrigins() function',
      "uploadContentTypeAllowed() does not state origin in pictureUploadOrigins() && request.resource.contentType.matches('image/.*')",
      'the staging block does not refuse delete (allow delete: if false)',
      'the staging block grants delete: a staged object is created once and never changed',
    ]);
  });

  it('FLAGS a missing cap function and a missing staging block, and checks no list or lane the app does not declare', async () => {
    expect(await uploadOriginProblems('match /other/{x} { allow read: if true; }', uploadFacts({ originLists: [], contentTypeLanes: [] }))).toEqual([
      'no uploadMaxBytes(origin) function',
      'no staging block match /uploads/{origin}/{userId}/{stagingId}',
    ]);
  });

  it('FLAGS a staging block that refuses update alone, relying on the default for delete', async () => {
    const rules = CANONICAL.replace('allow update, delete: if false;', 'allow update: if false;');
    expect(await uploadOriginProblems(rules, uploadFacts())).toEqual(['the staging block does not refuse delete (allow delete: if false)']);
  });

  it('refuses missing names and loaders, and lists that are not declared', () => {
    expect(storageUploadOriginGuard.factProblems({} as never)).toEqual([
      'capFunction is missing',
      'originCaps needs a loader function',
      'stagingPath is missing',
      'originLists is missing (declare [] when there is none)',
      'contentTypeLanes is missing (declare [] when there is none)',
    ]);
    expect(
      storageUploadOriginGuard.factProblems(uploadFacts({ originLists: [{ function: 'x', origins: [] as never }], contentTypeLanes: [{ function: 'y', expression: '' }] })),
    ).toEqual(['originLists x needs a loader function', "contentTypeLanes y's expression is missing"]);
  });
});

const metadataFacts = (over: Partial<StorageObjectMetadataFacts> = {}): StorageObjectMetadataFacts => ({
  generationReaders: ['requireStorageObjectGeneration', 'stagedObjectGenerationFromMetadata'],
  sizeReaders: ['parseStorageObjectSize'],
  packageContracts: ['UnreadableStorageObjectMetadataError', 'requireStorageObjectGeneration'],
  readerAnchors: ['functions/src/reader.ts'],
  exceptions: [],
  ...over,
});

async function runMetadata(files: Record<string, string>, facts = metadataFacts()) {
  repo = tempRepo({
    'src/anchor.ts': 'export {};',
    'functions/src/anchor.ts': 'export {};',
    'functions/src/reader.ts': 'const generation = requireStorageObjectGeneration(meta, { bucket, key });',
    ...files,
  });
  const reader = createRepoReader({
    repoRoot: repo.root,
    roots: { app: { path: 'src', anchor: 'src/anchor.ts' }, functions: { path: 'functions/src', anchor: 'functions/src/anchor.ts' } },
  });
  const [guard] = storageObjectMetadataGuard.build(facts);
  return guard.run(contextOf(reader));
}

describe("a stored object's generation and size are read only through the package helpers", () => {
  it('PASSES the helper calls, the size handed to its helper, and look-alikes that are no stored object', async () => {
    const clean = [
      "import { requireStorageObjectGeneration, UnreadableStorageObjectMetadataError } from 'pkg/server';",
      'const g1 = stagedObjectGenerationFromMetadata(file.metadata) || undefined;',
      'const s1 = parseStorageObjectSize(meta.size);',
      'const s2 = parseStorageObjectSize(sourceFile.metadata.size);',
      'const s3 = parseStorageObjectSize(data.size);',
      "throw new UnreadableStorageObjectMetadataError(bucket, key, 'size');",
      'const k = storageObjectResourceKey(bucket.name, file.name, generation);',
      'const g2 = { generation: input.generation };',
      'if (seen.size > 0) emit(seen.size);',
      '// String(meta.generation) in a comment',
    ].join('\n');
    expect(await runMetadata({ 'functions/src/clean.ts': clean, 'src/clean.ts': clean })).toEqual([]);
  });

  it('FLAGS each hand-rolled read: conversions, toString, fallbacks, casts, metadata member reads, and destructuring', async () => {
    const shapes = [
      'generation: String(data.generation),',
      "generation: String(meta.generation ?? ''),",
      'encodedBytes: Number(sourceFile.metadata.size ?? 0) || undefined,',
      "(file.metadata.generation as string | number | undefined) ?? 'current'",
      'generation = metadata.generation;',
      'const bytes = parseInt(object.size, 10);',
      'const bytes2 = parseFloat(stat.size);',
      'const bytes3 = +meta.size;',
      'const gen = obj.generation.toString();',
      "const gen2 = event.generation || 'current';",
      'const { generation, size } = file.metadata;',
      'const { size: rawSize } = meta;',
    ];
    for (const shape of shapes) {
      const findings = await runMetadata({ 'functions/src/probe.ts': shape });
      expect(findings.length, shape).toBeGreaterThan(0);
      expect(findings.every((f) => f.file === 'functions/src/probe.ts' && f.line === 1 && f.detail.startsWith('inline storage metadata read: ')), shape).toBe(true);
      repo?.remove();
      repo = undefined;
    }
  });

  it('FLAGS a local copy of a package-owned contract', async () => {
    const findings = await runMetadata({
      'functions/src/copy.ts': [
        'class UnreadableStorageObjectMetadataError extends Error {}',
        'export function requireStorageObjectGeneration(m) { return m; }',
        'const requireStorageObjectGeneration2 = 1;',
      ].join('\n'),
    });
    expect(findings).toEqual([
      { file: 'functions/src/copy.ts', line: 1, detail: 'a local copy of a package-owned contract: class UnreadableStorageObjectMetadataError' },
      { file: 'functions/src/copy.ts', line: 2, detail: 'a local copy of a package-owned contract: function requireStorageObjectGeneration' },
    ]);
  });

  it('PASSES a reviewed (file, shape) pair, and FLAGS a stale one and a reader anchor with no helper call left', async () => {
    const findings = await runMetadata(
      {
        'functions/src/removal.ts': 'const job = args.generation ?? 1;',
        'functions/src/reader.ts': 'const generation = 1;',
      },
      metadataFacts({
        exceptions: [
          { path: 'functions/src/removal.ts', shape: 'args.generation ??', why: 'a job counter, not a stored object generation' },
          { path: 'functions/src/removal.ts', shape: 'meta.size ||', why: 'gone' },
        ],
      }),
    );
    expect(findings).toEqual([
      { file: 'functions/src/removal.ts', detail: 'stale exception: "meta.size ||" no longer appears' },
      { file: 'functions/src/reader.ts', detail: 'reader anchor: no package helper call left in it' },
    ]);
  });

  it('refuses missing helper names, a missing anchor list, and an exception with no shape or why', () => {
    expect(storageObjectMetadataGuard.factProblems({ packageContracts: [], exceptions: [{ path: 'a.ts', shape: '', why: '' }] } as never)).toEqual([
      'generationReaders is missing',
      'sizeReaders is missing',
      'readerAnchors is missing',
      'exceptions entry a.ts names no shape',
      'exceptions entry a.ts carries no why',
    ]);
  });
});
