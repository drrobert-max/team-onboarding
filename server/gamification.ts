/**
 * Phase 1 gamification — pure, testable logic. Everything here is derived from
 * data the app already tracks (completed training modules + a daily streak), so
 * there is no separate points ledger to keep in sync.
 *
 * Design notes:
 *  - Only TRAINING modules earn XP. Test-outs are admin-graded and deliberately
 *    left out of the game loop.
 *  - XP is a pure function of completed modules, so it can never drift from
 *    reality: xp = completedModules * XP_PER_MODULE.
 */

export const XP_PER_MODULE = 50;
export const XP_PER_LEVEL = 600;

// Rank names by level (level 1 = first entry). Beyond the list, the last name sticks.
export const RANKS = [
  "Intern",
  "Rookie",
  "Apprentice",
  "Associate",
  "Senior Associate",
  "Lead Clinician",
  "Master Clinician",
  "Legend",
];

export function rankName(level: number): string {
  return RANKS[Math.min(Math.max(level, 1), RANKS.length) - 1];
}

export interface LevelInfo {
  totalXp: number;
  level: number;
  rank: string;
  nextRank: string;
  xpIntoLevel: number;
  xpForLevel: number;
  xpToNext: number;
}

export function computeLevel(totalXp: number): LevelInfo {
  const xp = Math.max(0, Math.floor(totalXp));
  const level = Math.floor(xp / XP_PER_LEVEL) + 1;
  const xpIntoLevel = xp % XP_PER_LEVEL;
  return {
    totalXp: xp,
    level,
    rank: rankName(level),
    nextRank: rankName(level + 1),
    xpIntoLevel,
    xpForLevel: XP_PER_LEVEL,
    xpToNext: XP_PER_LEVEL - xpIntoLevel,
  };
}

export interface BadgeState {
  id: string;
  icon: string;
  name: string;
  desc: string;
  earned: boolean;
  progress: number; // capped at target
  target: number;
}

export interface BadgeInputs {
  completed: number;   // completed training modules
  total: number;       // total training modules
  week1Total: number;  // modules in the Week 1 milestone
  week1Done: number;   // completed of those
  streak: number;      // current daily streak
}

function badge(
  id: string, icon: string, name: string, desc: string, current: number, target: number
): BadgeState {
  const t = Math.max(1, target);
  return { id, icon, name, desc, earned: current >= t, progress: Math.min(current, t), target: t };
}

export function computeBadges(m: BadgeInputs): BadgeState[] {
  const pct = m.total > 0 ? Math.round((m.completed / m.total) * 100) : 0;
  return [
    badge("first", "🚀", "First Steps", "Complete your first module", m.completed, 1),
    badge("rolling", "⚡", "Getting Rolling", "Complete 5 modules", m.completed, 5),
    badge("week1", "📅", "Week One Done", "Finish every Week 1 module", m.week1Done, m.week1Total),
    badge("halfway", "🗓️", "Halfway There", "Reach 50% of your track", pct, 50),
    badge("fire", "🔥", "On Fire", "Reach a 7-day streak", m.streak, 7),
    badge("unstoppable", "💪", "Unstoppable", "Reach a 14-day streak", m.streak, 14),
    badge("champion", "🏆", "Track Champion", "Complete your whole track", m.completed, m.total),
  ];
}

// The practice runs on Eastern time, so streak day boundaries are computed in
// America/New_York (which handles the EST/EDT daylight-saving switch) rather
// than UTC — otherwise a streak would tick over at ~7pm local instead of local
// midnight.
const EASTERN_TZ = "America/New_York";

/** YYYY-MM-DD for a date in Eastern time (the practice's local day boundary). */
export function dayKey(d: Date): string {
  // en-CA formats as YYYY-MM-DD; the timeZone pins the calendar day to Eastern.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: EASTERN_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** The calendar day before a YYYY-MM-DD key. Pure string math (timezone-safe). */
function previousDayKey(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) - 86400000).toISOString().slice(0, 10);
}

/**
 * Given the last active day and the stored streak, return the new streak after
 * activity "today": same day → unchanged; consecutive day → +1; a gap → reset
 * to 1.
 */
export function nextStreak(lastActiveKey: string | null, storedStreak: number, todayKey: string): number {
  if (lastActiveKey === todayKey) return Math.max(1, storedStreak);
  if (lastActiveKey === previousDayKey(todayKey)) return storedStreak + 1;
  return 1;
}

/**
 * The streak to DISPLAY without recording activity: valid only if the last
 * active day was today or yesterday, otherwise the streak has lapsed to 0.
 */
export function displayStreak(lastActiveKey: string | null, storedStreak: number, todayKey: string): number {
  if (!lastActiveKey) return 0;
  if (lastActiveKey === todayKey) return storedStreak;
  if (lastActiveKey === previousDayKey(todayKey)) return storedStreak;
  return 0;
}
