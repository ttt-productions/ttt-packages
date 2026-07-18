// Phase 1A proof: the Company contract + content migrated to ttt-core losslessly,
// stays pure data (no React/JSX/functions), and every approved line survives.

import { describe, it, expect } from 'vitest';
import {
  COMPANY_CHARACTER_IDS,
  COMPANY_PERFORMANCE_INTENTS,
  SELECTABLE_COMPANION_IDS,
  COMPANY_MASCOTS,
  COMPANY_MASCOT_ORDER,
  COMPANION_SWITCH_EXCHANGES,
  YORICK_BLOCK_LINES,
  SIGNED_OUT_DOCK_LINES,
  ONBOARDING_CAMEOS,
  isCompanyCharacterId,
  isSelectableCompanion,
  getCompanyMascot,
  type CompanyCopySegment,
  type CompanyMascot,
} from '../src/constants/company-mascots';

const SEGMENT_KINDS = ['text', 'emphasis', 'link'] as const;
const BLOCK_KINDS = ['paragraph', 'aside'] as const;
const NAV_TARGETS = ['greenRoom', 'futurePlans'] as const;

/** Pure, framework-free renderer: flattens a segment run to its rendered text.
 *  emphasis renders its text; link renders its label. */
function renderSegmentsToText(segments: readonly CompanyCopySegment[]): string {
  return segments
    .map((seg) => (seg.kind === 'link' ? seg.label : seg.text))
    .join('');
}

/** Recursively assert a value contains no functions anywhere (pure data). */
function assertNoFunctions(value: unknown, path: string): void {
  expect(typeof value, `function found at ${path}`).not.toBe('function');
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      assertNoFunctions(v, `${path}.${k}`);
    }
  }
}

describe('Company roster + order', () => {
  it('has exactly bill, kit, yorick in billing order', () => {
    expect(COMPANY_CHARACTER_IDS).toEqual(['bill', 'kit', 'yorick']);
  });

  it('COMPANY_MASCOT_ORDER matches the roster', () => {
    expect(COMPANY_MASCOT_ORDER).toEqual(COMPANY_CHARACTER_IDS);
  });

  it('every COMPANY_MASCOTS key equals its record id', () => {
    for (const id of COMPANY_CHARACTER_IDS) {
      expect(COMPANY_MASCOTS[id].id).toBe(id);
    }
  });

  it('has a mascot for every roster id and no extras', () => {
    expect(Object.keys(COMPANY_MASCOTS).sort()).toEqual([...COMPANY_CHARACTER_IDS].sort());
  });

  it('getCompanyMascot returns the record for each id', () => {
    for (const id of COMPANY_CHARACTER_IDS) {
      expect(getCompanyMascot(id)).toBe(COMPANY_MASCOTS[id]);
    }
  });
});

describe('Selectable-companion subset', () => {
  it('is exactly bill and kit', () => {
    expect(SELECTABLE_COMPANION_IDS).toEqual(['bill', 'kit']);
  });

  it('is a subset of the roster', () => {
    for (const id of SELECTABLE_COMPANION_IDS) {
      expect(COMPANY_CHARACTER_IDS).toContain(id);
    }
  });

  it('every selectable id resolves isSelectableCompanion true and has selectable data', () => {
    for (const id of SELECTABLE_COMPANION_IDS) {
      expect(isSelectableCompanion(id)).toBe(true);
      expect(COMPANY_MASCOTS[id].selectable).toBe(true);
    }
  });

  it('yorick is not selectable (data + guard)', () => {
    expect(COMPANY_MASCOTS.yorick.selectable).toBe(false);
    expect(isSelectableCompanion('yorick')).toBe(false);
  });

  it('isSelectableCompanion is internally consistent with the selectable field for the whole roster', () => {
    for (const id of COMPANY_CHARACTER_IDS) {
      expect(isSelectableCompanion(id)).toBe(COMPANY_MASCOTS[id].selectable);
      expect(isSelectableCompanion(id)).toBe(SELECTABLE_COMPANION_IDS.includes(id as never));
    }
  });
});

describe('isCompanyCharacterId', () => {
  it('accepts every roster id', () => {
    for (const id of COMPANY_CHARACTER_IDS) {
      expect(isCompanyCharacterId(id)).toBe(true);
    }
  });

  it('rejects non-members and non-strings', () => {
    expect(isCompanyCharacterId('nobody')).toBe(false);
    expect(isCompanyCharacterId('')).toBe(false);
    expect(isCompanyCharacterId(null)).toBe(false);
    expect(isCompanyCharacterId(42)).toBe(false);
    expect(isCompanyCharacterId(undefined)).toBe(false);
  });
});

describe('Performances', () => {
  it('every mascot shares the three intents with null creditUid', () => {
    for (const id of COMPANY_CHARACTER_IDS) {
      const mascot = COMPANY_MASCOTS[id];
      expect(mascot.performances).toHaveLength(3);
      for (const perf of mascot.performances) {
        expect(COMPANY_PERFORMANCE_INTENTS).toContain(perf.intent);
        expect(typeof perf.id).toBe('string');
        expect(perf.id.length).toBeGreaterThan(0);
        expect(typeof perf.label).toBe('string');
        expect(perf.creditUid).toBeNull();
      }
    }
  });

  it('COMPANY_PERFORMANCE_INTENTS is exactly bow/hop/wave', () => {
    expect(COMPANY_PERFORMANCE_INTENTS).toEqual(['bow', 'hop', 'wave']);
  });
});

describe('Dialogue counts survive migration', () => {
  it('Bill has 14 lines, Kit 14, Yorick 6', () => {
    expect(COMPANY_MASCOTS.bill.lines).toHaveLength(14);
    expect(COMPANY_MASCOTS.kit.lines).toHaveLength(14);
    expect(COMPANY_MASCOTS.yorick.lines).toHaveLength(6);
  });

  it('COMPANION_SWITCH_EXCHANGES has 5 pairs in each direction', () => {
    expect(COMPANION_SWITCH_EXCHANGES.kit).toHaveLength(5);
    expect(COMPANION_SWITCH_EXCHANGES.bill).toHaveLength(5);
  });

  it('YORICK_BLOCK_LINES has 4 lines for each selectable companion', () => {
    expect(YORICK_BLOCK_LINES.bill).toHaveLength(4);
    expect(YORICK_BLOCK_LINES.kit).toHaveLength(4);
  });

  it('SIGNED_OUT_DOCK_LINES has 3 lines', () => {
    expect(SIGNED_OUT_DOCK_LINES).toHaveLength(3);
  });
});

describe('Verbatim line assertions', () => {
  it("Bill line 11 reconstructs exactly, with the emphasis on 'did'", () => {
    const line = COMPANY_MASCOTS.bill.lines[10];
    expect(renderSegmentsToText(line)).toBe(
      "When the curtain rises on my real role, you'll be the first to know. You did click me first.",
    );
    const emphasis = line.filter((seg) => seg.kind === 'emphasis');
    expect(emphasis).toHaveLength(1);
    expect(emphasis[0]).toEqual({ kind: 'emphasis', text: 'did' });
  });

  it('a Kit switch-TO-bill exchange pair is verbatim', () => {
    expect(COMPANION_SWITCH_EXCHANGES.bill[0]).toEqual({
      outgoing: { id: 'kit', line: 'Unbelievable. UNBELIEVABLE.' },
      incoming: { id: 'bill', line: "It's good to be back! ...He'll be alright." },
    });
  });

  it('a curtain-call cameo line is verbatim', () => {
    expect(ONBOARDING_CAMEOS.curtainCall.yorick).toBe("You'll forget me. It's fine. Go.");
    expect(ONBOARDING_CAMEOS.kitAuditionStage).toBe(
      "The Audition Stage. Where stars are born. I was robbed here once — anyway, you'll love it.",
    );
  });
});

describe('Rich-copy segments are exhaustively shaped and pure', () => {
  const allMascots: CompanyMascot[] = COMPANY_CHARACTER_IDS.map((id) => COMPANY_MASCOTS[id]);

  it('every character study block + segment matches the model', () => {
    for (const mascot of allMascots) {
      for (const block of mascot.characterStudy) {
        expect(BLOCK_KINDS).toContain(block.kind);
        for (const seg of block.segments) {
          assertSegmentShape(seg);
        }
      }
    }
  });

  it('every line segment matches the model', () => {
    for (const mascot of allMascots) {
      for (const line of mascot.lines) {
        expect(Array.isArray(line)).toBe(true);
        for (const seg of line) {
          assertSegmentShape(seg);
        }
      }
    }
  });

  it('every footer segment matches the model; Yorick has none', () => {
    expect(COMPANY_MASCOTS.yorick.footer).toBeUndefined();
    for (const id of SELECTABLE_COMPANION_IDS) {
      const footer = COMPANY_MASCOTS[id].footer;
      expect(footer).toBeDefined();
      for (const seg of footer!) {
        assertSegmentShape(seg);
      }
    }
  });

  it('the whole registry + content contains no functions (pure data)', () => {
    assertNoFunctions(COMPANY_MASCOTS, 'COMPANY_MASCOTS');
    assertNoFunctions(COMPANION_SWITCH_EXCHANGES, 'COMPANION_SWITCH_EXCHANGES');
    assertNoFunctions(YORICK_BLOCK_LINES, 'YORICK_BLOCK_LINES');
    assertNoFunctions(SIGNED_OUT_DOCK_LINES, 'SIGNED_OUT_DOCK_LINES');
    assertNoFunctions(ONBOARDING_CAMEOS, 'ONBOARDING_CAMEOS');
  });

  it('is JSON-serializable (no framework/JSX values)', () => {
    expect(() => JSON.stringify(COMPANY_MASCOTS)).not.toThrow();
  });
});

describe('Navigation targets', () => {
  it('every link segment across all copy targets a valid CompanyNavigationTarget', () => {
    const linkSegments: CompanyCopySegment[] = [];
    for (const id of COMPANY_CHARACTER_IDS) {
      const mascot = COMPANY_MASCOTS[id];
      for (const block of mascot.characterStudy) linkSegments.push(...block.segments);
      for (const line of mascot.lines) linkSegments.push(...line);
      if (mascot.footer) linkSegments.push(...mascot.footer);
    }
    for (const seg of linkSegments) {
      if (seg.kind === 'link') {
        expect(NAV_TARGETS).toContain(seg.target);
      }
    }
  });
});

describe('Footers render without a web framework', () => {
  it("Bill's footer flattens to the exact verbatim sentence", () => {
    expect(renderSegmentsToText(COMPANY_MASCOTS.bill.footer!)).toBe(
      'Bill is a basic version for now — one day we hope to make him an AI-powered guide who helps you navigate the site. He’ll never make content, just help.',
    );
  });

  it("Kit's footer flattens to the exact verbatim sentence", () => {
    expect(renderSegmentsToText(COMPANY_MASCOTS.kit.footer!)).toBe(
      'Kit is a basic version for now — one day we hope to make him an AI-powered guide with this exact attitude. He’ll never make content. He does have opinions about yours.',
    );
  });

  it('each footer carries a greenRoom name link and a futurePlans "one day" link', () => {
    for (const id of SELECTABLE_COMPANION_IDS) {
      const footer = COMPANY_MASCOTS[id].footer!;
      const links = footer.filter((seg) => seg.kind === 'link');
      expect(links).toHaveLength(2);
      expect(links[0]).toMatchObject({ kind: 'link', target: 'greenRoom' });
      expect(links[1]).toEqual({ kind: 'link', label: 'one day', target: 'futurePlans' });
    }
  });
});

function assertSegmentShape(seg: CompanyCopySegment): void {
  expect(SEGMENT_KINDS).toContain(seg.kind);
  if (seg.kind === 'link') {
    expect(typeof seg.label).toBe('string');
    expect(NAV_TARGETS).toContain(seg.target);
    expect(Object.keys(seg).sort()).toEqual(['kind', 'label', 'target']);
  } else {
    expect(typeof seg.text).toBe('string');
    expect(Object.keys(seg).sort()).toEqual(['kind', 'text']);
  }
}
