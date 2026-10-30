import { TEAM_CREATION_CUTOFF_DAYS } from '../constants/business.js';
import { addCalendarDays } from './league-calendar.js';

export function teamCreationLastDay(leagueStartDate: string): string {
  return addCalendarDays(leagueStartDate, TEAM_CREATION_CUTOFF_DAYS);
}

export function isTeamCreationOpen(leagueStartDate: string, todayDayKey: string): boolean {
  return todayDayKey <= teamCreationLastDay(leagueStartDate);
}
