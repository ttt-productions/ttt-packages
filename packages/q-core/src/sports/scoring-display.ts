// What the scoring screen, the scoreboard, and the play-by-play render for a sport, declared by its
// adapter so no shared surface branches on a sport (SPORT-004, SPORT-106). Every label lives here or
// in the adapter, never in a component (ENG-005).

import type { GameStatEvent, GameStatEventType } from '../doc-schemas/game-stats.js';
import type { StatCounterKey } from '../types/sports.js';
import type { ScoringPanelKind } from '../types/stats.js';
import type { GamePlayerLine, GameTeamLine } from './scoring.js';
import { isStatCorrection, isStatVoid } from './scoring.js';

/**
 * Names read at render time (ARCH-103, SPORT-104): a person by user id — a removed ghost resolving to
 * "removed player" — and a team by team id. An event's stored name snapshot is never one of them.
 */
export interface StatEventNameResolver {
  readonly player: (userId: string) => string;
  readonly team: (teamId: string) => string;
}

/** An event type's button label on the scoring panel and its label in the play-by-play. */
export interface StatEventLabel {
  readonly button: string;
  readonly play: string;
}

/** Each field of a team line and of a player line, by label — what a correction row names. */
export interface StatFieldLabels<TeamField extends StatCounterKey, PlayerField extends StatCounterKey> {
  readonly team: Readonly<Record<TeamField, string>>;
  readonly player: Readonly<Record<PlayerField, string>>;
}

/** One figure a team card shows: from the team's game line and the player lines keyed to its side. */
export interface ScoreboardFigure {
  readonly id: string;
  readonly label: string;
  readonly value: (teamLine: GameTeamLine, sideLines: readonly GamePlayerLine[]) => number;
}

/**
 * The one scoreboard every game screen renders: each team's figures, the jump-ball marker where the
 * sport has one, and — for a sport played in rounds — each team's round-by-round grid.
 */
export interface Scoreboard {
  readonly figures: readonly ScoreboardFigure[];
  /**
   * Whether the sport has a jump-ball possession marker: the team cards show it, and the game's
   * scorers set it through its own writer, never a stat event.
   */
  readonly jumpBall: boolean;
  /**
   * Present only for a sport played in rounds: a team line's slot per round, `null` where the round
   * is not recorded, so the grid tells an unplayed round from a scoreless one.
   */
  readonly roundSlots?: (teamLine: GameTeamLine) => readonly (number | null)[];
}

/** A sport played in rounds: how many, and what one is called ("Round n / 14"). */
export interface RoundsDisplay {
  readonly count: number;
  readonly label: string;
}

/** Pick a present player, then tap one of their events; the team row carries the team's own. */
export interface PlayerEventsScoringPanel {
  readonly kind: Extract<ScoringPanelKind, 'playerEvents'>;
  readonly playerEventTypes: readonly GameStatEventType[];
  /** The events that open the assist picker: the team's other present players, and "No assist". */
  readonly assistableEventTypes: readonly GameStatEventType[];
  readonly teamEventTypes: readonly GameStatEventType[];
}

/** One button per event for each team. */
export interface TeamPointsScoringPanel {
  readonly kind: Extract<ScoringPanelKind, 'teamPoints'>;
  readonly eventTypes: readonly GameStatEventType[];
}

/** Each team's +1 through +`maxPoints` for the next round, and one button for a blank round. */
export interface RoundsScoringPanel {
  readonly kind: Extract<ScoringPanelKind, 'rounds'>;
  readonly scoreEventType: GameStatEventType;
  readonly blankEventType: GameStatEventType;
  readonly maxPoints: number;
}

export type ScoringPanel = PlayerEventsScoringPanel | TeamPointsScoringPanel | RoundsScoringPanel;

/** A signed change as a play shows it: `+3`, `-2`. */
export function formatSignedValue(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

export const VOID_PLAY_DESCRIPTION = 'Undo of an earlier play';

/**
 * The play-by-play line of a store-level event, the same for every sport: a correction names the
 * field it moved through the sport's field labels, and never reads as a play. `null` for a sport's
 * own event.
 */
export function describeStoreEvent(
  event: GameStatEvent,
  resolve: StatEventNameResolver,
  fieldLabels: { readonly team: Partial<Record<StatCounterKey, string>>; readonly player: Partial<Record<StatCounterKey, string>> },
): string | null {
  if (isStatVoid(event)) return VOID_PLAY_DESCRIPTION;
  if (!isStatCorrection(event)) return null;
  const labels = event.playerUserId === undefined ? fieldLabels.team : fieldLabels.player;
  const field = labels[event.stat] ?? event.stat;
  const line =
    event.playerUserId === undefined
      ? resolve.team(event.teamId)
      : `${resolve.player(event.playerUserId)} (${resolve.team(event.teamId)})`;
  return `${field} corrected by ${formatSignedValue(event.value)} for ${line}`;
}
