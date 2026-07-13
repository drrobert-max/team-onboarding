/**
 * Centralized environment configuration.
 *
 * This app was migrated off the Manus platform. The Manus-specific "forge"
 * endpoints have been replaced with standard, self-hostable equivalents:
 *   - LLM      -> any OpenAI-compatible Chat Completions API (LLM_* vars)
 *   - Storage  -> S3-compatible object storage (S3_* vars)
 *   - Auth     -> email/password (see server/emailAuth.ts) + JWT session
 *
 * Legacy BUILT_IN_FORGE_* / OPENAI_API_KEY names are still read as fallbacks
 * so existing deployments keep working during the transition.
 */
export const ENV = {
  appId: process.env.VITE_APP_ID ?? "reformation-training",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  publicBaseUrl: process.env.PUBLIC_BASE_URL ?? process.env.APP_URL ?? "",

  // ─── LLM (OpenAI-compatible Chat Completions API) ──────────────────────────
  llmBaseUrl:
    process.env.LLM_BASE_URL ??
    process.env.BUILT_IN_FORGE_API_URL ??
    "https://api.openai.com",
  llmApiKey:
    process.env.LLM_API_KEY ??
    process.env.OPENAI_API_KEY ??
    process.env.BUILT_IN_FORGE_API_KEY ??
    "",
  llmModel: process.env.LLM_MODEL ?? "gpt-4o-mini",
  llmMaxTokens: parseInt(process.env.LLM_MAX_TOKENS ?? "8192", 10),

  // ─── S3-compatible object storage ──────────────────────────────────────────
  s3Bucket: process.env.S3_BUCKET ?? "",
  s3Region: process.env.S3_REGION ?? process.env.AWS_REGION ?? "us-east-1",
  s3AccessKeyId:
    process.env.S3_ACCESS_KEY_ID ?? process.env.AWS_ACCESS_KEY_ID ?? "",
  s3SecretAccessKey:
    process.env.S3_SECRET_ACCESS_KEY ?? process.env.AWS_SECRET_ACCESS_KEY ?? "",
  // Custom endpoint for non-AWS providers (Cloudflare R2, MinIO, etc.).
  // Leave empty to use AWS S3.
  s3Endpoint: process.env.S3_ENDPOINT ?? "",
  // Some providers (R2/MinIO) need path-style addressing.
  s3ForcePathStyle:
    (process.env.S3_FORCE_PATH_STYLE ?? "").toLowerCase() === "true",
  // Seconds a presigned URL stays valid.
  s3SignedUrlTtl: parseInt(process.env.S3_SIGNED_URL_TTL ?? "3600", 10),

  // ─── Scheduled jobs ────────────────────────────────────────────────────────
  // When "true", the server runs the weekly sync jobs in-process (node-cron).
  enableCron: (process.env.ENABLE_CRON ?? "").toLowerCase() === "true",

  // ─── Legacy Manus aliases (back-compat; prefer the names above) ─────────────
  get forgeApiUrl(): string {
    return this.llmBaseUrl;
  },
  get forgeApiKey(): string {
    return this.llmApiKey;
  },
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
};
