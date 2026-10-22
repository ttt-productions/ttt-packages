import type { GenericGuardDefinition } from '../../node/suite/config.js';
import { allowlistProblems, namesProblem, objectProblem } from '../../support/facts.js';
import type { Scope } from '../../node/reader.js';
import {
  matchPattern,
  reviewedAllowlist,
  type AllowlistEntry,
  type Hit,
  type Matcher,
} from '../../shapes/shapes.js';
import { escapeRegExp } from '../../support/text.js';
import { APP_CODE } from './styling.js';

const tsx = (text: string) => ({ path: 'sample.tsx', text });

export function rawEnumRenders(fieldNames: readonly string[]): Matcher {
  return matchPattern(
    new RegExp(
      String.raw`>\s*\{[\w.?]+\.(?:${fieldNames.map(escapeRegExp).join('|')})\}\s*(?:<|&)`,
    ),
  );
}

export interface EnumLabelFacts {
  fieldNames: readonly string[];
  exceptions: readonly AllowlistEntry[];
}

export const enumLabelsGuard: GenericGuardDefinition<EnumLabelFacts> = {
  id: 'enumLabels',
  absentWhen: false,
  factProblems(facts) {
    const problems: string[] = [];
    if (!objectProblem(facts, 'facts', problems)) return problems;
    namesProblem(facts.fieldNames, 'fieldNames', problems);
    allowlistProblems(facts.exceptions, 'exceptions', problems);
    return problems;
  },
  build(facts) {
    return [
      reviewedAllowlist({
        title: 'a stored enum value renders through its label map, never as raw text',
        description:
          'A stored enum value (a type, a status, a kind, a role) is shown through its core package label map or a label ' +
          'helper over it, never rendered as the stored value itself, even where a key happens to read like its label.',
        scope: APP_CODE,
        match: rawEnumRenders(facts.fieldNames),
        allowlist: facts.exceptions,
        samples: {
          flags: facts.fieldNames.map((name) => tsx(`<TableCell>{row.${name}}</TableCell>`)),
          passes: [
            tsx(`<TableCell>{LABELS[row.${facts.fieldNames[0]}]}</TableCell>`),
            tsx(`{row.${facts.fieldNames[0]} === "x" && <p>Shares</p>}`),
          ],
        },
      }),
    ];
  },
};

export const textEntryBoxes = matchPattern(/\btextEntry\s*=/);

export interface TextEntryFacts {
  reviewed: readonly AllowlistEntry[];
}

export const textEntryGuard: GenericGuardDefinition<TextEntryFacts> = {
  id: 'textEntryBoxes',
  absentWhen: false,
  factProblems(facts) {
    const problems: string[] = [];
    if (objectProblem(facts, 'facts', problems))
      allowlistProblems(facts.reviewed, 'reviewed', problems, { countRequired: true });
    return problems;
  },
  build(facts) {
    return [
      reviewedAllowlist({
        title:
          'textEntry appears only on the reviewed non-free-text boxes, exactly as many as reviewed',
        description:
          'Every free-text box takes its core package text-field declaration through inputFormat. textEntry skips that ' +
          'declaration, so it belongs only on a box that is not free text (a number, a code, an id), and each such box ' +
          "is reviewed in the app's guard config with its file, its count, and why. A new box in a listed file fails too.",
        scope: APP_CODE,
        match: textEntryBoxes,
        allowlist: facts.reviewed,
        samples: {
          flags: [tsx('<Input id="title" textEntry="identifier" value={title} />')],
          passes: [
            tsx('<Input id="title" inputFormat={TITLE_INPUT} value={title} />'),
            tsx('// textEntry="numeric" named only in a comment'),
          ],
        },
      }),
    ];
  },
};

const BARE_BOUND = /(?<!Math)\.(max|min|length)\(\s*(\d[\d_]*)\s*[,)]/g;

export const bareBounds: Matcher = (file) => {
  const hits: Hit[] = [];
  for (const m of file.code.matchAll(BARE_BOUND)) {
    const [, method, value] = m;
    if (method === 'min' && Number(value.replace(/_/g, '')) <= 1) continue;
    hits.push({ index: m.index ?? 0, detail: `.${method}(${value})` });
  }
  return hits;
};

export const SCHEMA_ROOTS: Scope = {
  roots: ['app', 'functions', 'workers'],
  kinds: ['code'],
  tests: false,
  optionalRoots: ['functions', 'workers'],
};

export interface SchemaBoundFacts {
  exceptions: readonly AllowlistEntry[];
}

export const schemaBoundsGuard: GenericGuardDefinition<SchemaBoundFacts> = {
  id: 'schemaBounds',
  absentWhen: false,
  factProblems(facts) {
    const problems: string[] = [];
    if (objectProblem(facts, 'facts', problems))
      allowlistProblems(facts.exceptions, 'exceptions', problems);
    return problems;
  },
  build(facts) {
    return [
      reviewedAllowlist({
        title:
          'every schema bound in the app, its Functions, and its Workers derives from a named limit',
        description:
          'A .max(), .min(), or .length() bound derives from its core package declaration or named limit constant; a bare ' +
          'number is a second copy of the limit. .min(0) and .min(1) are presence checks and are not limits.',
        scope: SCHEMA_ROOTS,
        match: bareBounds,
        allowlist: facts.exceptions,
        samples: {
          flags: [
            'text: z.string().max(4000),',
            'ids: z.array(z.string()).length(3),',
            'code: z.string().min(6),',
            'priority: z.number().int().min(0).max(2),',
          ],
          passes: [
            'frame: z.string().min(1).max(LIMITS.MAX_FRAME_BYTES),',
            'const backoff = Math.min(60_000 * 2 ** n, 3_600_000);',
            '// z.string().max(4000) stays a comment',
            'reason: textFieldSchema(REASON_INPUT).nullish(),',
          ],
        },
      }),
    ];
  },
};
