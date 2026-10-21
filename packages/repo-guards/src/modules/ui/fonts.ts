// The app's fonts are self-hosted: `next/font/google` downloads each face when the app is BUILT, so
// every build — local, CI, and every deploy — depends on Google's font service answering in the
// one shape Next's font loader reads, and an answer in any other shape fails the whole build. The
// faces live in the repository and load through `next/font/local`.

import type { GenericGuardDefinition } from '../../node/suite/config.js';
import { reviewedAllowlist, type Hit } from '../../shapes/shapes.js';
import { objectProblem } from '../../support/facts.js';
import type { FileView } from '../../reader/view.js';
import { APP_CODE } from './styling.js';

const GOOGLE_FONTS = 'next/font/google';

function googleFontImports(file: FileView): Hit[] {
  if (file.kind !== 'code') return [];
  return file.imports
    .filter(({ spec }) => spec === GOOGLE_FONTS || spec.startsWith(`${GOOGLE_FONTS}/`))
    .map((site) => ({ index: site.specifier.getStart(file.sourceFile), detail: site.spec }));
}

export const selfHostedFontsGuard: GenericGuardDefinition<Record<string, never>> = {
  id: 'selfHostedFonts',
  absentWhen: false,
  factProblems(facts) {
    const problems: string[] = [];
    objectProblem(facts, 'facts', problems);
    return problems;
  },
  build() {
    return [
      reviewedAllowlist({
        title: 'the app loads its fonts from the repository, never from Google at build time',
        description:
          'next/font/google downloads each face when the app is built, so every build depends on the font service ' +
          "answering in the one shape Next's loader reads, and any other answer fails the build. Keep each face's " +
          '.woff2 and its license in the repository and load it through next/font/local.',
        scope: APP_CODE,
        match: googleFontImports,
        allowlist: [],
        samples: {
          flags: [
            { path: 'src/app/layout.tsx', text: "import { Inter } from 'next/font/google';" },
            { path: 'src/app/layout.tsx', text: "const fonts = await import('next/font/google');" },
            { path: 'src/app/layout.tsx', text: "export { Inter } from 'next/font/google';" },
          ],
          passes: [
            { path: 'src/app/layout.tsx', text: "import localFont from 'next/font/local';" },
            {
              path: 'src/app/layout.tsx',
              text: "const note = 'next/font/google is not used here';",
            },
          ],
        },
      }),
    ];
  },
};
