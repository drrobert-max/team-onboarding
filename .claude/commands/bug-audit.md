---
description: Weekly bug audit — sweep for defects, fix the safe ones, open a PR for review.
---

You are running the **weekly bug audit** for the Reformation Training Hub. Work
on a fresh branch off the latest `main`, and **open a PR for review — never push
to `main` directly** (pushing `main` deploys straight to production).

## 1. Set up
- `git fetch origin main` and branch from it: `git checkout -B claude/weekly-audit-$(date +%Y%m%d) origin/main`.
- Confirm the app is healthy to start: `pnpm check`, `pnpm build`, `pnpm test` should all pass. If any already fail on a clean `main`, that itself is finding #1.

## 2. Audit checklist
Sweep the codebase for these defect classes (the ones that have actually bitten this app before):

1. **Missing query invalidation** (CLAUDE.md #3). Every `useMutation` that changes data must `invalidate()`/`refetch()` its query (or refresh via a callback). Flag any that don't → "page doesn't refresh" bugs.
2. **Argument-order bugs.** Check call sites against function signatures — especially the `email` helpers in `server/emailAuth.ts` (`sendWelcomeEmail`, `send*Email`), where `(toEmail, toName, …)` has been swapped before.
3. **Timezone / date handling.** All displayed dates/times must go through the Eastern helpers (`etDate`/`etDateTime`/`etHour` in `client/src/lib/utils.ts`). Flag raw `new Date(x).toLocaleString()` / `.toLocaleDateString()` / `getHours()` in user-facing code. Do **not** wrap the test-out date display — it's a calendar day built from Y/M/D and is intentionally timezone-independent.
4. **Hooks after an early return** (CLAUDE.md #1 — causes React #310 crashes). In page components, every hook must sit above any conditional `return`.
5. **Division by zero / empty collections.** Guard `x / arr.length`, `arr[0]`, non-null assertions on `.find()`.
6. **Nav pattern** (CLAUDE.md #2). Prefer wouter `<Link href>` over `onClick={() => setLocation(...)}` for navigation (lower priority — note it, don't mass-rewrite unless asked).
7. **Leftover debug code / logged PII.** `console.log('[DEBUG …]')`, especially anything logging user emails/IDs.
8. **Lazy-loaded routes** (CLAUDE.md #4) and **no hardcoded ports** (CLAUDE.md #5).
9. **LLM usage stays bounded** (CLAUDE.md #7) — no new unbounded/looping LLM calls.

Use `Grep`/`Glob` to sweep, then read the suspects to confirm — report only *verified* issues, not speculation.

## 3. Fix policy
- **Fix** clear, low-risk bugs (missing invalidation, arg swaps, guards, timezone helper usage, debug cleanup) and add/adjust a test where it's cheap.
- **Do NOT** undertake large refactors, schema/migration changes, or anything architecturally significant on the weekly pass — list those as recommendations instead.
- Re-run `pnpm check`, `pnpm build`, `pnpm test` after fixes; they must pass.

## 4. Deliver
- Commit with a clear message and the standard trailers, push the branch, and open a **PR** titled `Weekly bug audit — <date>`.
- In the PR body: list what was **fixed**, and a separate section of **findings that need a human decision** (with file:line and impact). If nothing needed fixing, say so plainly and still note anything worth watching.
- **Do not merge.** Leave it for Dr. Robert to review. Post a one-paragraph summary of the audit result as your final message.
