// Every generic package of the scope an app installs stays application-agnostic as it ships: its
// manifest never depends on the app's core package, and its shipped code never imports that core
// package or names the product. Read from what is installed, so a published build is checked, not
// its source.

import type { GenericGuardDefinition } from '../../config.js';
import type { Finding } from '../../guard.js';
import { isText, namesProblem, reviewedProblems, textProblem } from '../../support/facts.js';

export interface InstalledPackagesAgnosticFacts {
  /** The package scope the generic packages share (`@acme/`). */
  packageScope: string;
  /** The app's own core package, the one generic packages must never reach. */
  corePackage: string;
  /** Folders whose `package.json` declares the generic packages ('' for the repository root). */
  manifestFolders: readonly string[];
  /** Product names, written as regular-expression sources, that a generic package must never contain. */
  productNames: readonly string[];
  /**
   * Wire-protocol tokens a generic package owns that carry a product-branded string by design (a
   * header name two deployed runtimes agree on), each with why; their text is exempt from the
   * product-name check, nothing else in the file is.
   */
  wireTokens: ReadonlyArray<{ token: string; why: string }>;
}

const DEPENDENCY_SECTIONS = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'] as const;

export const installedPackagesAgnosticGuard: GenericGuardDefinition<InstalledPackagesAgnosticFacts> = {
  id: 'installedPackagesAgnostic',
  absentWhen: false,
  factProblems(facts) {
    const problems: string[] = [];
    if (!isText(facts?.packageScope) || !facts.packageScope.endsWith('/')) problems.push('packageScope must end in / (`@acme/`)');
    textProblem(facts?.corePackage, 'corePackage', problems);
    if (!Array.isArray(facts?.manifestFolders) || !facts.manifestFolders.length) problems.push('manifestFolders is empty');
    else if (facts.manifestFolders.some((f) => typeof f !== 'string')) problems.push('manifestFolders holds an entry that is not a folder');
    namesProblem(facts?.productNames, 'productNames', problems);
    for (const source of Array.isArray(facts?.productNames) ? facts.productNames : []) {
      try {
        new RegExp(source);
      } catch {
        problems.push(`product name ${source} is not a regular expression`);
      }
    }
    reviewedProblems(facts?.wireTokens, 'wireTokens', problems, { key: 'token' });
    return problems;
  },
  build(facts) {
    return [
      {
        title: 'no installed generic package reaches the core package or names the product',
        description:
          `Every installed ${facts.packageScope}* package but ${facts.corePackage} is generic: its manifest never depends on ` +
          `${facts.corePackage}, and its shipped code never imports it or names the product. A generic package takes the app's ` +
          'values through a factory, adapter, or configuration object instead.',
        timeoutMs: 120_000,
        run(context) {
          const findings: Finding[] = [];
          const products = facts.productNames.map((source) => new RegExp(source, 'i'));
          const declared = new Map<string, string>();
          for (const folder of facts.manifestFolders) {
            const manifestPath = folder ? `${folder}/package.json` : 'package.json';
            const manifest = JSON.parse(context.file(manifestPath).text) as Record<string, Record<string, string> | undefined>;
            for (const section of ['dependencies', 'devDependencies'] as const) {
              for (const name of Object.keys(manifest[section] ?? {})) {
                if (name.startsWith(facts.packageScope) && name !== facts.corePackage && !declared.has(name)) declared.set(name, folder);
              }
            }
          }
          if (!declared.size) findings.push({ file: '(manifests)', detail: `no ${facts.packageScope}* generic package is declared, so the guard checks nothing` });
          for (const [name, folder] of declared) {
            const under = [folder, ''].find((f) => context.reader.exists(`${f ? `${f}/` : ''}node_modules/${name}/package.json`));
            if (under === undefined) {
              findings.push({ file: name, detail: 'declared but not installed, so it cannot be read' });
              continue;
            }
            const base = `${under ? `${under}/` : ''}node_modules/${name}`;
            const manifest = JSON.parse(context.file(`${base}/package.json`).text) as Record<string, Record<string, string> | undefined>;
            for (const section of DEPENDENCY_SECTIONS) {
              if (manifest[section]?.[facts.corePackage] !== undefined) findings.push({ file: name, detail: `its ${section} names ${facts.corePackage}` });
            }
            for (const file of context.reader.installedFiles(name, { kinds: ['code', 'declarations'], under })) {
              let text = file.text;
              if (text.includes(facts.corePackage)) findings.push({ file: file.path, detail: `imports ${facts.corePackage}` });
              for (const { token } of facts.wireTokens) text = text.split(token).join('');
              if (products.some((p) => p.test(text))) findings.push({ file: file.path, detail: 'names the product' });
            }
          }
          return findings;
        },
      },
    ];
  },
};
