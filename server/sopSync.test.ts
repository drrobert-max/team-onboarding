import { describe, it, expect } from "vitest";
import { sopComparisonKey } from "./googleDrive";

// Two exports of the SAME unchanged Google Doc: Google shuffles its generated
// class names and re-signs image URLs between exports (observed live — see the
// weekly "43 SOPs updated" false alarms). These must compare EQUAL.
const exportA =
  '<style>.c1{border-right-style:solid}.c0{color:#000000;font-weight:700}</style>' +
  '<p class="c0"><span class="c1">Check the practice member in.</span></p>' +
  '<img src="https://lh7.googleusercontent.com/abc?token=111" class="c5">';
const exportB =
  '<style>.c3{border-right-style:solid}.c1{color:#000000;font-weight:700}</style>' +
  '<p class="c1"><span class="c3">Check the practice member in.</span></p>' +
  '<img src="https://lh7.googleusercontent.com/abc?token=999" class="c2">';

describe("sopComparisonKey — volatile Google export noise", () => {
  it("treats shuffled class names + re-signed image URLs as unchanged", () => {
    expect(sopComparisonKey(exportA)).toBe(sopComparisonKey(exportB));
  });

  it("still detects a real text edit", () => {
    const edited = exportB.replace("Check the practice member in.", "Check the practice member in twice.");
    expect(sopComparisonKey(exportA)).not.toBe(sopComparisonKey(edited));
  });

  it("still detects a structural edit (new row/paragraph)", () => {
    const edited = exportB + '<p><span>New step added.</span></p>';
    expect(sopComparisonKey(exportA)).not.toBe(sopComparisonKey(edited));
  });

  it("ignores whitespace-only churn", () => {
    expect(sopComparisonKey("<p>Hello   world</p>")).toBe(sopComparisonKey("<p>Hello world</p>\n"));
  });

  // Google rewrites hyperlinks through google.com/url with per-export ust=
  // (timestamp) and usg= (signature) params — observed changing between two
  // exports of the same unchanged doc.
  it("ignores re-signed link redirect params but detects a changed link target", () => {
    const linkA = '<a href="https://www.google.com/url?q=https://example.com/guide&amp;sa=D&amp;source=editors&amp;ust=1785772787056504&amp;usg=AOvVaw3F38sGiyXHqgi6hB82PQMj">Guide</a>';
    const linkB = '<a href="https://www.google.com/url?q=https://example.com/guide&amp;sa=D&amp;source=editors&amp;ust=1785772790519458&amp;usg=AOvVaw12vL-sDdeO8bxNtdUmW2SC">Guide</a>';
    const linkC = linkB.replace("example.com/guide", "example.com/other-guide");
    expect(sopComparisonKey(linkA)).toBe(sopComparisonKey(linkB));
    expect(sopComparisonKey(linkA)).not.toBe(sopComparisonKey(linkC));
  });
});
