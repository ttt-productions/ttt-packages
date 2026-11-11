import { describe, expect, it } from 'vitest';
import type { Finding } from '../../src/guard.js';
import { checkSamples } from '../../src/node/suite/run.js';
import {
  appFolderManifests,
  browserBarGuard,
  type BrowserBarFacts,
} from '../../src/modules/repo/browser-bar.js';
import { runOne } from '../frontend-reads/run.js';

const FACTS: BrowserBarFacts = { publicDir: 'public' };

const lines = (...l: string[]) => l.join('\n');
const show = (findings: Finding[]) =>
  findings.map((f) => `${f.file}${f.line ? `:${f.line}` : ''} ${f.detail}`);

const run = async (files: Record<string, string>) =>
  show(await runOne(browserBarGuard, FACTS, { 'public/robots.txt': 'User-agent: *', ...files }));

describe('the site always opens with the browser bar', () => {
  it('flags appleWebApp set true, with capable: true, and as an object that leaves capable on', async () => {
    expect(
      await run({
        'src/app/layout.tsx': lines(
          'export const metadata: Metadata = {',
          "  title: 'Site',",
          "  appleWebApp: { capable: true, statusBarStyle: 'black' },",
          '};',
        ),
        'src/app/a/layout.tsx': 'export const metadata = { appleWebApp: true };',
        'src/app/b/layout.tsx': "export const metadata = { appleWebApp: { title: 'Site' } };",
      }),
    ).toEqual([
      'src/app/a/layout.tsx:1 appleWebApp: true lets the site open from the home screen with no browser bar',
      'src/app/b/layout.tsx:1 appleWebApp with no capable: false turns capable on, so the site opens with no browser bar',
      'src/app/layout.tsx:3 appleWebApp.capable lets the site open from the home screen with no browser bar',
    ]);
  });

  it('flags the capable meta, written as a tag or in a metadata other block', async () => {
    expect(
      await run({
        'src/app/head.tsx':
          'export const Head = () => <meta name="apple-mobile-web-app-capable" content="yes" />;',
        'src/app/layout.tsx':
          "export const metadata = { other: { 'mobile-web-app-capable': 'yes' } };",
      }),
    ).toEqual([
      'src/app/head.tsx:1 the apple-mobile-web-app-capable meta lets the site open from the home screen with no browser bar',
      'src/app/layout.tsx:1 the mobile-web-app-capable meta lets the site open from the home screen with no browser bar',
    ]);
  });

  it('flags a manifest route whose display is standalone, minimal-ui in a builder call, or a display_override', async () => {
    expect(
      await run({
        'src/app/manifest.ts': lines(
          'export default function manifest(): MetadataRoute.Manifest {',
          "  return { name: 'Site', display: 'standalone', display_override: ['fullscreen'] };",
          '}',
        ),
        'src/app/other/manifest.ts':
          "export default () => buildManifest({ name: 'Site', display: 'minimal-ui' });",
      }),
    ).toEqual([
      "src/app/manifest.ts:2 the manifest sets display: 'standalone', which opens the site with no browser bar; write display: browser",
      "src/app/manifest.ts:2 the manifest's display_override [fullscreen] can open the site with no browser bar; leave it out",
      "src/app/other/manifest.ts:1 the manifest sets display: 'minimal-ui', which opens the site with no browser bar; write display: browser",
    ]);
  });

  it('flags a static manifest under the public folder that the app links, or that has a conventional name', async () => {
    expect(
      await run({
        'src/app/layout.tsx': "export const metadata = { manifest: '/app.webmanifest?v=2' };",
        'public/app.webmanifest': JSON.stringify({ name: 'Site', display: 'fullscreen' }),
        'public/manifest.json': JSON.stringify({ name: 'Site', display_override: ['standalone'] }),
        'public/site.webmanifest': '{ not json',
      }),
    ).toEqual([
      'public/app.webmanifest sets display: "fullscreen", which opens the site with no browser bar; write display: browser',
      'public/manifest.json sets display_override ["standalone"], which can open the site with no browser bar; leave it out',
      expect.stringMatching(/^public\/site\.webmanifest is not JSON the guard can read/),
    ]);
  });

  it("flags a static manifest.json in the app router's folder", async () => {
    expect(
      await run({
        'src/app/manifest.json': JSON.stringify({ name: 'Site', display: 'standalone' }),
      }),
    ).toEqual([
      'src/app/manifest.json sets display: "standalone", which opens the site with no browser bar; write display: browser',
    ]);
  });

  it("flags a static manifest.webmanifest in the app router's folder", async () => {
    expect(
      await run({
        'src/app/manifest.webmanifest': JSON.stringify({ display_override: ['minimal-ui'] }),
      }),
    ).toEqual([
      'src/app/manifest.webmanifest sets display_override ["minimal-ui"], which can open the site with no browser bar; leave it out',
    ]);
  });

  it("passes a static manifest in the app router's folder that opens in the browser", async () => {
    expect(
      await run({
        'src/app/manifest.json': JSON.stringify({ name: 'Site', display: 'browser' }),
        'src/app/manifest.webmanifest': JSON.stringify({ name: 'Site' }),
      }),
    ).toEqual([]);
  });

  it("finds the app router's folder under the app root, or under the repository root and src", () => {
    expect(appFolderManifests('src')).toEqual([
      'src/app/manifest.json',
      'src/app/manifest.webmanifest',
    ]);
    expect(appFolderManifests('.')).toEqual([
      'app/manifest.json',
      'app/manifest.webmanifest',
      'src/app/manifest.json',
      'src/app/manifest.webmanifest',
    ]);
  });

  it('reads a manifest linked by a link tag', async () => {
    expect(
      await run({
        'src/app/head.tsx': 'export const Head = () => <link rel="manifest" href="/pwa.json" />;',
        'public/pwa.json': JSON.stringify({ display: 'standalone' }),
      }),
    ).toEqual([
      'public/pwa.json sets display: "standalone", which opens the site with no browser bar; write display: browser',
    ]);
  });

  it('passes a site whose manifests open in the browser and whose metadata turns no capability on', async () => {
    expect(
      await run({
        'src/app/layout.tsx': lines(
          'export const metadata: Metadata = {',
          "  manifest: '/site.webmanifest',",
          "  appleWebApp: { capable: false, title: 'Site' },",
          '};',
        ),
        'src/app/manifest.ts': "export default () => buildSiteManifest({ name: 'Site' });",
        'src/app/x/manifest.ts':
          "export default function manifest() { return { name: 'Site', display: 'browser' }; }",
        'src/components/box.tsx': "export const style = { display: 'standalone' };",
        'public/site.webmanifest': JSON.stringify({ name: 'Site', display: 'browser' }),
        'public/manifest.json': JSON.stringify({ name: 'Site' }),
      }),
    ).toEqual([]);
  });

  it('flags a public folder that does not exist', async () => {
    expect(
      show(await runOne(browserBarGuard, { publicDir: 'static' }, { 'src/app/layout.tsx': '' })),
    ).toEqual(['static the public folder does not exist']);
  });

  it('refuses facts with no public folder, or one that is not repo-relative', () => {
    expect(browserBarGuard.factProblems({} as BrowserBarFacts)).toEqual(['publicDir is missing']);
    expect(browserBarGuard.factProblems({ publicDir: 'public/' })).toEqual([
      'publicDir (public/) must not end with a slash',
    ]);
  });

  it("proves the guard's matcher on its samples", () => {
    const [guard] = browserBarGuard.build(FACTS);
    expect(() => checkSamples(guard!)).not.toThrow();
  });
});
