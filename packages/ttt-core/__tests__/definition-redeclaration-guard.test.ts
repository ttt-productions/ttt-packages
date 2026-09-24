// ============================================================================
// DEFINITION RE-DECLARATION GUARD — build-failing enforcement of ARCH-102:
// a canonical union's distinctive member literals may not appear as string
// literals in package CODE outside the union's defining file(s) and the reviewed
// allowlist. This is the union-shaped sibling of the numeric schema-literal guard.
//
// How it works: every `packages/*/src/**/*.{ts,tsx}` file (dist/node_modules
// excluded; __tests__ excluded — fixtures legitimately use literals) is PARSED,
// and only literals written in code are compared — a member name inside a line,
// block or JSDoc comment is not a re-declaration and never fires. A hit outside
// the allowlist means someone re-declared (or hand-mirrored) the canonical union;
// fix by importing the canonical schema/type, then rerun.
//
// An OWNER is the union's defining file — a literal there IS the declaration, so
// owners stay file-scoped. Every other excuse names `file#declaration`, not a whole
// file, so excusing one compiler-checked derived usage cannot blind the guard to a
// real re-declaration elsewhere in the same file. Each entry carries its justification
// and must still match a real occurrence — a stale excuse fails the guard too.
//
// Some spellings belong to MORE THAN ONE canonical union (a Tale's `chapter`
// sub-item surface and the `chapter`/`track`/`episode` sub-item KIND; a Work's
// standing in its Realm and a FILE's realm approval gate). Those name every owner
// here and stay guarded — consumers of either union import its schema rather than
// re-quoting a member. Do NOT consolidate two genuinely different vocabularies
// just because they share a word.
//
// Adding a NEW canonical union? Add its most distinctive member here.
// ============================================================================

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  collectCodeStringLiterals,
  isExcusedOccurrence,
  type GuardedLiteral,
} from './support/code-string-literals';

const PACKAGES_DIR = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');

const SAFETY_PHRASES = 'ttt-core/src/constants/safety-confirmation-phrases.ts';
const HALL_SURFACE_OWNER = 'ttt-core/src/constants/hall-content-routing.ts';

const GUARDED: Record<string, GuardedLiteral> = {
  mimicOnTtt: {
    owners: ['ttt-core/src/doc-schemas/user.ts'],
    allowed: [
      {
        file: 'ttt-core/src/constants/craft-skill-statements.ts',
        declaration: 'CRAFT_SKILL_KIND_ORDER',
        why: 'Typed `CraftSkillKind[]` ordering array — the compiler checks every member.',
      },
    ],
  },
  mimicOffTtt: {
    owners: ['ttt-core/src/doc-schemas/user.ts'],
    allowed: [
      {
        file: 'ttt-core/src/constants/craft-skill-statements.ts',
        declaration: 'CRAFT_SKILL_KIND_ORDER',
        why: 'Typed `CraftSkillKind[]` ordering array — the compiler checks every member.',
      },
    ],
  },
  // (The adminWorkMessage / admin-work-message entries were removed with the report type
  // itself — admin correspondence is not reportable. Their absence from every canonical
  // union is guarded by report-admin-conversations-not-reportable.test.ts.)
  possibleMinor: {
    owners: ['ttt-core/src/doc-schemas/safety/foundation.ts'],
  },
  authorizedRepresentative: {
    owners: ['ttt-core/src/doc-schemas/safety/foundation.ts'],
    allowed: [
      {
        file: 'ttt-core/src/doc-schemas/ncii/requests.ts',
        declaration: 'requiredFieldCodes',
        why: 'Compile-checked comparison against the typed requesterRole (a typo fails tsc).',
      },
    ],
  },
  correctedNoApparentViolation: {
    owners: ['ttt-core/src/doc-schemas/safety/foundation.ts'],
    allowed: [
      {
        file: 'ttt-core/src/constants/admin-labels.ts',
        declaration: 'REPORT_DISPOSITION_OPTIONS',
        why: 'Option values are typed `Exclude<ReportDisposition, …>` — compiler-checked.',
      },
    ],
  },
  workFileFolder: {
    owners: ['ttt-core/src/doc-schemas/media-assets.ts'],
    allowed: [
      {
        file: 'ttt-core/src/schemas/media.ts',
        declaration: 'CreateMediaGrantInputSchema',
        why: "The createMediaGrant wire input's OWN scopeKind discriminant (its union also carries request-only kinds); reviewed.",
      },
    ],
  },
  '[message removed]': {
    // The canonical moderation-redaction wire text (MODERATION_REDACTED_TEXT).
    owners: ['chat-schemas/src/realtime-wire.ts'],
  },
  'ttt.chat.v1': {
    // The canonical chat WebSocket subprotocol token (CHAT_SUBPROTOCOL).
    owners: ['chat-schemas/src/realtime-wire.ts'],
  },
  'Removed by moderation — awaiting an update by the steward.': {
    // The canonical moderation text-clear placeholder (MODERATION_CLEAR_PLACEHOLDER).
    owners: ['ttt-core/src/constants/business-content.ts'],
  },
  // Safety operator typed-confirmation attestations — each gates a callable schema via
  // z.literal(PHRASE) and is typed/sent from the frontend; ONE declaration in the phrases
  // file, every schema derives. (See constants/safety-confirmation-phrases.ts.)
  'I confirm these safety actions': { owners: [SAFETY_PHRASES] },
  'I confirm reopening this safety case': { owners: [SAFETY_PHRASES] },
  'I confirm this account action': { owners: [SAFETY_PHRASES] },
  'I confirm this is the NCMEC portal receipt': { owners: [SAFETY_PHRASES] },
  'I confirm this NCMEC report was filed via the manual portal': { owners: [SAFETY_PHRASES] },
  'I confirm I am revealing case evidence under reauth': { owners: [SAFETY_PHRASES] },
  'I confirm this NCMEC portal correction was filed': { owners: [SAFETY_PHRASES] },
  'I confirm this TAKE IT DOWN validity decision': { owners: [SAFETY_PHRASES] },
  'I confirm this legal reporting disposition': { owners: [SAFETY_PHRASES] },
  // The Company mascot contract. Distinctive member of CompanyBillingKind; the whole
  // contract + registry lives in one module, so no derived usage exists elsewhere.
  foundingPlayer: {
    owners: ['ttt-core/src/constants/company-mascots.ts'],
  },
  // Distinctive member of CompanyCharacterId (the Stand-In who is never selectable).
  yorick: {
    owners: ['ttt-core/src/constants/company-mascots.ts'],
  },
  // Distinctive member of AccountDeletionRequestStatus. The "active request" predicate is
  // owned by ACTIVE_DELETION_REQUEST_STATUSES / isActiveDeletionRequest in the defining file.
  parkedOnHold: {
    owners: ['ttt-core/src/doc-schemas/account-deletion.ts'],
  },
  // The RealmFileCanonStatus approval gate (media-assets.ts) and the Work-in-realm
  // RealmCanonStatus (work-project.ts) are different unions that share two spellings:
  // `pendingApproval` belongs only to the file gate, while `canon` / `nonCanon` are
  // members of BOTH and so name both owners. The fourth member, `none`, stays unguarded —
  // it is an ordinary "no value" token across many unrelated unions in these packages.
  // Consumers import the owning schema (RealmFileApprovedStatusSchema /
  // RealmFilePendingApprovalStatusSchema here, RealmCanonStatusSchema there) instead of
  // re-quoting a member.
  pendingApproval: {
    owners: ['ttt-core/src/doc-schemas/media-assets.ts'],
  },
  canon: {
    owners: ['ttt-core/src/doc-schemas/media-assets.ts', 'ttt-core/src/doc-schemas/work-project.ts'],
  },
  nonCanon: {
    owners: ['ttt-core/src/doc-schemas/media-assets.ts', 'ttt-core/src/doc-schemas/work-project.ts'],
  },
  // Distinctive member of SystemRole (the admin roles an operator can hold). Was restated
  // inline in three doc schemas and the audit type; every consumer now derives from the atom.
  jrAdmin: {
    owners: ['ttt-core/src/schemas/atoms.ts'],
  },
  // The Hall content SURFACE vocabularies — HALL_CONTENT_DETAIL_SURFACES (tale / tune /
  // television) and HALL_CONTENT_SUB_ITEM_SURFACES (chapter / tuneTrack / televisionEpisode),
  // both projected from HALL_CONTENT_SURFACE_NAMES_BY_WORK_TYPE. Enum-shaped consumers
  // (HallContentTextSurfaceSchema, the hallLibrary domain events, the cover targetInfo)
  // spread those tuples instead of restating members.
  //
  // NOT the same vocabulary, and deliberately not consolidated: the capitalised
  // WorkProjectType keys `Tales`/`Tunes`/`Television` (types/content.ts), and the hall
  // sub-item KIND union `chapter` / `track` / `episode` (HallSubItemTypeSchema,
  // doc-schemas/content.ts) — which is why `chapter` names two owners below.
  tale: { owners: [HALL_SURFACE_OWNER] },
  tune: { owners: [HALL_SURFACE_OWNER] },
  television: { owners: [HALL_SURFACE_OWNER] },
  tuneTrack: { owners: [HALL_SURFACE_OWNER] },
  televisionEpisode: { owners: [HALL_SURFACE_OWNER] },
  chapter: { owners: [HALL_SURFACE_OWNER, 'ttt-core/src/doc-schemas/content.ts'] },
  // PublicDocumentId — each id IS its `_appConfig` projection doc id, declared once in
  // SPECIAL_DOCS; PUBLIC_DOCUMENT_IDS and every per-document map key off those constants.
  dmcaPolicy: { owners: ['ttt-core/src/paths/collections.ts'] },
  // PublicDocumentAcceptanceSource (registration | reacceptance) — the audit payload enum
  // derives from the tuple.
  reacceptance: { owners: ['ttt-core/src/constants/public-documents.ts'] },
  // LegalReviewNoticeLinkTarget's non-document member — the founder's full note.
  founderNote: { owners: ['ttt-core/src/constants/legal-review-notice.ts'] },
  // StatusReconcileQueueAuthEffect — which post-commit Auth effect queued a uid. Its other
  // member, `accountStatus`, is too common a word to guard.
  publicDocumentsAcceptedClaim: { owners: ['ttt-core/src/doc-schemas/operational.ts'] },
};

function walk(dir: string, out: string[]): void {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist' || name === '__tests__' || name.startsWith('.')) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name)) out.push(full);
  }
}

function packageSrcFiles(): string[] {
  const files: string[] = [];
  for (const pkg of readdirSync(PACKAGES_DIR)) {
    const src = join(PACKAGES_DIR, pkg, 'src');
    try {
      if (statSync(src).isDirectory()) walk(src, files);
    } catch {
      // no src dir — skip
    }
  }
  return files;
}

interface Occurrence {
  readonly file: string;
  readonly declaration: string;
  readonly line: number;
}

/** literal → every CODE occurrence of it across the scanned package sources. */
function scanOccurrences(files: string[], literals: string[]): Map<string, Occurrence[]> {
  const wanted = new Set(literals);
  const byLiteral = new Map<string, Occurrence[]>(literals.map((literal) => [literal, []]));
  for (const file of files) {
    const rel = relative(PACKAGES_DIR, file).split(sep).join('/');
    for (const hit of collectCodeStringLiterals(file, readFileSync(file, 'utf8'))) {
      if (!wanted.has(hit.value)) continue;
      byLiteral.get(hit.value)?.push({ file: rel, declaration: hit.declaration, line: hit.line });
    }
  }
  return byLiteral;
}

describe('canonical-union member literals appear only at their defining site', () => {
  const files = packageSrcFiles();
  const occurrences = scanOccurrences(files, Object.keys(GUARDED));

  it('scanned a plausible number of package source files', () => {
    expect(files.length).toBeGreaterThan(100);
  });

  for (const [literal, rule] of Object.entries(GUARDED)) {
    const ownerList = rule.owners.join(' / ');
    const allowed = rule.allowed ?? [];

    it(`'${literal}' is declared only in ${ownerList} (+ reviewed allowlist)`, () => {
      const offenders = (occurrences.get(literal) ?? [])
        .filter((hit) => !isExcusedOccurrence(hit, rule))
        .map((hit) => `${hit.file}#${hit.declaration}:${hit.line}`);
      expect(
        offenders,
        `Re-declared canonical member '${literal}' — import the canonical union from ${ownerList} instead (or, for a compiler-checked derived usage, add file#declaration to this literal's reviewed allowlist with its justification).`,
      ).toEqual([]);
    });

    for (const entry of allowed) {
      it(`'${literal}' allowlist entry ${entry.file}#${entry.declaration} still matches real code`, () => {
        const matches = (occurrences.get(literal) ?? []).filter(
          (hit) => hit.file === entry.file && hit.declaration === entry.declaration,
        );
        expect(
          matches.length,
          `Stale allowlist entry (${entry.why}) — the occurrence it excuses is gone; delete the entry.`,
        ).toBeGreaterThan(0);
      });
    }
  }
});
