// Copy is verbatim: curly quotes and apostrophes are authored exactly as they render.

export type CompanyCharacterId = 'bill' | 'kit' | 'yorick';

export const COMPANY_CHARACTER_IDS: readonly CompanyCharacterId[] = ['bill', 'kit', 'yorick'];

export type CompanyBillingKind = 'foundingPlayer' | 'player' | 'standIn';

export type CompanyPerformanceIntent = 'bow' | 'hop' | 'wave';

export const COMPANY_PERFORMANCE_INTENTS: readonly CompanyPerformanceIntent[] = [
  'bow',
  'hop',
  'wave',
];

export type SelectableCompanionId = 'bill' | 'kit';

export const SELECTABLE_COMPANION_IDS: readonly SelectableCompanionId[] = ['bill', 'kit'];

export type CompanyNavigationTarget = 'greenRoom' | 'futurePlans';

export type CompanyCopySegment =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'emphasis'; readonly text: string }
  | { readonly kind: 'link'; readonly label: string; readonly target: CompanyNavigationTarget };

export type CompanyCopyBlockKind = 'paragraph' | 'aside';

export interface CompanyCopyBlock {
  readonly kind: CompanyCopyBlockKind;
  readonly segments: readonly CompanyCopySegment[];
}

export interface CompanyPerformance {
  readonly id: string;
  readonly label: string;
  readonly intent: CompanyPerformanceIntent;
  readonly creditUid: string | null;
}

export interface CompanyMascot {
  readonly id: CompanyCharacterId;
  readonly name: string;
  readonly title: string;
  readonly billingKind: CompanyBillingKind;
  readonly billingLabel: string;
  readonly shortBio: string;
  readonly characterStudy: readonly CompanyCopyBlock[];
  readonly originatedByUid: string | null;
  readonly originatedByFallback: string;
  readonly invitesOrigination: boolean;
  readonly choreographyCaption: string;
  readonly performances: readonly CompanyPerformance[];
  readonly lines: readonly (readonly CompanyCopySegment[])[];
  readonly footer?: readonly CompanyCopySegment[];
  readonly selectable: boolean;
}

export interface CompanionSwitchExchange {
  readonly outgoing: { readonly id: SelectableCompanionId; readonly line: string };
  readonly incoming: { readonly id: SelectableCompanionId; readonly line: string };
}

export interface OnboardingCameos {
  readonly kitAuditionStage: string;
  readonly yorickHall: string;
  readonly curtainCall: Readonly<Record<CompanyCharacterId, string>>;
}

const textRun = (text: string): readonly CompanyCopySegment[] => [{ kind: 'text', text }];

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

const BILL_FOOTER_TAIL =
  'we hope to make him an AI-powered guide who helps you navigate the site. He’ll never make content, just help.';
const KIT_FOOTER_TAIL =
  'we hope to make him an AI-powered guide with this exact attitude. He’ll never make content. He does have opinions about yours.';

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
    textRun(
      "Every great production starts with somebody standing in the wings. That's me. Literally.",
    ),
    textRun(
      "Someday you'll ask me anything about this place and I'll actually answer. Bold, I know.",
    ),
    textRun('The Town Crier gets to shout. I get to practice my bow. For now.'),
    textRun("I've read the whole script of this town. Well... skimmed. I'm working on it."),
    textRun('Big dreams for a stick figure: guide, helper, friend. In that order.'),
    [
      {
        kind: 'text',
        text: "When the curtain rises on my real role, you'll be the first to know. You ",
      },
      { kind: 'emphasis', text: 'did' },
      { kind: 'text', text: ' click me first.' },
    ],
    textRun('Until my big debut, consider me the most enthusiastic understudy in show business.'),
    textRun(
      "Even the greatest playwright who ever lived starts over as an understudy in a town this good. That's my story, anyway.",
    ),
    textRun('Four hundred years of theatre experience. My résumé? A drawing of myself.'),
  ],
  footer: dockFooter('Bill', BILL_FOOTER_TAIL),
  selectable: true,
};

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
    textRun(
      "Yes, I'm the Stand-In. Permanently. The irony isn't lost on me — it lives with me now.",
    ),
    textRun(
      "I was FIRST in line at the founding audition. They went with a stick figure who 'waves well.'",
    ),
    textRun("Bill rehearses roles nobody wrote. I've already memorized them. We are not the same."),
    textRun("One day this whole town will know my name. Today it's 'the other one.' Fine."),
    textRun("I don't do warm-ups. I arrive brilliant."),
    textRun('Founding mascot. FOUNDING. He waved at a login page and they gave him a title.'),
    textRun('My five-year plan is center stage. My five-century plan is also center stage.'),
    textRun(
      'History remembers a playwright who died before his rival got famous. Anyway. No reason.',
    ),
    textRun('Click Bill for encouragement. Click me to hear the truth, beautifully delivered.'),
    textRun('I keep my rejection letter framed. Motivation is motivation.'),
    textRun(
      'You clicked me first today. I rehearsed being gracious about this — give me a moment.',
    ),
    textRun("When the curtain finally rises on my lead role, act surprised. I won't."),
    textRun(
      'They say I might have been a spy in a past life. I neither confirm nor deny. Mystique.',
    ),
    textRun(
      'The Understudy and the Stand-In on one stage. Somewhere a playwright is laughing at us both.',
    ),
  ],
  footer: dockFooter('Kit', KIT_FOOTER_TAIL),
  selectable: true,
};

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
    textRun(
      "I used to kill at court, you know. Standing ovations. Kings weeping. ...You'll take my word for it.",
    ),
    textRun("Don't get attached. I'm told I'm temporary. The skull agrees."),
    textRun('Alas, poor me. I knew me well.'),
    textRun('Infinite jest, they said. INFINITE. And yet here I am, finite-ly employed.'),
    textRun(
      "One day they'll cast this role properly and I'll be forgotten. Ahead of schedule, honestly.",
    ),
  ],
  selectable: false,
};

export const COMPANY_MASCOTS: Readonly<Record<CompanyCharacterId, CompanyMascot>> = {
  bill: BILL,
  kit: KIT,
  yorick: YORICK,
};

export const COMPANY_MASCOT_ORDER: readonly CompanyCharacterId[] = COMPANY_CHARACTER_IDS;

export function isCompanyCharacterId(x: unknown): x is CompanyCharacterId {
  return typeof x === 'string' && (COMPANY_CHARACTER_IDS as readonly string[]).includes(x);
}

export function isSelectableCompanion(id: CompanyCharacterId): id is SelectableCompanionId {
  return COMPANY_MASCOTS[id].selectable;
}

export function getCompanyMascot(id: CompanyCharacterId): CompanyMascot {
  return COMPANY_MASCOTS[id];
}

export const COMPANION_SWITCH_EXCHANGES: Readonly<
  Record<SelectableCompanionId, readonly CompanionSwitchExchange[]>
> = {
  kit: [
    {
      outgoing: {
        id: 'bill',
        line: "Kit?! ...No, it's fine. It's fine. I'll be in the wings. Rehearsing. Alone.",
      },
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
      outgoing: {
        id: 'kit',
        line: 'I was BRILLIANT and you choose the stick figure with the cap.',
      },
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

export const SIGNED_OUT_DOCK_LINES: readonly string[] = [
  "The show's inside — and it's free. No ads, just an email.",
  "I'd introduce you to the whole Company, but you'll need a ticket. Tickets are free.",
  'Everything in this town is made by real people. Come see.',
];

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

export const SITE_TOUR_ANCHORS = ['homeAndHelp', 'accountArea', 'dock', 'pageActions'] as const;
export type SiteTourAnchor = (typeof SITE_TOUR_ANCHORS)[number];

export interface SiteTourLine {
  speaker: CompanyCharacterId;
  text: string;
}

export interface SiteTourStepCopy {
  anchor: SiteTourAnchor;
  speaker: CompanyCharacterId;
  heading: string;
  body: readonly string[];
}

export const SITE_TOUR_INVITATION_LINES: readonly SiteTourLine[] = [
  {
    speaker: 'bill',
    text: 'Welcome to TTT, Curtainfolk! Before the curtain rises, may we show you the few controls that will help you find your way around?',
  },
  { speaker: 'kit', text: 'Four quick stops. He rehearsed twelve.' },
  { speaker: 'yorick', text: 'I was told there would be snacks.' },
];

export const SITE_TOUR_STEPS: readonly SiteTourStepCopy[] = [
  {
    anchor: 'homeAndHelp',
    speaker: 'bill',
    heading: "TTT brings you home. Help is where you look when you're lost.",
    body: [
      'TTT always returns you to Center Stage. Help opens the Backstage Guide, where you can learn how the theatre works and replay this tour.',
    ],
  },
  {
    anchor: 'accountArea',
    speaker: 'kit',
    heading: 'Most of the theatre waits behind your account menu.',
    body: ['Use it to visit The Town, open Your Corner, change settings, or sign out.'],
  },
  {
    anchor: 'dock',
    speaker: 'yorick',
    heading:
      'Your companion lives here. Click them for a little company—or hide them from the notification tray when you need some quiet.',
    body: [
      'The tray also lets you reduce motion across the whole theatre while keeping your companion visible and still.',
      'The bell opens notifications. After you scroll down a page, an arrow appears to carry you back to the top.',
      'I am, apparently, not eligible for the companion position.',
    ],
  },
  {
    anchor: 'pageActions',
    speaker: 'kit',
    heading: 'Some pages place their special actions in this corner.',
    body: [
      'You may find controls for creating something, reviewing activity, or performing another action unique to that page. If the corner is empty, there is nothing waiting for you there.',
    ],
  },
];

export const SITE_TOUR_CURTAIN_CALL_LINES: readonly SiteTourLine[] = [
  {
    speaker: 'bill',
    text: 'That is the whole house. You can revisit this tour from Help whenever you need it.',
  },
  { speaker: 'kit', text: 'Four stops. Barely an epic.' },
  { speaker: 'yorick', text: 'I still think we missed the refreshments.' },
];

export const SITE_TOUR_TOTAL_STEPS = SITE_TOUR_STEPS.length;
