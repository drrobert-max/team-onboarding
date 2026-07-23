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
