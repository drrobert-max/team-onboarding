import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";
import { COOKIE_NAME } from "@shared/const";
import * as db from "../db";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;
  try {
    const cookieHeader = opts.req.headers.cookie;
    const sessionCookie = parseCookies(cookieHeader).get(COOKIE_NAME);
    if (sessionCookie) {
      const session = await sdk.verifySession(sessionCookie);
      if (session && session.openId?.startsWith("email:")) {
        // Email/password user — look up by email
        const email = session.openId.slice("email:".length);
        user = (await db.getUserByEmail(email)) ?? null;
      } else {
        // OAuth user — use standard SDK auth
        user = await sdk.authenticateRequest(opts.req);
      }
    }
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }
  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}

function parseCookies(cookieHeader: string | undefined): Map<string, string> {
  const map = new Map<string, string>();
  if (!cookieHeader) return map;
  for (const part of cookieHeader.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key) map.set(key.trim(), rest.join("=").trim());
  }
  return map;
}