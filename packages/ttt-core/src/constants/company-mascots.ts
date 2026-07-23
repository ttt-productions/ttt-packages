// ============================================================================
// THE COMPANY — canonical Green Room mascot contract + content (ARCH-102).
//
// The ONE home for the pure, server-safe Company business truths (id unions,
// billing kinds, performance intents, selectability, roster order) AND the
// DJ-approved VERBATIM character content (studies, click lines, footers,
// companion-switch exchanges, Yorick block lines, signed-out dock lines,
// onboarding cameos). Moved here losslessly from the app's staging modules
// (`src/lib/company-contract` + `src/lib/company-mascots.tsx`).
//
// This module is pure data: NO React, NO JSX, NO Next links, NO CSS, NO SVG,
// NO functions inside the data. Rich copy is modelled as discriminated
// `CompanyCopySegment`s so a web renderer, a phone app, or an AI voice can each
// present the exact approved words without importing a UI framework. The app
// owns the puppets, rig, choreography, and the adapter that turns these
// segments into `<p>`, `<em>`, and route-aware links.
//
// Canonical dialogue stays a versioned code constant here (never Firestore):
// it is the personality source, the safe AI-unavailable fallback, and the
// voice-regression fixture. Never reword — curly quotes/apostrophes are
// authored exactly as they render.
// ============================================================================

// ── Contract: id unions, billing, intents, selectability ─────────────────────

/** Every member of the Company, in roster order. */
export type CompanyCharacterId = 'bill' | 'kit' | 'yorick';

/** The roster, in billing order (Bill → Kit → Yorick). */
export const COMPANY_CHARACTER_IDS: readonly CompanyCharacterId[] = ['bill', 'kit', 'yorick'];

/** Billing tiers: the founding Player, permanent Players, and Stand-Ins
 *  (Limited Engagement — never selectable as the companion). */
export type CompanyBillingKind = 'foundingPlayer' | 'player' | 'standIn';

/** Demoable move intents — keyed by intent from day one so future event
 *  performances (page-grabs, standing ovations) land as content, not code. */
export type CompanyPerformanceIntent = 'bow' | 'hop' | 'wave';

/** The performance intents, in demo-button order. The app previously
 *  hand-mirrored this union in two places; consumers derive from this array. */
export const COMPANY_PERFORMANCE_INTENTS: readonly CompanyPerformanceIntent[] = ['bow', 'hop', 'wave'];

/** The characters a user may cast as their dock companion (never a Stand-In). */
export type SelectableCompanionId = 'bill' | 'kit';

/** The castable dock companions, in order. */
export const SELECTABLE_COMPANION_IDS: readonly SelectableCompanionId[] = ['bill', 'kit'];

// ── Rich-copy pure-data model ────────────────────────────────────────────────

/** Semantic destinations the copy can link to. Each client maps these to its
 *  own route/navigation — the package never carries an href in mascot copy. */
export type CompanyNavigationTarget = 'greenRoom' | 'futurePlans';

/** A single run of copy. `link` carries a semantic target, not a URL. */
export type CompanyCopySegment =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'emphasis'; readonly text: string }
  | { readonly kind: 'link'; readonly label: string; readonly target: CompanyNavigationTarget };

/** A block of copy — a paragraph or a set-aside aside. */
export type CompanyCopyBlockKind = 'paragraph' | 'aside';

export interface CompanyCopyBlock {
  readonly kind: CompanyCopyBlockKind;
  readonly segments: readonly CompanyCopySegment[];
}

// ── Registry shapes ──────────────────────────────────────────────────────────

export interface CompanyPerformance {
  readonly id: string;
  readonly label: string;
  readonly intent: CompanyPerformanceIntent;
  /** Community "Choreography by" credit — null until an audition stages it. */
  readonly creditUid: string | null;
}

export interface CompanyMascot {
  readonly id: CompanyCharacterId;
  /** Full stage name shown on nameplates + the playbill ("Bill the Understudy"). */
  readonly name: string;
  /** The ironic-understatement epithet (the Company tradition). */
  readonly title: string;
  readonly billingKind: CompanyBillingKind;
  /** Billing line rendered beside the name ("Founding Player"). */
  readonly billingLabel: string;
  /** One-line structural descriptor (not character voice). */
  readonly shortBio: string;
  /** Playbill character study (human-written; the future AI personality source). */
  readonly characterStudy: readonly CompanyCopyBlock[];
  /** "Role originated by" — resolves live via the app when set. */
  readonly originatedByUid: string | null;
  /** Text shown after "Role originated by — " when originatedByUid is null. */
  readonly originatedByFallback: string;
  /** Whether the origination frame invites the reader ("→ your name here?"). */
  readonly invitesOrigination: boolean;
  /** The performances credit caption under the demo buttons. */
  readonly choreographyCaption: string;
  readonly performances: readonly CompanyPerformance[];
  /** Rotating click lines (dock companion bubble + on-stage line pop). Each
   *  line is a segment run — most are a single text segment. */
  readonly lines: readonly (readonly CompanyCopySegment[])[];
  /** Dock speech-bubble footer segments. The character's short name is a
   *  `greenRoom` link segment; the app renders it as a link when signed in and
   *  as plain text when signed out. "one day" always links to `futurePlans`.
   *  Absent for Stand-Ins (Yorick — never the dock companion). */
  readonly footer?: readonly CompanyCopySegment[];
  /** False for Stand-Ins (Yorick) — never storable as the dock companion. */
  readonly selectable: boolean;
}

/** Companion-switch snark exchange, keyed (in COMPANION_SWITCH_EXCHANGES) by the
 *  character switched TO. Outgoing line first (the departing companion), then the
 *  incoming retort. Plain strings. */
export interface CompanionSwitchExchange {
  readonly outgoing: { readonly id: SelectableCompanionId; readonly line: string };
  readonly incoming: { readonly id: SelectableCompanionId; readonly line: string };
}

/** Onboarding cameo lines — Company members crashing the registration tour. */
export interface OnboardingCameos {
  /** Kit crashes The Audition Stage step. */
  readonly kitAuditionStage: string;
  /** Yorick cameos on The Hall step. */
  readonly yorickHall: string;
  /** The send-off curtain call — all three bow. */
  readonly curtainCall: Readonly<Record<CompanyCharacterId, string>>;
}

// ── Segment construction helpers (module-private; output is pure data) ────────

/** A line/footer that is a single plain-text run. */
const textRun = (text: string): readonly CompanyCopySegment[] => [{ kind: 'text', text }];

/** A character's dock footer, built from the one verbatim sentence. The name is
 *  a `greenRoom` link segment (the app renders it plain when signed out); "one
 *  day" always links to `futurePlans`; `tail` is the character-specific close. */
const dockFooter = (name: string, tail: string): readonly CompanyCopySegment[] => [
  { kind: 'link', label: name, target: 'greenRoom' },
  { kind: 'text', text: ' is a basic version for now — ' },
  { kind: 'link', label: 'one day', target: 'futurePlans' },
  { kind: 'text', text: ` ${tail}` },
];

const SHARED_PERFORMANCES: readonly CompanyPerformance[] = [
  { id: 'bow', label: 'Bow', intent: 'bow', creditUid: null },
  { id: 'hop', label: 'Hop', intent: 'hop', creditUid: null },
  { id: 'wave', label: 'Wave', intent: 'wave', creditUid: null },
];

// The dock-footer close sentences, VERBATIM (the pre-Company Bill wording; Kit's
// from the settled spec). Curly apostrophes authored exactly as rendered.
const BILL_FOOTER_TAIL =
  'we hope to make him an AI-powered guide who helps you navigate the site. He’ll never make content, just help.';
const KIT_FOOTER_TAIL =
  'we hope to make him an AI-powered guide with this exact attitude. He’ll never make content. He does have opinions about yours.';

// ── Bill the Understudy — Founding Player ────────────────────────────────────
// The 14 approved lines are VERBATIM (incl. the italic emphasis in line 11).
const BILL: CompanyMascot = {
  id: 'bill',
  name: 'Bill the Understudy',
  title: 'The Understudy',
  billingKind: 'foundingPlayer',
  billingLabel: 'Founding Player',
  shortBio: "TTT's founding player and your first guide.",
  characterStudy: [
    {
      kind: 'paragraph',
      segments: textRun(
        'The most enthusiastic understudy in show business, and TTT Productions’ founding player. Bill has read the whole script of this town — well, skimmed it — and rehearses every day for the role of your guide to everything here. He insists the ‘Bill’ is short for William, and that he once wrote plays in a town called Stratford. We have chosen to let him believe it. Someday he’ll answer anything you ask about this place. Today, he mostly waves.',
      ),
    },
  ],
  originatedByUid: null,
  originatedByFallback: 'To be determined',
  invitesOrigination: true,
  choreographyCaption: 'Choreography by — to be determined',
  performances: SHARED_PERFORMANCES,
  lines: [
    textRun("One day I'll help you find your perfect collaborator. Today, I mostly wave."),
    textRun("I'm just an understudy for now — but someday I'll know every corner of this town."),
    textRun('Rehearsing my big role: your guide to everything TTT. No spoilers.'),
    textRun("They say one day I'll have real personalities. Plural. I'm excited too."),
    textRun("I'll never make the art — that's your job. I'll just help you find your people."),
    textRun("Every great production starts with somebody standing in the wings. That's me. Literally."),
    textRun("Someday you'll ask me anything about this place and I'll actually answer. Bold, I know."),
    textRun('The Town Crier gets to shout. I get to practice my bow. For now.'),
    textRun("I've read the whole script of this town. Well... skimmed. I'm working on it."),
    textRun('Big dreams for a stick figure: guide, helper, friend. In that order.'),
    [
      { kind: 'text', text: "When the curtain rises on my real role, you'll be the first to know. You " },
      { kind: 'emphasis', text: 'did' },
      { kind: 'text', text: ' click me first.' },
    ],
    textRun('Until my big debut, consider me the most enthusiastic understudy in show business.'),
    textRun("Even the greatest playwright who ever lived starts over as an understudy in a town this good. That's my story, anyway."),
    textRun('Four hundred years of theatre experience. My résumé? A drawing of myself.'),
  ],
  footer: dockFooter('Bill', BILL_FOOTER_TAIL),
  selectable: true,
};

// ── Kit the Stand-In — permanent Player #2, Bill's rival ─────────────────────
const KIT: CompanyMascot = {
  id: 'kit',
  name: 'Kit the Stand-In',
  title: 'The Stand-In',
  billingKind: 'player',
  billingLabel: 'Player',
  shortBio: "Permanent Player #2, and Bill's rival.",
  characterStudy: [
    {
      kind: 'paragraph',
      segments: textRun(
        'Sharp, quick, and absolutely certain he should have gone first. Kit auditioned for founding mascot, delivered the finest monologue the empty theatre had ever heard, and lost the part to a stick figure with a “trustworthy wave.” He has been gracious about it every single day since — loudly, to anyone in range. Keeps the rejection letter framed. Ask him about it. He’s dying for you to ask.',
      ),
    },
    {
      kind: 'aside',
      segments: textRun(
        'Loosely nodding to a certain rival playwright — brilliant, theatrical, gone too soon. One day, an AI-powered guide with this exact personality: genuinely helpful, faintly insulted by the request.',
      ),
    },
  ],
  originatedByUid: null,
  originatedByFallback: 'To be determined',
  invitesOrigination: true,
  choreographyCaption: 'Choreography by — to be determined',
  performances: SHARED_PERFORMANCES,
  lines: [
    textRun("Yes, I'm the Stand-In. Permanently. The irony isn't lost on me — it lives with me now."),
    textRun("I was FIRST in line at the founding audition. They went with a stick figure who 'waves well.'"),
    textRun("Bill rehearses roles nobody wrote. I've already memorized them. We are not the same."),
    textRun("One day this whole town will know my name. Today it's 'the other one.' Fine."),
    textRun("I don't do warm-ups. I arrive brilliant."),
    textRun('Founding mascot. FOUNDING. He waved at a login page and they gave him a title.'),
    textRun('My five-year plan is center stage. My five-century plan is also center stage.'),
    textRun('History remembers a playwright who died before his rival got famous. Anyway. No reason.'),
    textRun('Click Bill for encouragement. Click me to hear the truth, beautifully delivered.'),
    textRun('I keep my rejection letter framed. Motivation is motivation.'),
    textRun("You clicked me first today. I rehearsed being gracious about this — give me a moment."),
    textRun("When the curtain finally rises on my lead role, act surprised. I won't."),
    textRun('They say I might have been a spy in a past life. I neither confirm nor deny. Mystique.'),
    textRun('The Understudy and the Stand-In on one stage. Somewhere a playwright is laughing at us both.'),
  ],
  footer: dockFooter('Kit', KIT_FOOTER_TAIL),
  selectable: true,
};

// ── Yorick the Forgettable — Stand-In · Limited Engagement ───────────────────
// Never selectable, never the dock companion; his lines are on-stage only.
const YORICK: CompanyMascot = {
  id: 'yorick',
  name: 'Yorick the Forgettable',
  title: 'The Forgettable',
  billingKind: 'standIn',
  billingLabel: 'Stand-In · Limited Engagement',
  shortBio: 'A Limited Engagement Stand-In, keeping the light warm.',
  characterStudy: [
    {
      kind: 'paragraph',
      segments: textRun(
        "A fellow of infinite jest, reduced to holding a light he isn't allowed to stand in. Yorick insists he was the funniest jester who ever lived — and unfortunately, everyone who could confirm it is unavailable for comment. He is keeping the stage warm until the role is properly cast, and he'd rather you didn't get attached. You'll forget him anyway. Everyone does. It's in the name.",
      ),
    },
  ],
  originatedByUid: null,
  originatedByFallback: 'no one will admit to it',
  invitesOrigination: false,
  choreographyCaption: 'Bow · Hop · Wave — borrowed from Bill, who says he can have them',
  performances: SHARED_PERFORMANCES,
  lines: [
    textRun("Oh! A visitor. Nobody visits the Wings. I'd know — I keep the guestbook. It's empty."),
    textRun("I used to kill at court, you know. Standing ovations. Kings weeping. ...You'll take my word for it."),
    textRun("Don't get attached. I'm told I'm temporary. The skull agrees."),
    textRun('Alas, poor me. I knew me well.'),
    textRun('Infinite jest, they said. INFINITE. And yet here I am, finite-ly employed.'),
    textRun("One day they'll cast this role properly and I'll be forgotten. Ahead of schedule, honestly."),
  ],
  selectable: false,
};

export const COMPANY_MASCOTS: Readonly<Record<CompanyCharacterId, CompanyMascot>> = {
  bill: BILL,
  kit: KIT,
  yorick: YORICK,
};

/** Registry order (Bill → Kit → Yorick), reused from the roster. */
export const COMPANY_MASCOT_ORDER: readonly CompanyCharacterId[] = COMPANY_CHARACTER_IDS;

// ── Pure helpers ─────────────────────────────────────────────────────────────

/** True when `x` is a canonical Company character id. */
export function isCompanyCharacterId(x: unknown): x is CompanyCharacterId {
  return typeof x === 'string' && (COMPANY_CHARACTER_IDS as readonly string[]).includes(x);
}

/** True when `id` may be cast as the dock companion — driven by the mascot
 *  data's `selectable` field (Yorick is false). */
export function isSelectableCompanion(id: CompanyCharacterId): id is SelectableCompanionId {
  return COMPANY_MASCOTS[id].selectable;
}

/** The mascot record for a character id. */
export function getCompanyMascot(id: CompanyCharacterId): CompanyMascot {
  return COMPANY_MASCOTS[id];
}

// ── Companion-switch snark exchanges (VERBATIM) ──────────────────────────────
// Keyed by the character being switched TO. Outgoing line first (the departing
// companion), then the incoming retort.
export const COMPANION_SWITCH_EXCHANGES: Readonly<
  Record<SelectableCompanionId, readonly CompanionSwitchExchange[]>
> = {
  // Switching TO Kit — Bill exits, Kit enters.
  kit: [
    {
      outgoing: { id: 'bill', line: "Kit?! ...No, it's fine. It's fine. I'll be in the wings. Rehearsing. Alone." },
      incoming: { id: 'kit', line: 'Finally. Someone with taste.' },
    },
    {
      outgoing: { id: 'bill', line: 'Take care of them, Kit. They click gently.' },
      incoming: { id: 'kit', line: 'I know how to be adored, Bill.' },
    },
    {
      outgoing: { id: 'bill', line: 'The understudy yields the stage. Again.' },
      incoming: { id: 'kit', line: 'And yet history will say I earned it. Because I did.' },
    },
    {
      outgoing: { id: 'bill', line: "You'll come back. They always— they usually come back." },
      incoming: { id: 'kit', line: "Don't wait up." },
    },
    {
      outgoing: { id: 'bill', line: 'Break a leg, Kit.' },
      incoming: { id: 'kit', line: 'I never break anything but hearts and attendance records.' },
    },
  ],
  // Switching TO Bill — Kit exits, Bill enters.
  bill: [
    {
      outgoing: { id: 'kit', line: 'Unbelievable. UNBELIEVABLE.' },
      incoming: { id: 'bill', line: "It's good to be back! ...He'll be alright." },
    },
    {
      outgoing: { id: 'kit', line: "Enjoy the waving. That's all he does, you know." },
      incoming: { id: 'bill', line: "I also bow now! I've been practicing." },
    },
    {
      outgoing: { id: 'kit', line: 'I was BRILLIANT and you choose the stick figure with the cap.' },
      incoming: { id: 'bill', line: "He means 'welcome back.' We're working on it." },
    },
    {
      outgoing: { id: 'kit', line: 'Fine. FINE. The wings have better lighting anyway.' },
      incoming: { id: 'bill', line: "They really don't. I'd know." },
    },
    {
      outgoing: { id: 'kit', line: 'This is the founding audition all over again.' },
      incoming: { id: 'bill', line: "You'll get the next one, Kit. ...Probably not. But maybe!" },
    },
  ],
};

// ── Yorick block lines (VERBATIM) ────────────────────────────────────────────
// Spoken by the ACTIVE companion when the user presses Yorick's cast button.
export const YORICK_BLOCK_LINES: Readonly<Record<SelectableCompanionId, readonly string[]>> = {
  bill: [
    "Soft you now — he's a Stand-In! He's only keeping the light warm. Thou art stuck with me. Nay — blessed with me.",
    "Yorick?! He doesn't even know his blocking. Literally. He asks me where to stand.",
    "You can't cast Yorick — he's on a Limited Engagement. Very limited. He leaves when the real role is cast.",
    'Alas, poor choice — I knew him better than you do. Pick a Player.',
  ],
  kit: [
    'The skeleton crew? No. Absolutely not. You have TWO trained professionals right here.',
    "He doesn't even know his blocking. I've watched him bow into the curtain. Twice.",
    "Yorick's not staying. Don't get attached to the help.",
    "You'd pass over ME for the temp? ...I need to sit down. On the couch he's not allowed on.",
  ],
};

// ── Signed-out dock lines (VERBATIM) ─────────────────────────────────────────
// Spoken by whichever Player is on the dock when NO user is signed in — the
// pre-login pitch.
export const SIGNED_OUT_DOCK_LINES: readonly string[] = [
  "The show's inside — and it's free. No ads, just an email.",
  "I'd introduce you to the whole Company, but you'll need a ticket. Tickets are free.",
  'Everything in this town is made by real people. Come see.',
];

// ── Onboarding cameo lines (VERBATIM) ────────────────────────────────────────
export const ONBOARDING_CAMEOS: OnboardingCameos = {
  kitAuditionStage:
    "The Audition Stage. Where stars are born. I was robbed here once — anyway, you'll love it.",
  yorickHall:
    'The Hall — every tale, tune, and show the town keeps. Four hundred years of my material, and not one shelf. Enjoy.',
  curtainCall: {
    bill: 'Break a leg out there.',
    kit: 'Try not to embarrass us.',
    yorick: "You'll forget me. It's fine. Go.",
  },
};
