import { describe, expect, it } from "vitest";
import { planTestOutSlot } from "./buildTestOuts";

// Milestones as the track stores them: in sortOrder, which is the order the
// /test-outs page unlocks them in.
const track = [
  { id: 1, title: "Week 1 — Practice Philosophy", weekNumber: 1 },
  { id: 2, title: "Week 1 Check-In", weekNumber: 1 },
  { id: 3, title: "Week 7 — Clinical Protocols", weekNumber: 7 },
  { id: 4, title: "Week 12 — Care Plans", weekNumber: 12 },
  { id: 5, title: "Week 12 Test Out — Care Plans", weekNumber: 12 },
];

describe("planTestOutSlot", () => {
  it("reuses the week's own test-out whatever it is titled", () => {
    expect(planTestOutSlot(track, 12)).toEqual({ kind: "existing", milestoneId: 5 });
    // "Check-In" counts as a test-out too.
    expect(planTestOutSlot(track, 1)).toEqual({ kind: "existing", milestoneId: 2 });
  });

  it("slots a new test-out in week order, not at the end of the chain", () => {
    // Week 7 has only a training milestone, so a test-out is created after it
    // (index 3) — ahead of Week 12, which unlocks later.
    expect(planTestOutSlot(track, 7)).toEqual({ kind: "create", index: 3 });
  });

  it("puts a week earlier than everything at the front", () => {
    expect(planTestOutSlot(track.slice(2), 2)).toEqual({ kind: "create", index: 0 });
  });

  it("appends when the week is past every milestone", () => {
    expect(planTestOutSlot(track, 90)).toEqual({ kind: "create", index: 5 });
  });

  it("ignores a training milestone in the same week", () => {
    const noTestOut = [{ id: 9, title: "Week 7 — Clinical Protocols", weekNumber: 7 }];
    expect(planTestOutSlot(noTestOut, 7)).toEqual({ kind: "create", index: 1 });
  });
});
