import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";

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
    user = await sdk.authenticateRequest(opts.req);
    if (user) {
      console.log(`[Context] User authenticated: ${user.name} (${user.role})`);
    } else {
      console.log(`[Context] No user found in request`);
    }
  } catch (error: any) {
    const isSessionCookieError = error?.message === "Invalid session cookie";
    if (!isSessionCookieError) {
      console.error(`[Context] Auth error:`, error);
    }
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
