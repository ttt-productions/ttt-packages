// The team-creation window: a player may create a team in a league until TEAM_CREATION_CUTOFF_DAYS
// days after the league's start date, inclusive. The create-team callable refuses a late creation
// and the league page hides the affordance, both through these two functions (ENG-005). An admin
// creating a team from the admin console is not held to the window.

import { TEAM_CREATION_CUTOFF_DAYS } from '../constants/business.js';
import { addCalendarDays } from './league-calendar.js';

/** The last calendar day a player may create a team in a league that starts on `leagueStartDate`. */
export function teamCreationLastDay(leagueStartDate: string): string {
  return addCalendarDays(leagueStartDate, TEAM_CREATION_CUTOFF_DAYS);
}

/** Whether a player may still create a team on `todayDayKey` (see `toLeagueDayKey`). */
export function isTeamCreationOpen(leagueStartDate: string, todayDayKey: string): boolean {
  return todayDayKey <= teamCreationLastDay(leagueStartDate);
}
