// Every Worker reads an incoming request body only through the bounded reader, so an unsigned
// request can never make an isolate buffer more than its endpoint's budget. A raw read of the
// request — `.text()`, `.json()`, `.arrayBuffer()`, `.formData()`, `.blob()`, or its `.body` stream —
// fails. Reads of stored objects and fetch responses are not request bodies: the match keys on the
// handler's request identifier (`request` / `req`).

import type { GenericGuardDefinition } from '../../config.js';
import type { Finding } from '../../guard.js';
import type { Scope } from '../../reader/reader.js';
import type { FileView } from '../../reader/view.js';

export interface WorkerBoundedBodyFacts {
  /** The bounded body reader's function name. */
  boundedReader: string;
  /** Endpoint files that must read their request body through the bounded reader with a budget. */
  boundedEndpoints: ReadonlyArray<{ file: string; why: string }>;
  /**
   * A request body stream handed on unread (never buffered), keyed by file and the exact statement
   * so a new use in the same file is still caught.
   */
  passThroughStreams: ReadonlyArray<{ file: string; statement: string; why: string }>;
}

const RAW_REQUEST_BODY_READ = /\b(?:request|req)\s*\.\s*(?:(?:text|json|arrayBuffer|formData|blob)\s*\(|body\b)/;

/** Every line of a file's code that reads the request body directly, trimmed, with its line. */
export function rawRequestBodyReads(file: FileView): Array<{ line: number; statement: string }> {
  return file.code
    .split('\n')
    .map((text, index) => ({ line: index + 1, statement: text.trim() }))
    .filter(({ statement }) => RAW_REQUEST_BODY_READ.test(statement));
}

const SCOPE: Scope = { roots: ['workers'], kinds: ['code'], tests: false };
const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const workerBoundedBodyGuard: GenericGuardDefinition<WorkerBoundedBodyFacts> = {
  id: 'workerBoundedBody',
  absentWhen: 'the app deploys no Cloudflare Worker',
  absentOnlyWithoutRoot: 'workers',
  factProblems(facts) {
    const problems: string[] = [];
    if (!facts || typeof facts !== 'object') return ['the facts are missing'];
    if (typeof facts.boundedReader !== 'string' || !IDENTIFIER.test(facts.boundedReader)) problems.push('boundedReader is not a function name');
    if (!Array.isArray(facts.boundedEndpoints) || !facts.boundedEndpoints.length) problems.push('boundedEndpoints names no endpoint');
    else for (const e of facts.boundedEndpoints) if (!e?.file || !e.why?.trim()) problems.push(`bounded endpoint ${e?.file ?? '(no file)'} needs its file and why`);
    if (!Array.isArray(facts.passThroughStreams)) problems.push('passThroughStreams is missing (an app with none declares [])');
    else {
      for (const p of facts.passThroughStreams) {
        if (!p?.file || !p.statement?.trim()) problems.push('a pass-through stream needs its file and statement');
        else if (!p.why?.trim()) problems.push(`pass-through stream in ${p.file} carries no why`);
      }
    }
    return problems;
  },
  build(facts) {
    const boundedCall = new RegExp(`\\b${escape(facts.boundedReader)}\\s*\\(\\s*(?:request|req)\\b[^)]*\\bmaxBytes\\b`);
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
              const pass = facts.passThroughStreams.findIndex((p) => p.file === file.path && p.statement.trim() === statement);
              if (pass === -1) findings.push({ file: file.path, line, detail: `reads the request body directly: ${statement}` });
              else seen.add(pass);
            }
          }
          facts.passThroughStreams.forEach((p, index) => {
            if (!seen.has(index)) findings.push({ file: p.file, detail: `stale pass-through entry: the statement is no longer in the file — ${p.statement}` });
          });
          const byPath = new Map(files.map((f) => [f.path, f]));
          for (const endpoint of facts.boundedEndpoints) {
            const file = byPath.get(endpoint.file);
            if (!file) findings.push({ file: endpoint.file, detail: 'the bounded endpoint is not a Worker source file (gone, moved, or a test)' });
            else if (!boundedCall.test(file.code)) {
              findings.push({ file: endpoint.file, detail: `no longer reads its request body through ${facts.boundedReader}(request, { maxBytes })` });
            }
          }
          return findings;
        },
      },
    ];
  },
};
