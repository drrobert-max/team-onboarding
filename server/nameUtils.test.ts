import { describe, it, expect } from "vitest";
import { firstName, initials } from "@/lib/utils";

describe("firstName — greeting name skips honorific titles", () => {
  it("drops a leading 'Dr.' (with period)", () => {
    expect(firstName("Dr. Julia Reyes")).toBe("Julia");
  });
  it("drops a leading 'Dr' (no period)", () => {
    expect(firstName("Dr Julia Reyes")).toBe("Julia");
  });
  it("is case-insensitive", () => {
    expect(firstName("mrs. Anita Bell")).toBe("Anita");
  });
  it("keeps a normal first name", () => {
    expect(firstName("Becky Nguyen")).toBe("Becky");
  });
  it("keeps a title-only name as-is (doesn't strip the last word)", () => {
    expect(firstName("Dr")).toBe("Dr");
  });
  it("falls back when empty", () => {
    expect(firstName("")).toBe("there");
    expect(firstName(null, "friend")).toBe("friend");
  });
});

describe("initials — avatar initials skip honorific titles", () => {
  it("uses the real name, not the title", () => {
    expect(initials("Dr. Julia Reyes")).toBe("JR");
  });
  it("handles a single name", () => {
    expect(initials("Becky")).toBe("B");
  });
});
