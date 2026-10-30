import type { GameStatEvent, GameStatEventType } from '../doc-schemas/game-stats.js';
import type { StatCounterKey } from '../types/sports.js';
import type { ScoringPanelKind } from '../types/stats.js';
import type { GamePlayerLine, GameTeamLine } from './scoring.js';
import { isStatCorrection, isStatVoid } from './scoring.js';

export interface StatEventNameResolver {
  readonly player: (userId: string) => string;
  readonly team: (teamId: string) => string;
}

export interface StatEventLabel {
  readonly button: string;
  readonly play: string;
}

export interface StatFieldLabels<
  TeamField extends StatCounterKey,
  PlayerField extends StatCounterKey,
> {
  readonly team: Readonly<Record<TeamField, string>>;
  readonly player: Readonly<Record<PlayerField, string>>;
}

export interface ScoreboardFigure {
  readonly id: string;
  readonly label: string;
  readonly value: (teamLine: GameTeamLine, sideLines: readonly GamePlayerLine[]) => number;
}

export interface Scoreboard {
  readonly figures: readonly ScoreboardFigure[];
  readonly jumpBall: boolean;
  readonly roundSlots?: (teamLine: GameTeamLine) => readonly (number | null)[];
}

export interface RoundsDisplay {
  readonly count: number;
  readonly label: string;
}

export interface PlayerEventsScoringPanel {
  readonly kind: Extract<ScoringPanelKind, 'playerEvents'>;
  readonly playerEventTypes: readonly GameStatEventType[];
  readonly assistableEventTypes: readonly GameStatEventType[];
  readonly teamEventTypes: readonly GameStatEventType[];
}

export interface TeamPointsScoringPanel {
  readonly kind: Extract<ScoringPanelKind, 'teamPoints'>;
  readonly eventTypes: readonly GameStatEventType[];
}

export interface RoundsScoringPanel {
  readonly kind: Extract<ScoringPanelKind, 'rounds'>;
  readonly scoreEventType: GameStatEventType;
  readonly blankEventType: GameStatEventType;
  readonly maxPoints: number;
}

export type ScoringPanel = PlayerEventsScoringPanel | TeamPointsScoringPanel | RoundsScoringPanel;

export function formatSignedValue(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

export const VOID_PLAY_DESCRIPTION = 'Undo of an earlier play';

export function describeStoreEvent(
  event: GameStatEvent,
  resolve: StatEventNameResolver,
  fieldLabels: {
    readonly team: Partial<Record<StatCounterKey, string>>;
    readonly player: Partial<Record<StatCounterKey, string>>;
  },
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
