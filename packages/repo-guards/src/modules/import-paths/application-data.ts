import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Finding, GuardContext } from '../../guard.js';
import type { Scope } from '../../node/reader.js';
import type { GenericGuardDefinition } from '../../node/suite/config.js';
import { textProblem } from '../../support/facts.js';

export interface ApplicationDataFacts {
  packagesFolder: string;
  applicationDataPackages: readonly string[];
}

const SCOPE: Scope = { roots: ['app'], kinds: ['code'], tests: true };
const DEPENDENCY_FIELDS = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
] as const;

export const applicationDataImportsGuard: GenericGuardDefinition<ApplicationDataFacts> = {
  id: 'applicationDataImports',
  absentWhen: 'the repository holds no package of its own',
  factProblems(facts) {
    const problems: string[] = [];
    textProblem(facts?.packagesFolder, 'packagesFolder', problems);
    if (!Array.isArray(facts?.applicationDataPackages) || !facts.applicationDataPackages.length) {
      problems.push('applicationDataPackages is missing');
    } else if (
      facts.applicationDataPackages.some((name) => typeof name !== 'string' || !name.trim())
    ) {
      problems.push('an applicationDataPackages entry names no folder');
    } else if (
      new Set(facts.applicationDataPackages).size !== facts.applicationDataPackages.length
    ) {
      problems.push('applicationDataPackages lists a folder twice');
    }
    return problems;
  },
  build(facts) {
    return [
      {
        title: 'no generic package depends on an application-data package',
        description:
          'A generic package holds a mechanism and never knows an app: it declares no application-data package as a ' +
          'dependency of any kind and imports none. The app supplies its values through a factory, adapter, callback, or ' +
          'configuration instead.',
        timeoutMs: 300_000,
        run(context: GuardContext): Finding[] {
          const findings: Finding[] = [];
          const folder = join(context.reader.layout.repoRoot, facts.packagesFolder);
          const dirs = existsSync(folder)
            ? readdirSync(folder, { withFileTypes: true }).filter(
                (d) => d.isDirectory() && existsSync(join(folder, d.name, 'package.json')),
              )
            : [];
          if (!dirs.length)
            return [{ file: facts.packagesFolder, detail: 'the folder holds no package' }];
          const nameOf = (dir: string) =>
            (
              JSON.parse(readFileSync(join(folder, dir, 'package.json'), 'utf8')) as {
                name: string;
              }
            ).name;
          const known = new Set(dirs.map((d) => d.name));
          const applicationData = new Map<string, string>();
          for (const dir of facts.applicationDataPackages) {
            if (!known.has(dir))
              findings.push({
                file: `${facts.packagesFolder}/${dir}`,
                detail: 'applicationDataPackages names a folder that holds no package',
              });
            else applicationData.set(nameOf(dir), dir);
          }
          const names = [...applicationData.keys()];
          const namesOne = (spec: string) =>
            names.find((name) => spec === name || spec.startsWith(`${name}/`));
          const generic = dirs
            .filter((d) => !facts.applicationDataPackages.includes(d.name))
            .map((d) => d.name);
          for (const dir of generic) {
            const manifestPath = `${facts.packagesFolder}/${dir}/package.json`;
            const manifest = JSON.parse(context.file(manifestPath).text) as Record<
              string,
              Record<string, string> | undefined
            >;
            for (const field of DEPENDENCY_FIELDS) {
              for (const dependency of Object.keys(manifest[field] ?? {})) {
                if (applicationData.has(dependency))
                  findings.push({
                    file: manifestPath,
                    detail: `${field} names the application-data package ${dependency}`,
                  });
              }
            }
          }
          const genericRoots = generic.map((dir) => `${facts.packagesFolder}/${dir}/`);
          for (const file of context.files(SCOPE)) {
            if (!genericRoots.some((root) => file.path.startsWith(root))) continue;
            for (const site of file.imports) {
              const named = namesOne(site.spec);
              if (named) {
                findings.push({
                  file: file.path,
                  line:
                    file.sourceFile.getLineAndCharacterOfPosition(
                      site.node.getStart(file.sourceFile),
                    ).line + 1,
                  detail: `imports '${site.spec}' from the application-data package ${named}`,
                });
              }
            }
          }
          return findings;
        },
      },
    ];
  },
};
