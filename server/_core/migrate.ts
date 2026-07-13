/**
 * Runtime database migrator.
 *
 * Applies the SQL migrations in ./drizzle using drizzle-orm's built-in
 * migrator (a runtime dependency), so migrations can run on deploy without
 * needing the drizzle-kit CLI in production. Triggered at server startup when
 * RUN_MIGRATIONS=true (see server/_core/index.ts).
 */
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import mysql from "mysql2/promise";
import path from "node:path";
import { ENV } from "./env";

export async function runMigrations(): Promise<void> {
  if (!ENV.databaseUrl) {
    throw new Error("DATABASE_URL is required to run migrations");
  }
  const migrationsFolder = path.resolve(process.cwd(), "drizzle");
  console.log(`[Migrate] Applying migrations from ${migrationsFolder} ...`);
  const connection = await mysql.createConnection(ENV.databaseUrl);
  try {
    const db = drizzle(connection);
    await migrate(db, { migrationsFolder });
    console.log("[Migrate] Migrations up to date.");
  } finally {
    await connection.end();
  }
}
