import { describe, expect, it } from "vitest";
import { computeLevel, computeBadges, nextStreak, displayStreak, XP_PER_LEVEL } from "./gamification";

describe("computeLevel", () => {
  it("starts at level 1 with zero xp", () => {
    const l = computeLevel(0);
    expect(l.level).toBe(1);
    expect(l.rank).toBe("Intern");
    expect(l.xpIntoLevel).toBe(0);
    expect(l.xpToNext).toBe(XP_PER_LEVEL);
  });

  it("levels up at each threshold", () => {
    expect(computeLevel(XP_PER_LEVEL).level).toBe(2);
    expect(computeLevel(XP_PER_LEVEL * 3).level).toBe(4);
    expect(computeLevel(XP_PER_LEVEL * 3).rank).toBe("Associate");
  });

  it("reports progress within a level", () => {
    const l = computeLevel(XP_PER_LEVEL + 150);
    expect(l.level).toBe(2);
    expect(l.xpIntoLevel).toBe(150);
    expect(l.xpToNext).toBe(XP_PER_LEVEL - 150);
  });
});

describe("computeBadges", () => {
  it("marks the first-module badge earned after one completion", () => {
    const badges = computeBadges({ completed: 1, total: 60, week1Total: 7, week1Done: 1, streak: 0 });
    const first = badges.find(b => b.id === "first")!;
    expect(first.earned).toBe(true);
  });

  it("only earns Track Champion at full completion", () => {
    const partial = computeBadges({ completed: 30, total: 60, week1Total: 7, week1Done: 7, streak: 3 });
    const done = computeBadges({ completed: 60, total: 60, week1Total: 7, week1Done: 7, streak: 3 });
    expect(partial.find(b => b.id === "champion")!.earned).toBe(false);
    expect(done.find(b => b.id === "champion")!.earned).toBe(true);
  });

  it("caps badge progress at the target", () => {
    const badges = computeBadges({ completed: 100, total: 60, week1Total: 7, week1Done: 7, streak: 20 });
    const champion = badges.find(b => b.id === "champion")!;
    expect(champion.progress).toBe(60);
  });
});

describe("streak math", () => {
  it("increments on a consecutive day", () => {
    expect(nextStreak("2026-07-20", 5, "2026-07-21")).toBe(6);
  });
  it("stays the same on the same day", () => {
    expect(nextStreak("2026-07-21", 5, "2026-07-21")).toBe(5);
  });
  it("resets after a gap", () => {
    expect(nextStreak("2026-07-18", 5, "2026-07-21")).toBe(1);
  });
  it("displays 0 once the streak has lapsed", () => {
    expect(displayStreak("2026-07-18", 5, "2026-07-21")).toBe(0);
    expect(displayStreak("2026-07-20", 5, "2026-07-21")).toBe(5);
  });
});
