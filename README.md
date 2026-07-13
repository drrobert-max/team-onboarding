# Reformation Training Hub

Internal training platform for Reformation Chiropractic — SOP library, learning
tracks, modules, quizzes, video submissions and progress tracking.

Originally built on the [Manus](https://manus.im) platform, this repo has been
**migrated to run anywhere** (Node + MySQL). All Manus-only services were
replaced with standard, self-hostable equivalents.

## Tech stack

- **Frontend:** React 19, Vite, Tailwind CSS, Radix UI, wouter, TanStack Query
- **API:** Express + tRPC v11
- **Database:** MySQL via Drizzle ORM (migrations in `drizzle/`)
- **Auth:** email + password (bcrypt) with signed JWT session cookies
- **LLM:** any OpenAI-compatible Chat Completions API
- **Storage:** any S3-compatible bucket (AWS S3, Cloudflare R2, MinIO…)
- **Email:** Gmail via nodemailer (password resets, notifications)

> ⚠️ This is a full-stack app with a live server and database. It **cannot** be
> hosted on GitHub Pages (static-only). Deploy the Node server + a MySQL
> database to a host like Railway (below).

## What changed in the Manus → self-host migration

| Manus service | Replacement | Configured by |
|---|---|---|
| `forge.manus.im` LLM | OpenAI-compatible endpoint | `LLM_*` |
| Forge storage presign | Native S3 presigned URLs (`server/_core/s3.ts`) | `S3_*` |
| Manus notification service | Email to owner via nodemailer | `GMAIL_*`, `OWNER_EMAIL` |
| Manus "heartbeat" cron | In-process `node-cron` scheduler | `ENABLE_CRON` |
| Manus OAuth | Email/password auth (already present) | `JWT_SECRET` |
| `vite-plugin-manus-runtime`, debug collector | removed | — |

## Local development

Requires Node ≥ 20.11 and pnpm 10, plus a reachable MySQL database.

```bash
pnpm install
cp .env.example .env      # then fill in values (see below)
pnpm db:push              # generate + apply migrations to your DB
pnpm dev                  # http://localhost:3000
```

Production build:

```bash
pnpm build                # vite build (client) + esbuild (server) -> dist/
pnpm start                # NODE_ENV=production node dist/index.js
```

## Environment variables

See [`.env.example`](./.env.example) for the full annotated list. The essentials:

- `JWT_SECRET` — long random string for session cookies
- `DATABASE_URL` — MySQL connection string
- `RUN_MIGRATIONS=true` — apply migrations automatically on boot
- `LLM_BASE_URL` / `LLM_API_KEY` / `LLM_MODEL` — LLM provider
- `S3_BUCKET` / `S3_REGION` / `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` — storage
- `GMAIL_USER` / `GMAIL_APP_PASSWORD` — outbound email

## Deploy to Railway

1. **Push this repo to GitHub** (see below), then in Railway: **New Project →
   Deploy from GitHub repo** and pick it. `railway.json` configures the build
   (`pnpm build`), start (`pnpm start`) and `/healthz` health check.
2. **Add a MySQL database:** in the project, **New → Database → MySQL**. Railway
   exposes its connection URL as a variable.
3. **Set variables** on the app service (from `.env.example`):
   - `DATABASE_URL` → reference the MySQL plugin's URL
   - `RUN_MIGRATIONS=true` (applies the 21 migrations on first boot)
   - `JWT_SECRET`, `LLM_*`, `S3_*`, `GMAIL_*`, `OWNER_EMAIL`
   - `ENABLE_CRON=true` if you want the weekly Google Drive syncs to run
4. **Deploy.** On boot the server runs pending migrations, then serves the app.

### Data migration notes (moving off Manus)

- **Database:** export your data from the Manus MySQL database and import it into
  the new one. The schema is identical (same Drizzle migrations).
- **Media assets:** files were stored under `/manus-storage/<key>`. Copy the
  existing objects into your new S3 bucket under the same keys so the stored
  `/manus-storage/...` URLs keep resolving (they're now streamed from S3). This
  includes UI assets referenced in the client (logo, PWA icons, favicon).

## Project layout

```
client/        React app (Vite root)
server/        Express + tRPC server
  _core/       infrastructure: env, s3, llm, sdk (sessions), migrate, index
  routers.ts   tRPC procedures
  db.ts        Drizzle query helpers
shared/        code shared between client and server
drizzle/       schema + SQL migrations
```
