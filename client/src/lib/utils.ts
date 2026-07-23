import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Honorific titles to skip when deriving a first name / initials, so a user
// stored as "Dr. Julia Reyes" is greeted "Julia" (not "Dr.") while keeping the
// full title on their displayed name. Matched case-insensitively, with or
// without a trailing period.
const TITLES = new Set(["dr", "mr", "mrs", "ms", "miss", "prof", "sir", "dra"]);

/** Split a full name into words, dropping a leading honorific title. */
function nameParts(name?: string | null): string[] {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length > 1 && TITLES.has(parts[0].replace(/\.$/, "").toLowerCase())) {
    return parts.slice(1);
  }
  return parts;
}

/** First name for greetings — skips a leading title. Falls back to `fallback`. */
export function firstName(name?: string | null, fallback = "there"): string {
  return nameParts(name)[0] ?? fallback;
}

/** Up-to-two-letter initials for avatars — skips a leading title. */
export function initials(name?: string | null): string {
  const parts = nameParts(name);
  return parts.map(p => p[0]).join("").slice(0, 2).toUpperCase();
}

// ── Eastern time ──────────────────────────────────────────────────────────────
// The practice runs on Eastern time, so all displayed dates/times are formatted
// in America/New_York (which handles the EST/EDT daylight-saving switch) instead
// of the viewer's local timezone — a manager opening the app while traveling
// still sees the practice's clock.
const EASTERN_TZ = "America/New_York";

/** Format a date value in Eastern time. Defaults to "Jul 24, 2026". */
export function etDate(
  value: string | number | Date,
  opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" },
): string {
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { timeZone: EASTERN_TZ, ...opts });
}

/** Format a date+time value in Eastern time. Defaults to "Jul 24, 2:30 PM". */
export function etDateTime(
  value: string | number | Date,
  opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" },
): string {
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("en-US", { timeZone: EASTERN_TZ, ...opts });
}

/** Current hour (0–23) in Eastern time — for the time-of-day greeting. */
export function etHour(): number {
  const s = new Date().toLocaleString("en-US", { timeZone: EASTERN_TZ, hour: "2-digit", hourCycle: "h23" });
  return parseInt(s, 10) || 0;
}
