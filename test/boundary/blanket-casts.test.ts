import type { RepoLayout } from '@ttt-productions/repo-guards/node';
import { GENERIC_GUARDS, registerSuiteOf } from '@ttt-productions/repo-guards/node/suite';
import { REPO_ROOT } from './leak-utils';

const layout: RepoLayout = {
  repoRoot: REPO_ROOT,
  roots: { app: { path: '.', anchor: 'scripts/test-quiet.mjs' } },
};

const JSDOM_MEDIA_STREAM =
  'jsdom cannot construct a MediaStream, and the component hands the stream to a real video element, so no port fits';
const JSDOM_CANVAS =
  'jsdom has no 2d canvas context, and the code draws on the real context getContext returns';

registerSuiteOf(
  {
    layout,
    generic: {
      blanketCasts: {
        reviewed: [
          {
            path: 'packages/dev-standards/__tests__/a11y.test.ts',
            anchor: 'as unknown as Page',
            why: "checkAccessibility hands the page to AxeBuilder, which requires Playwright's full Page",
          },
          {
            path: 'packages/file-input/__tests__/media-input-pending.test.tsx',
            anchor: 'drawImage',
            why: JSDOM_CANVAS,
          },
          {
            path: 'packages/file-input/__tests__/media-input-pending.test.tsx',
            anchor: 'getTracks',
            why: JSDOM_MEDIA_STREAM,
          },
          {
            path: 'packages/file-input/__tests__/media-input-recording.test.tsx',
            anchor: 'getTracks: () => tracks',
            why: JSDOM_MEDIA_STREAM,
          },
          {
            path: 'packages/file-input/__tests__/media-input-recording.test.tsx',
            anchor: 'clearRect',
            why: JSDOM_CANVAS,
          },
          {
            path: 'packages/file-input/__tests__/media-input-recording.test.tsx',
            anchor: 'getTracks: () => lateTracks',
            why: JSDOM_MEDIA_STREAM,
          },
          {
            path: 'packages/file-input/__tests__/photo-capture-late-stream.test.tsx',
            anchor: 'getTracks',
            why: JSDOM_MEDIA_STREAM,
          },
          {
            path: 'packages/media-processing-core/src/server/storage-ops.ts',
            anchor: 'as unknown as BodyInit',
            why: "Node's fetch streams a Node ReadStream body, which neither the DOM BodyInit type nor Node's own web-stream type names",
          },
          {
            path: 'packages/media-schemas/src/pending-media-lifecycle.ts',
            anchor: 'as unknown as ClaimedPendingMedia<TRow>',
            why: 'TypeScript cannot check an object spread against a per-variant mapped type over a generic row; the claim tests pin the result',
          },
          {
            path: 'packages/q-core/src/upload-variables/picture-upload-variables.ts',
            anchor: 'as unknown as z.ZodType<PictureUploadTarget>',
            why: 'TypeScript cannot follow the origin-to-target pairing through the mapped options; PictureUploadTarget states it',
          },
          {
            path: 'packages/query-core/__tests__/react/create-callables.test.tsx',
            anchor: '{ retry: 3 } as never',
            why: 'the test passes a retry the options type refuses, on purpose, to prove the runtime ignores it',
          },
          {
            path: 'packages/query-core/src/react/firestore/use-firestore-live-infinite.ts',
            anchor: 'dataWithId as unknown as T',
            why: "with no select, the caller's T is its statement of the stored document's shape; the hook reads the document as stored",
          },
        ],
      },
    },
    business: [],
  },
  GENERIC_GUARDS.filter((definition) => definition.id === 'blanketCasts'),
);
