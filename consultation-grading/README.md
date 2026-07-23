# Consultation Call Grading

A running record of Becky's new-patient phone consultations, transcribed and
scored against a fixed rubric so we can trend performance and reverse-engineer
a winning script.

**Standing goal: a rolling average of 80/100 or above.** Every new call gets
measured against that bar and the tracker shows the trend.

## What's here

```
consultation-grading/
├── README.md            ← you are here
├── scorecard.md         ← the canonical rubric (v2). Grade every call against this.
├── SUMMARY.md           ← running score tracker + rolling average vs the 80 target
├── BRIEFING-*.md        ← periodic one-page owner briefings (findings + action steps)
├── transcripts/         ← one markdown transcript per call (YYYY-MM-DD-<child>.md)
└── grades/              ← one graded report per call (same filename as its transcript)
```

## The rubric

`scorecard.md` is the 100-point instrument. The headline rule: **the call sells a
paid $67 new-patient exam and collects the deposit — it never quotes the
$3k–$6k treatment-plan price.** The plan price is deflected to the Report-of-
Findings (RoF) video the family watches at home after the exam. Quoting the plan
price on the call is a near-automatic fail (−20).

## Adding a new call (repeatable workflow)

**Owner's side: drop the audio file(s) into the chat and say "transcribe + grade."**
Everything below is what Claude does with it, every time:

1. **Transcribe** via the Descript MCP integration (`import_media` with one media
   entry per call → upload via PUT → `wait_for_job` → `export_transcript`,
   markdown, speaker labels on changes). One composition per call — never let
   multiple calls concatenate onto one timeline. Keep the output verbatim.
2. **Save the transcript** to `transcripts/YYYY-MM-DD-<child>.md`, with a header
   block (rep, prospect, source, length, audio filename, outcome, price-quoted
   flag) and speaker labels normalized to **Becky** / **Mom** (or caller's role).
   **Redact card numbers, expirations, and DOBs.**
3. **Grade** against `scorecard.md`. Save to `grades/<same-filename>.md` with:
   the per-dimension table, the deductions table with quoted evidence, the final
   score + band, what-to-keep, and leak points to fix.
4. **Update `SUMMARY.md`** — add a row, refresh the rolling average vs the
   80-point target, and update the trend notes.
5. **Deliver a summary in chat**: score + band per call, the key moments (with
   quotes), and **2–4 concrete action steps** to move the average toward 80.
   Flag any live-deal follow-ups (unfunded bookings, promised callbacks) and any
   out-of-rubric compliance issues.
6. **Commit and push** to the working branch.

## Grade bands (from the rubric)

- **90–100** — Closer. Goes in the script.
- **75–89** — Strong, one or two leak points.
- **60–74** — Booking may happen but leaking money; show risk high.
- **Below 60** — Functioning as a friendly info line, not a sales conversation.

## ⚠️ Privacy note

These transcripts contain real prospective-patient names and children's health
details. This lives in the private internal repo only. If it ever needs wider
sharing, anonymize names first. The `<child>` in filenames uses first names only;
card numbers and other PII are redacted in the transcripts.
