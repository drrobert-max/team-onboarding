# Consultation Call Grading

A running record of Becky's new-patient phone consultations, transcribed and
scored against a fixed rubric so we can trend performance and reverse-engineer
a winning script.

## What's here

```
consultation-grading/
├── README.md         ← you are here
├── scorecard.md      ← the canonical rubric (v2). Grade every call against this.
├── SUMMARY.md        ← running score tracker across all calls
├── transcripts/      ← one markdown transcript per call (YYYY-MM-DD-<child>.md)
└── grades/           ← one graded report per call (same filename as its transcript)
```

## The rubric

`scorecard.md` is the 100-point instrument. The headline rule: **the call sells a
paid $67 new-patient exam and collects the deposit — it never quotes the
$3k–$6k treatment-plan price.** The plan price is deflected to the Report-of-
Findings (RoF) video the family watches at home after the exam. Quoting the plan
price on the call is a near-automatic fail (−20).

## Adding a new call (repeatable workflow)

When new recordings come in, the process each time is:

1. **Transcribe.** The two seed calls were transcribed with the Descript MCP
   integration (`import_media` → upload → `export_transcript`). Any accurate
   speech-to-text works; keep the output verbatim.
2. **Save the transcript** to `transcripts/YYYY-MM-DD-<child>.md`, with a header
   block (rep, prospect, source, length, audio filename, outcome) and speaker
   labels normalized to **Becky** / **Mom** (or the caller's role).
3. **Grade** against `scorecard.md`. Save to `grades/<same-filename>.md` with:
   the per-dimension table, the deductions table with quoted evidence, the final
   score + band, and coaching priorities.
4. **Update `SUMMARY.md`** — add a row and refresh the trend notes.

> Just drop the audio into the chat and ask for "transcribe + grade" — the two
> seed calls in here are the format to match.

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
