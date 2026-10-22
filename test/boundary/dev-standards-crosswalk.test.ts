import { describe, it, expect } from 'vitest';
import { filesOf, packagesTree } from './workspace';

interface Doc {
  path: string;
  text: string;
}

const STANDARDS = 'packages/dev-standards';
const PLAYBOOKS = `${STANDARDS}/playbooks/`;
const RULES = `${STANDARDS}/rules/`;
const CROSSWALK = `${PLAYBOOKS}crosswalk.md`;

const RULE_ID = /RULE-STD-[A-Z]+-\d{3}\b/g;
const PLAYBOOK_FILE = /([a-z][a-z-]*)-playbook\.md$/;
const STEP_HEADING = /^### (\d+)\. /;
const RULES_LINE = /^\*\*Rules:\*\*/;
const RULES_LINE_END = /\*\*(?:Scope|Method|Expected)\b/;
const STEP_REF = /^([a-z][a-z-]*) (\d+(?:, \d+)*)(?: — |$)/;
const NO_AUDIT = '**No audit step yet';

function auditsFromSteps(playbooks: readonly Doc[]): {
  audits: Map<string, Set<string>>;
  problems: string[];
} {
  const audits = new Map<string, Set<string>>();
  const problems: string[] = [];
  for (const playbook of playbooks) {
    const name = PLAYBOOK_FILE.exec(playbook.path)?.[1];
    if (!name) continue;
    let step: string | null = null;
    let rulesLines = 0;
    let inRules = false;
    const finishStep = (): void => {
      if (step !== null && rulesLines !== 1) {
        problems.push(`${playbook.path}: step ${step} has ${rulesLines} **Rules:** lines, not one`);
      }
    };
    let inFence = false;
    for (const line of playbook.text.split(/\r?\n/)) {
      if (line.trimStart().startsWith('```')) inFence = !inFence;
      if (inFence) {
        inRules = false;
        continue;
      }
      const heading = STEP_HEADING.exec(line);
      if (heading || /^#{1,3} /.test(line)) {
        inRules = false;
        finishStep();
        step = heading ? heading[1]! : null;
        rulesLines = 0;
        continue;
      }
      if (RULES_LINE.test(line)) {
        if (step === null) {
          problems.push(`${playbook.path}: a **Rules:** line outside any numbered step`);
          continue;
        }
        rulesLines += 1;
        inRules = true;
      } else if (
        inRules &&
        (line.trim() === '' || line.startsWith('```') || line.startsWith('**'))
      ) {
        inRules = false;
      }
      if (!inRules || step === null) continue;
      const end = line.search(RULES_LINE_END);
      const text = end >= 0 ? line.slice(0, end) : line;
      if (end >= 0) inRules = false;
      for (const id of text.match(RULE_ID) ?? []) {
        if (!audits.has(id)) audits.set(id, new Set());
        audits.get(id)!.add(`${name} ${step}`);
      }
    }
    finishStep();
  }
  return { audits, problems };
}

function auditsFromCrosswalk(text: string): {
  audits: Map<string, Set<string>>;
  problems: string[];
} {
  const audits = new Map<string, Set<string>>();
  const problems: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const cells = line.split('|').map((cell) => cell.trim());
    const id = cells[1];
    if (!id || !/^RULE-STD-[A-Z]+-\d{3}$/.test(id)) continue;
    if (audits.has(id)) problems.push(`crosswalk: ${id} has more than one row`);
    const steps = new Set<string>();
    const cell = cells[3] ?? '';
    for (const segment of cell.split(';').map((part) => part.trim())) {
      if (segment === '' || segment === '—') continue;
      const ref = STEP_REF.exec(segment);
      if (ref) {
        for (const number of ref[2]!.split(', ')) steps.add(`${ref[1]} ${number}`);
      } else if (!cell.includes(NO_AUDIT)) {
        problems.push(
          `crosswalk: ${id} has an audited-by entry that is not "<playbook> <steps>": "${segment}"`,
        );
      }
    }
    if (steps.size === 0 && !cell.includes(NO_AUDIT)) {
      problems.push(`crosswalk: ${id} lists no step and does not say "No audit step yet"`);
    }
    audits.set(id, steps);
  }
  return { audits, problems };
}

function ruleHeadings(rules: readonly Doc[]): Set<string> {
  const ids = new Set<string>();
  for (const doc of rules) {
    for (const match of doc.text.matchAll(/^### (RULE-STD-[A-Z]+-\d{3})\b/gm)) ids.add(match[1]!);
  }
  return ids;
}

const sorted = (values: Iterable<string>): string[] => [...values].sort();

function crosswalkProblems(
  playbooks: readonly Doc[],
  crosswalk: string,
  rules: readonly Doc[],
): string[] {
  const fromSteps = auditsFromSteps(playbooks);
  const fromCrosswalk = auditsFromCrosswalk(crosswalk);
  const headings = ruleHeadings(rules);
  const problems = [...fromSteps.problems, ...fromCrosswalk.problems];
  for (const id of sorted(headings)) {
    if (!fromCrosswalk.audits.has(id)) problems.push(`crosswalk: ${id} has a heading but no row`);
  }
  for (const id of sorted(fromCrosswalk.audits.keys())) {
    if (!headings.has(id)) problems.push(`crosswalk: ${id} has a row but no rule heading`);
  }
  for (const id of sorted(fromSteps.audits.keys())) {
    if (!headings.has(id)) problems.push(`steps cite ${id}, which has no rule heading`);
  }
  for (const id of sorted(new Set([...fromSteps.audits.keys(), ...fromCrosswalk.audits.keys()]))) {
    if (!fromCrosswalk.audits.has(id)) continue;
    const cited = fromSteps.audits.get(id) ?? new Set<string>();
    const listed = fromCrosswalk.audits.get(id)!;
    const missing = sorted([...cited].filter((step) => !listed.has(step)));
    const extra = sorted([...listed].filter((step) => !cited.has(step)));
    if (missing.length > 0)
      problems.push(`crosswalk: ${id} omits ${missing.join(', ')}, whose Rules line cites it`);
    if (extra.length > 0)
      problems.push(
        `crosswalk: ${id} lists ${extra.join(', ')}, whose Rules line does not cite it`,
      );
  }
  return problems;
}

describe('boundary: the shared crosswalk matches the shared playbook steps and rules', () => {
  const markdown = filesOf(packagesTree, ['markdown']);
  const playbooks = markdown.filter((file) => file.path.startsWith(PLAYBOOKS));
  const rules = markdown.filter((file) => file.path.startsWith(RULES));
  const crosswalk = markdown.find((file) => file.path === CROSSWALK);

  it('reads the shared playbooks, rules, and crosswalk', () => {
    expect(crosswalk, `${CROSSWALK} is missing`).toBeDefined();
    expect(playbooks.filter((file) => PLAYBOOK_FILE.test(file.path)).length).toBeGreaterThan(0);
    expect(ruleHeadings(rules).size).toBeGreaterThan(0);
  });

  it('every crosswalk row lists exactly the steps whose Rules line cites its rule, and every rule has a row', () => {
    expect(crosswalkProblems(playbooks, crosswalk?.text ?? '', rules)).toEqual([]);
  });
});

describe('the crosswalk check fails on each seeded mismatch', () => {
  const playbooks: Doc[] = [
    {
      path: `${PLAYBOOKS}demo-playbook.md`,
      text: [
        '# Demo',
        '### 1. First',
        '**Rules:** RULE-STD-ENG-001, RULE-STD-ENG-002. **Scope:** `src` (not RULE-STD-ENG-003).',
        '### 2. Second',
        '**Rules:** RULE-STD-ENG-002,',
        'RULE-STD-ENG-003.',
        '',
        'Body text naming RULE-STD-ENG-001 is not a Rules line.',
      ].join('\n'),
    },
  ];
  const rules: Doc[] = [
    {
      path: `${RULES}core-rules.md`,
      text: [
        '### RULE-STD-ENG-001 — One',
        '### RULE-STD-ENG-002 — Two',
        '### RULE-STD-ENG-003 — Three',
      ].join('\n'),
    },
  ];
  const row = (id: string, audited: string): string => `| ${id} | Title | ${audited} | — |`;
  const matching = [
    row('RULE-STD-ENG-001', 'demo 1'),
    row('RULE-STD-ENG-002', 'demo 1, 2'),
    row('RULE-STD-ENG-003', 'demo 2'),
  ];

  it('passes a crosswalk that says exactly what the steps say', () => {
    expect(crosswalkProblems(playbooks, matching.join('\n'), rules)).toEqual([]);
  });

  it('fails a row that omits a citing step or lists a step that does not cite it', () => {
    const crosswalk = [
      matching[0],
      row('RULE-STD-ENG-002', 'demo 2'),
      row('RULE-STD-ENG-003', 'demo 1, 2'),
    ];
    expect(crosswalkProblems(playbooks, crosswalk.join('\n'), rules)).toEqual([
      'crosswalk: RULE-STD-ENG-002 omits demo 1, whose Rules line cites it',
      'crosswalk: RULE-STD-ENG-003 lists demo 1, whose Rules line does not cite it',
    ]);
  });

  it('fails a rule heading with no row, and a row whose rule has no heading', () => {
    const crosswalk = [matching[0], matching[1], row('RULE-STD-ENG-099', '**No audit step yet.**')];
    expect(crosswalkProblems(playbooks, crosswalk.join('\n'), rules)).toEqual([
      'crosswalk: RULE-STD-ENG-003 has a heading but no row',
      'crosswalk: RULE-STD-ENG-099 has a row but no rule heading',
    ]);
  });

  it('fails a malformed audited-by entry and a row with neither steps nor the gap note', () => {
    const crosswalk = [
      row('RULE-STD-ENG-001', 'demo step 1'),
      matching[1],
      row('RULE-STD-ENG-003', '—'),
    ];
    expect(crosswalkProblems(playbooks, crosswalk.join('\n'), rules)).toEqual([
      'crosswalk: RULE-STD-ENG-001 has an audited-by entry that is not "<playbook> <steps>": "demo step 1"',
      'crosswalk: RULE-STD-ENG-001 lists no step and does not say "No audit step yet"',
      'crosswalk: RULE-STD-ENG-003 lists no step and does not say "No audit step yet"',
      'crosswalk: RULE-STD-ENG-001 omits demo 1, whose Rules line cites it',
      'crosswalk: RULE-STD-ENG-003 omits demo 2, whose Rules line cites it',
    ]);
  });
});
