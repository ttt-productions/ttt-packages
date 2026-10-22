import type { GenericGuardDefinition } from '../../node/suite/config.js';
import type { Finding } from '../../guard.js';
import type { Scope } from '../../node/reader.js';
import type { FileView } from '../../reader/view.js';
import { escapeRegExp } from '../../support/text.js';
import { identifierProblem, isText, objectProblem, reviewedProblems } from '../../support/facts.js';

export interface WorkerBoundedBodyFacts {
  boundedReader: string;
  boundedEndpoints: ReadonlyArray<{ file: string; why: string }>;
  passThroughStreams: ReadonlyArray<{ file: string; statement: string; why: string }>;
}

const RAW_REQUEST_BODY_READ =
  /\b(?:request|req)\s*\.\s*(?:(?:text|json|arrayBuffer|formData|blob)\s*\(|body\b)/;

export function rawRequestBodyReads(file: FileView): Array<{ line: number; statement: string }> {
  return file.code
    .split('\n')
    .map((text, index) => ({ line: index + 1, statement: text.trim() }))
    .filter(({ statement }) => RAW_REQUEST_BODY_READ.test(statement));
}

const SCOPE: Scope = { roots: ['workers'], kinds: ['code'], tests: false };

export const workerBoundedBodyGuard: GenericGuardDefinition<WorkerBoundedBodyFacts> = {
  id: 'workerBoundedBody',
  absentWhen: 'the app deploys no Cloudflare Worker',
  absentOnlyWithoutRoot: 'workers',
  factProblems(facts) {
    const problems: string[] = [];
    if (!objectProblem(facts, 'facts', problems)) return problems;
    identifierProblem(facts.boundedReader, 'boundedReader', problems);
    reviewedProblems(facts.boundedEndpoints, 'boundedEndpoints', problems, {
      key: 'file',
      nonEmpty: true,
    });
    reviewedProblems(facts.passThroughStreams, 'passThroughStreams', problems, {
      key: 'file',
      id: (p) => (isText(p.statement) ? `${p.file} ${p.statement}` : undefined),
      idNames: 'statement',
    });
    return problems;
  },
  build(facts) {
    const boundedCall = new RegExp(
      `\\b${escapeRegExp(facts.boundedReader)}\\s*\\(\\s*(?:request|req)\\b[^)]*\\bmaxBytes\\b`,
    );
    return [
      {
        title: 'Worker request bodies are read only through the bounded reader',
        description:
          `No Worker source reads an incoming request body directly (request.text(), .json(), .arrayBuffer(), .formData(), ` +
          `.blob(), or .body). Read it with ${facts.boundedReader}(request, { maxBytes }) and the endpoint's declared budget, ` +
          'before any signature check or parse.',
        run(context) {
          const findings: Finding[] = [];
          const files = context.files(SCOPE);
          const seen = new Set<number>();
          for (const file of files) {
            for (const { line, statement } of rawRequestBodyReads(file)) {
              const pass = facts.passThroughStreams.findIndex(
                (p) => p.file === file.path && p.statement.trim() === statement,
              );
              if (pass === -1)
                findings.push({
                  file: file.path,
                  line,
                  detail: `reads the request body directly: ${statement}`,
                });
              else seen.add(pass);
            }
          }
          facts.passThroughStreams.forEach((p, index) => {
            if (!seen.has(index))
              findings.push({
                file: p.file,
                detail: `stale pass-through entry: the statement is no longer in the file — ${p.statement}`,
              });
          });
          const byPath = new Map(files.map((f) => [f.path, f]));
          for (const endpoint of facts.boundedEndpoints) {
            const file = byPath.get(endpoint.file);
            if (!file)
              findings.push({
                file: endpoint.file,
                detail: 'the bounded endpoint is not a Worker source file (gone, moved, or a test)',
              });
            else if (!boundedCall.test(file.code)) {
              findings.push({
                file: endpoint.file,
                detail: `no longer reads its request body through ${facts.boundedReader}(request, { maxBytes })`,
              });
            }
          }
          return findings;
        },
      },
    ];
  },
};
