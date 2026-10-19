// A script that brings up the Admin SDK reaches a real project's data with no rules, wrapper, or
// audit between the command and the data. It takes its target project as an argument with no
// default — a project id written into the source turns "I ran the script" into "I ran it against
// production" — and it reaches collections through the declared builders or by discovering them,
// never through a path written into the source.

import type { GenericGuardDefinition } from '../../node/suite/config.js';
import type { Finding } from '../../guard.js';
import type { Scope } from '../../node/reader.js';
import type { FileView } from '../../reader/view.js';
import { escapeRegExp } from '../../support/text.js';
import { namesProblem, objectProblem } from '../../support/facts.js';

export interface ProjectScriptFacts {
  /** The app's real project ids — none may be written into a privileged script. */
  projectIds: readonly string[];
  /** Scripts known to bring up the Admin SDK; each must still be recognised as one. */
  privilegedScripts: readonly string[];
}

const PRIVILEGED_CLIENT =
  /from\s+['"]firebase-admin(?:\/[^'"]*)?['"]|import\(\s*['"]firebase-admin(?:\/[^'"]*)?['"]\s*\)|require\(\s*['"]firebase-admin|\binitializeApp\s*\(/;
const PROJECT_ID_KEY = /\bprojectId\s*:\s*['"`]/g;
const PATH_LITERAL =
  /\.\s*(?:collection|collectionGroup|doc)\(\s*(?:'[^'\n]*'|"[^"\n]*"|`[^`$\n]*`)\s*\)/g;

export const isPrivilegedScript = (file: FileView) => PRIVILEGED_CLIENT.test(file.code);

/** Every place a privileged script names a project or writes a collection path. */
export function projectScriptFindings(file: FileView, projectIds: readonly string[]): Finding[] {
  if (!isPrivilegedScript(file)) return [];
  const findings: Finding[] = [];
  const ids = new RegExp(`['"\`](?:${projectIds.map(escapeRegExp).join('|')})['"\`]`, 'g');
  const lines = new Set<number>();
  for (const pattern of [ids, PROJECT_ID_KEY]) {
    for (const m of file.code.matchAll(pattern)) {
      const line = file.lineOf(m.index);
      if (lines.has(line)) continue;
      lines.add(line);
      findings.push({ file: file.path, line, detail: 'names a project' });
    }
  }
  for (const m of file.code.matchAll(PATH_LITERAL)) {
    findings.push({
      file: file.path,
      line: file.lineOf(m.index),
      detail: `hardcodes a path: ${m[0].trim()}`,
    });
  }
  return findings.sort((a, b) => (a.line ?? 0) - (b.line ?? 0));
}

const SCOPE: Scope = { roots: ['scripts'], kinds: ['code'], tests: false };

export const projectScriptGuard: GenericGuardDefinition<ProjectScriptFacts> = {
  id: 'projectScripts',
  absentWhen: 'the app has no script that brings up the Admin SDK against a real project',
  factProblems(facts) {
    const problems: string[] = [];
    if (!objectProblem(facts, 'facts', problems)) return problems;
    namesProblem(facts.projectIds, 'projectIds', problems);
    namesProblem(facts.privilegedScripts, 'privilegedScripts', problems);
    return problems;
  },
  build(facts) {
    return [
      {
        title: 'scripts that reach a real project take it as an argument and write no path',
        description:
          'A script that brings up the Admin SDK (imports firebase-admin or calls initializeApp) names no project id and no ' +
          'projectId literal, and writes no collection or document path into a collection(), collectionGroup() or doc() ' +
          'call. Take the project as an explicit argument with no default, and reach collections through the declared ' +
          'builders or listCollections().',
        run(context) {
          const files = context.files(SCOPE);
          const findings = files.flatMap((file) => projectScriptFindings(file, facts.projectIds));
          const byPath = new Map(files.map((f) => [f.path, f]));
          for (const script of facts.privilegedScripts) {
            const file = byPath.get(script);
            if (!file)
              findings.push({
                file: script,
                detail:
                  'the privileged script is not a scripts source file (gone, moved, or a test)',
              });
            else if (!isPrivilegedScript(file))
              findings.push({
                file: script,
                detail: 'stale entry: no longer recognised as bringing up the Admin SDK',
              });
          }
          return findings;
        },
      },
    ];
  },
};
