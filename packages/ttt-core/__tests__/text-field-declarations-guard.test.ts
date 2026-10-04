// Build-failing guard for the one text-field mechanism (ARCH-102): every text field a person types
// is declared once in `src/constants/text-fields.ts` (its input format, min, and max) and every
// wire schema reads it through `textFieldSchema`, so the trim, the non-blank rule, the cap, and the
// characters are the same at the form, the wire, and the writer.
//
// 1. A wire `z.string()` chain may not trim or bound itself by a text-length constant: that is a
//    second declaration of a field. The reviewed exceptions below are wire text no person types
//    (stored values a server payload carries, fixed strings, ids, addresses) — each names ONE
//    `file#declaration`, its count, and why; an entry whose occurrences changed fails too.
//    Separately, every `z.string()` in a wire INPUT declaration (`*Input`, `*TargetInfo`, `*Variables`,
//    `*Request`, `*Action`, `*Body`, `*Source` schemas) whose property names free text (reason, message,
//    title, …) must be a declared field or carry a built-in format (`.regex` / `.url` / `.email` /
//    `.uuid`) — otherwise it is listed below with why it is not typed text. A bare
//    `reason: z.string().min(1)` therefore fails.
// 2. `defineInputFormat` is called only in the declarations file.
// 3. Only the legal public documents and the NCII statutory fields keep their text as typed.
// 4. Every declaration that requires text refuses whitespace-only text through its schema.

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import * as TEXT_FIELDS from '../src/constants/text-fields';
import { textFieldSchema } from '../src/schemas/text-field';

const PKG_ROOT = path.resolve(__dirname, '..');
const WIRE_DIRS = ['src/schemas', 'src/media', 'src/upload-variables'];
const DECLARATIONS_FILE = 'src/constants/text-fields.ts';

/** `file#declaration` → how many self-bounded `z.string()` chains it holds, and why each is not a typed field. */
const SELF_BOUNDED_ALLOWED: Record<string, { count: number; why: string }> = {
  'src/schemas/admin.ts#CheckTrademarkInputSchema': {
    count: 2,
    why: 'Carries a STORED Work and sub-item title to the trademark check; a stored title can hold the moderation placeholder, which no title declaration admits.',
  },
  'src/schemas/admin.ts#NormalReportInputSchema': {
    count: 2,
    why: 'resolutionSummary is built from fixed labels and userFacingReasonCode is a code — neither is typed.',
  },
  'src/schemas/admin.ts#SafetyAccountActionSchema': {
    count: 1,
    why: 'reasonUserFacing is a fixed owner-readable string the console picks, not typed text.',
  },
  'src/schemas/admin.ts#SafetyCaseInputSchema': {
    count: 1,
    why: 'resolutionSummary is built from fixed labels.',
  },
  'src/schemas/admin.ts#AdminReplayDeadLetterInputSchema': {
    count: 2,
    why: 'The replay reason is a fixed string the Ops Repairs view sends.',
  },
  'src/schemas/atoms.ts#storedTitleSchema': {
    count: 1,
    why: 'The bound of a STORED title a server-written payload carries, not a typed field.',
  },
  'src/schemas/chat.ts#AdminModerateChatMessageInputSchema': {
    count: 1,
    why: 'The chat moderation reason is a fixed string the admin flow sends.',
  },
  'src/schemas/chat.ts#AdminReadChannelContextInputSchema': {
    count: 1,
    why: 'The context-read reason is a fixed string the admin flow sends.',
  },
  'src/schemas/ncii.ts#nciiContactEmailSchema': { count: 1, why: 'An email address — a built-in format, not free text.' },
  'src/schemas/ncii.ts#PublicTakeItDownLocatorSchema': { count: 1, why: 'A web address — a built-in format, not free text.' },
  'src/schemas/ncii.ts#TakeItDownAuthorizedRepresentativeInputSchema': {
    count: 1,
    why: 'authorityEvidenceRef is the uploaded evidence file\'s storage path, set by the page.',
  },
  'src/schemas/notification.ts#storedNotificationMessageSchema': {
    count: 1,
    why: 'The stored broadcast message an announcement\'s metadata carries.',
  },
  'src/schemas/notification.ts#NotificationMetadataByTypeSchema': {
    count: 2,
    why: 'Stored review notes and resolution reasons a notification\'s metadata carries.',
  },
  'src/schemas/safety.ts#CommandAccountActionInputSchema': {
    count: 1,
    why: 'reasonUserFacing is a fixed owner-readable string, not typed text.',
  },
  'src/schemas/safety.ts#OperatorStepUpCodeInputSchema': { count: 1, why: 'A 6-digit code — a numeric box, not free text.' },
  'src/schemas/safety.ts#SubmitReportInputSchema': {
    count: 1,
    why: 'narrative has no client sender; it is not a typed field.',
  },
  'src/schemas/users.ts#MarkNonUsArtisanInterestInputSchema': {
    count: 1,
    why: 'country is the value of a fixed select, not typed text.',
  },
  'src/schemas/users.ts#SearchPublicUsersInputSchema': { count: 1, why: 'A search box — a built-in format, not a declared field.' },
  'src/schemas/users.ts#LookupUserByEmailOrUidInputSchema': { count: 1, why: 'A search box — a built-in format, not a declared field.' },
  'src/schemas/work-project-management.ts#InviteSourceSchema': {
    count: 1,
    why: 'craftSkillName is a STORED craft name the invite carries.',
  },
  'src/media/atoms.ts#MentionSchema': { count: 1, why: 'A mention placeholder token the composer generates.' },
  'src/media/atoms.ts#MentionPlaceholderSchema': { count: 1, why: 'A mention placeholder token the composer generates.' },
};

/** `file#declaration` → how many free-text-named `z.string()` properties it holds that are not typed text. */
const UNDECLARED_FREE_TEXT_ALLOWED: Record<string, { count: number; why: string }> = {
  'src/schemas/admin.ts#TakeItDownPageCopyContentInputSchema': { count: 1, why: 'The record KEY of the copy strings — a copy-string id; each value is declared.' },
  'src/schemas/admin.ts#CheckTrademarkInputSchema': { count: 2, why: 'STORED Work and sub-item titles (see the self-bounded entry).' },
  'src/schemas/admin.ts#NormalReportInputSchema': { count: 2, why: 'A summary built from fixed labels, and a reason code.' },
  'src/schemas/admin.ts#SafetyAccountActionSchema': { count: 1, why: 'A fixed owner-readable reason the console picks.' },
  'src/schemas/admin.ts#SafetyCaseInputSchema': { count: 1, why: 'A summary built from fixed labels.' },
  'src/schemas/admin.ts#AdminReplayDeadLetterInputSchema': { count: 2, why: 'A fixed replay reason the Ops Repairs view sends.' },
  'src/schemas/chat.ts#AdminModerateChatMessageInputSchema': { count: 1, why: 'A fixed moderation reason the admin flow sends.' },
  'src/schemas/chat.ts#AdminReadChannelContextInputSchema': { count: 1, why: 'A fixed context-read reason the admin flow sends.' },
  'src/schemas/safety.ts#CommandAccountActionInputSchema': { count: 1, why: 'A fixed owner-readable reason.' },
  'src/schemas/users.ts#MarkNonUsArtisanInterestInputSchema': { count: 1, why: 'country is the value of a fixed select.' },
  'src/schemas/users.ts#SearchPublicUsersInputSchema': { count: 1, why: 'A search box — a built-in format.' },
  'src/schemas/users.ts#LookupUserByEmailOrUidInputSchema': { count: 1, why: 'A search box — a built-in format.' },
  'src/schemas/work-project-management.ts#InviteSourceSchema': { count: 1, why: 'A STORED craft name the invite carries.' },
  'src/media/start-upload.ts#StartUploadRequestSchema': {
    count: 2,
    why: 'originalFileName is the picked file\'s name; textContent is the generic caption slot startUpload judges per origin with that origin\'s declared schema (SquareStreetzPostTextSchema).',
  },
  'src/media/target-info.ts#CraftSkillMediaTargetInfoSchema': { count: 1, why: 'originalFileName is the picked file\'s name.' },
};

/** The declarations that keep their text as typed, and the category that allows it. */
const KEEP_AS_TYPED_ALLOWED: Record<string, 'legal public document' | 'NCII statutory field'> = {
  FUTURE_PLAN_TITLE_INPUT: 'legal public document',
  FUTURE_PLAN_DESCRIPTION_INPUT: 'legal public document',
  PLATFORM_RULE_TITLE_INPUT: 'legal public document',
  PLATFORM_RULE_DESCRIPTION_INPUT: 'legal public document',
  AGREEMENT_POINT_INPUT: 'legal public document',
  CONTENT_PAGE_HEADING_INPUT: 'legal public document',
  CONTENT_PAGE_BODY_INPUT: 'legal public document',
  DMCA_CONTACT_LABEL_INPUT: 'legal public document',
  DMCA_CONTACT_VALUE_INPUT: 'legal public document',
  TAKE_IT_DOWN_COPY_INPUT: 'legal public document',
  NCII_REQUESTER_NAME_INPUT: 'NCII statutory field',
  NCII_SIGNED_NAME_INPUT: 'NCII statutory field',
  NCII_REPRESENTED_PERSON_NAME_INPUT: 'NCII statutory field',
  NCII_AUTHORITY_BASIS_INPUT: 'NCII statutory field',
  NCII_NONCONSENT_STATEMENT_INPUT: 'NCII statutory field',
  NCII_SUPPORTING_FACTS_INPUT: 'NCII statutory field',
};

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return entry.name.endsWith('.ts') ? [full] : [];
  });
}

function relative(file: string): string {
  return path.relative(PKG_ROOT, file).split(path.sep).join('/');
}

function topLevelName(node: ts.Node): string {
  let current: ts.Node = node;
  while (current.parent && !ts.isSourceFile(current.parent)) current = current.parent;
  if (ts.isVariableStatement(current)) {
    return current.declarationList.declarations
      .flatMap((declaration) => (ts.isIdentifier(declaration.name) ? [declaration.name.text] : []))
      .join(', ');
  }
  if (ts.isFunctionDeclaration(current) && current.name) return current.name.text;
  return '<module>';
}

/** True for a `z.string()` call. */
function isZString(node: ts.Node): boolean {
  return (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    node.expression.name.text === 'string' &&
    ts.isIdentifier(node.expression.expression) &&
    node.expression.expression.text === 'z'
  );
}

// A length constant that bounds text — an id's length (`*_ID_LENGTH`) bounds an id, not text.
const TEXT_LENGTH_CONSTANT = /^(MAX|MIN)_(?![A-Z0-9_]*_ID_LENGTH$)[A-Z0-9_]*LENGTH$/;

/** The method calls chained onto a `z.string()` call, outermost last. */
function chainedCalls(root: ts.CallExpression): ts.CallExpression[] {
  const calls: ts.CallExpression[] = [];
  let node: ts.Node = root;
  while (
    ts.isPropertyAccessExpression(node.parent) &&
    node.parent.expression === node &&
    ts.isCallExpression(node.parent.parent)
  ) {
    calls.push(node.parent.parent);
    node = node.parent.parent;
  }
  return calls;
}

function selfBoundedChains(): Record<string, number> {
  const found: Record<string, number> = {};
  for (const dir of WIRE_DIRS) {
    for (const file of walk(path.join(PKG_ROOT, dir))) {
      const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
      const visit = (node: ts.Node): void => {
        if (isZString(node)) {
          const selfBounded = chainedCalls(node as ts.CallExpression).some((call) => {
            const method = (call.expression as ts.PropertyAccessExpression).name.text;
            if (method === 'trim') return true;
            if (method !== 'min' && method !== 'max') return false;
            const [argument] = call.arguments;
            return argument !== undefined && ts.isIdentifier(argument) && TEXT_LENGTH_CONSTANT.test(argument.text);
          });
          if (selfBounded) {
            const key = `${relative(file)}#${topLevelName(node)}`;
            found[key] = (found[key] ?? 0) + 1;
          }
        }
        ts.forEachChild(node, visit);
      };
      visit(source);
    }
  }
  return found;
}

const INPUT_DECLARATION = /(Input|TargetInfo|Variables|Request|Action|Body|Source)Schema$/;
const FREE_TEXT_PROPERTY =
  /reason|message|text|note|comment|title|description|name|subject|caption|summary|statement|facts|letter|label|heading|body|query|content|suggestion|region|country|value|intro|points|strings|term/i;
const BUILT_IN_FORMAT_METHODS = new Set(['regex', 'url', 'email', 'uuid']);

/** The free-text-named `z.string()` properties of wire input declarations that are not declared fields. */
function undeclaredFreeText(relativePath: string, sourceText: string): Record<string, number> {
  const found: Record<string, number> = {};
  const source = ts.createSourceFile(relativePath, sourceText, ts.ScriptTarget.Latest, true);
  const visit = (node: ts.Node): void => {
    if (isZString(node)) {
      const declaration = topLevelName(node);
      const calls = chainedCalls(node as ts.CallExpression);
      const outer: ts.Node = calls.length > 0 ? calls[calls.length - 1] : node;
      const parent = outer.parent;
      let property: string | null = null;
      if (parent && ts.isPropertyAssignment(parent)) property = parent.name.getText(source);
      else if (parent && ts.isCallExpression(parent) && parent.parent && ts.isPropertyAssignment(parent.parent)) {
        property = parent.parent.name.getText(source);
      }
      const builtIn = calls.some((call) => BUILT_IN_FORMAT_METHODS.has((call.expression as ts.PropertyAccessExpression).name.text));
      if (property !== null && INPUT_DECLARATION.test(declaration) && FREE_TEXT_PROPERTY.test(property) && !builtIn) {
        const key = `${relativePath}#${declaration}`;
        found[key] = (found[key] ?? 0) + 1;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

describe('text-field declarations guard', () => {
  it('every free-text property of a wire input is a declared field, outside the reviewed exceptions', () => {
    const found: Record<string, number> = {};
    for (const dir of WIRE_DIRS) {
      for (const file of walk(path.join(PKG_ROOT, dir))) {
        Object.assign(found, undeclaredFreeText(relative(file), fs.readFileSync(file, 'utf8')));
      }
    }
    const keys = [...new Set([...Object.keys(found), ...Object.keys(UNDECLARED_FREE_TEXT_ALLOWED)])].sort();
    const drift = keys.flatMap((key) => {
      const count = found[key] ?? 0;
      const allowed = UNDECLARED_FREE_TEXT_ALLOWED[key]?.count ?? 0;
      return count === allowed ? [] : [`${key}: ${count} undeclared free-text z.string() propert(ies), ${allowed} allowed`];
    });
    expect(drift, 'A typed text field takes textFieldSchema(<its declaration>).').toEqual([]);
  });

  it('fails on a bare required reason with no declaration', () => {
    const fixture = "const HideThingInputSchema = z.object({ thingId: idSchema, reason: z.string().min(1) });";
    expect(undeclaredFreeText('fixture.ts', fixture)).toEqual({ 'fixture.ts#HideThingInputSchema': 1 });
    const declared = "const HideThingInputSchema = z.object({ reason: textFieldSchema(HIDE_REASON_INPUT) });";
    expect(undeclaredFreeText('fixture.ts', declared)).toEqual({});
  });

  it('no wire schema trims or bounds a text field itself, outside the reviewed exceptions', () => {
    const found = selfBoundedChains();
    const keys = [...new Set([...Object.keys(found), ...Object.keys(SELF_BOUNDED_ALLOWED)])].sort();
    const drift = keys.flatMap((key) => {
      const count = found[key] ?? 0;
      const allowed = SELF_BOUNDED_ALLOWED[key]?.count ?? 0;
      return count === allowed ? [] : [`${key}: ${count} self-bounded z.string() chain(s), ${allowed} allowed`];
    });
    expect(
      drift,
      'A typed text field takes textFieldSchema(<its declaration in src/constants/text-fields.ts>); only reviewed non-typed wire text may bound itself.',
    ).toEqual([]);
  });

  it('declares a field only in the declarations file', () => {
    const callers = walk(path.join(PKG_ROOT, 'src'))
      .filter((file) => relative(file) !== DECLARATIONS_FILE)
      .filter((file) => /\bdefineInputFormat\s*\(/.test(fs.readFileSync(file, 'utf8')))
      .map(relative);
    expect(callers).toEqual([]);
  });

  it('keeps text as typed only for the legal public documents and the NCII statutory fields', () => {
    const keepsAsTyped = Object.entries(TEXT_FIELDS)
      .filter(([, value]) => typeof value === 'object' && value !== null && 'keepAsTyped' in value)
      .map(([name]) => name)
      .sort();
    expect(keepsAsTyped).toEqual(Object.keys(KEEP_AS_TYPED_ALLOWED).sort());
    const elsewhere = walk(path.join(PKG_ROOT, 'src'))
      .filter((file) => relative(file) !== DECLARATIONS_FILE)
      .filter((file) => /\bkeepAsTyped\b/.test(fs.readFileSync(file, 'utf8')))
      .map(relative);
    expect(elsewhere).toEqual([]);
  });

  it('refuses whitespace-only text for every field that requires text', () => {
    const required = (Object.entries(TEXT_FIELDS) as Array<[string, unknown]>).flatMap(([name, value]) =>
      typeof value === 'object' && value !== null && 'format' in value && (value as unknown as { min: number }).min >= 1
        ? [[name, value as TEXT_FIELDS_DECLARATION] as const]
        : [],
    );
    expect(required.length).toBeGreaterThan(0);
    for (const [name, declaration] of required) {
      expect({ name, accepted: textFieldSchema(declaration).safeParse(' \n\t ').success }).toEqual({ name, accepted: false });
    }
  });

  it('keeps every other field\'s text trimmed', () => {
    for (const [name, value] of Object.entries(TEXT_FIELDS)) {
      if (typeof value !== 'object' || value === null || !('format' in value) || 'keepAsTyped' in value) continue;
      const declaration = value as TEXT_FIELDS_DECLARATION;
      const sample = 'a'.repeat(Math.max(declaration.min, 1));
      const parsed = textFieldSchema(declaration).safeParse(`  ${sample}  `);
      expect({ name, value: parsed.success ? parsed.data : 'refused' }).toEqual({ name, value: sample });
    }
  });
});

type TEXT_FIELDS_DECLARATION = Parameters<typeof textFieldSchema>[0];
