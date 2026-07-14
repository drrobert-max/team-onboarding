# Reformation Training Hub — guide for Claude Code sessions

Internal training platform for Reformation Chiropractic (SOPs, learning
tracks, quizzes, video submissions). Read this before making changes.

## ⚠️ The #1 thing to know

**Pushing to `main` deploys straight to production.** Railway watches this
repo and auto-deploys every push to `main` at
https://team-onboarding-production.up.railway.app — real staff use it.

- For anything non-trivial, work on a branch and open a PR instead of
  pushing `main` directly.
- Before any push to `main`, ALL of these must pass locally:
  `pnpm check` (typecheck), `pnpm build`, `pnpm test`.

## Stack

- **Client:** React 19 + Vite + Tailwind 4 + Radix/shadcn, wouter routing,
  tRPC + TanStack Query. Lives in `client/`, path alias `@/` → `client/src`.
- **Server:** Express + tRPC v11. Entry: `server/_core/index.ts`.
  Procedures: `server/routers.ts` (~1,600 lines). DB helpers: `server/db.ts`.
- **DB:** MySQL via Drizzle. Schema `drizzle/schema.ts`, SQL migrations in
  `drizzle/`. Migrations run automatically on boot when `RUN_MIGRATIONS=true`
  (see `server/_core/migrate.ts`) — to change schema: edit schema.ts, run
  `pnpm db:generate`, commit the new SQL file, deploy.
- **Auth:** email/password (bcrypt) + JWT session cookie. No public signup —
  admins create users (`users.createUser`). First-admin bootstrap endpoint
  exists but permanently refuses once any admin exists.
- **History:** this app was migrated off the Manus platform. LLM, storage,
  notifications, and cron were re-pointed to standard services (env-driven).
  If you find `manus`-flavored leftovers, they're safe to clean up — but the
  `/manus-storage/*` route is LIVE (it proxies S3 and stored URLs use it).

## Environment variables (set in Railway, documented in .env.example)

Required: `DATABASE_URL`, `JWT_SECRET`, `RUN_MIGRATIONS=true`.
Feature-gated (silently dormant if unset): `LLM_API_KEY`/`LLM_BASE_URL`/
`LLM_MODEL` (quiz generation), `S3_*` (uploads + media), `GMAIL_USER`/
`GMAIL_APP_PASSWORD` (emails), `ENABLE_CRON=true` (weekly Google Drive syncs),
`GOOGLE_API_KEY` (library video sync).

## Conventions & gotchas (each of these caused a real bug)

1. **Hooks above early returns.** Pages crash with React #310 when a
   `return` sits between hooks (see MyTrack.tsx for the pattern + comment).
2. **Navigation uses real links.** Use wouter `<Link href>`, never
   `onClick={() => setLocation(...)}` buttons for nav.
3. **Every mutation invalidates its query.** Pattern:
   `useMutation({ onSuccess: () => utils.<router>.<query>.invalidate() })`.
   Missing invalidation = "page doesn't refresh" bugs.
4. **All routes are lazy-loaded** in `client/src/App.tsx`. Add new pages via
   `lazy(() => import(...))` — never a static import (keeps initial JS small).
5. **The server listens on `process.env.PORT`** (Railway injects 8080; the
   public domain targets 8080). Don't hardcode ports.
6. **Scheduled jobs** (`server/scheduledSopSync.ts`, `scheduledLibrarySync.ts`)
   fetch Google Docs via the public export URL — docs must be shared
   "anyone with link: viewer". No Google SDK, no LLM tokens.
7. **LLM calls**: only quiz generation uses the LLM, and results are cached
   in the DB (one call per module, ever). Keep it that way — the owner wants
   near-zero token spend. Never add unbounded/looping LLM calls.
8. **Static caching**: hashed files under `/assets/` are served immutable for
   1 year (`server/_core/vite.ts`). Never emit un-hashed JS/CSS into assets.

## Commands

```bash
pnpm install          # needs pnpm 10, Node >= 20.11
pnpm dev              # local dev server (needs DATABASE_URL in .env)
pnpm check            # typecheck — must pass before push
pnpm build            # client + server production build
pnpm test             # vitest — must pass before push
pnpm db:generate      # create migration from schema.ts changes
```

## Deploy / infra

- Railway project: service `team-onboarding` + `MySQL` database.
- `railway.json` defines build/start/healthcheck (`/healthz`).
- Deploy logs are the first place to look when production misbehaves —
  boot prints `[Migrate] ...` then `Server running on ...`.
