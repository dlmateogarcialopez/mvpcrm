import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { leadsRouter } from "./routers/leads";
import { settingsRouter } from "./routers/settings";
import { automationRouter } from "./routers/automation";
import { hashPassword, verifyPassword } from "./_core/password";
import { sdk } from "./_core/sdk";
import * as db from "./db";
import { appRoleValues } from "../shared/leads";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),

    hasUsers: publicProcedure.query(async () => {
      const count = await db.getUserCount();
      return count > 0;
    }),

    setupAdmin: publicProcedure
      .input(
        z.object({
          name: z.string().min(3),
          email: z.string().email(),
          password: z.string().min(6),
        })
      )
      .mutation(async ({ input }) => {
        const count = await db.getUserCount();
        if (count > 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "El sistema ya está inicializado.",
          });
        }

        const pwdHash = hashPassword(input.password);
        await db.upsertUser({
          openId: input.email.toLowerCase().trim(),
          name: input.name.trim(),
          email: input.email.toLowerCase().trim(),
          passwordHash: pwdHash,
          role: "superadmin",
          lastSignedIn: new Date(),
        });

        return { success: true };
      }),

    login: publicProcedure
      .input(
        z.object({
          email: z.string().email(),
          password: z.string().min(6),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const user = await db.getUserByEmail(input.email);
        if (!user || !user.passwordHash) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Credenciales inválidas.",
          });
        }

        const match = verifyPassword(input.password, user.passwordHash);
        if (!match) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Credenciales inválidas.",
          });
        }

        const sessionToken = await sdk.createSessionToken(user.openId, {
          name: user.name || "",
          expiresInMs: ONE_YEAR_MS,
        });

        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

        return user;
      }),

    createUser: protectedProcedure
      .input(
        z.object({
          name: z.string().min(3),
          email: z.string().email(),
          password: z.string().min(6),
          role: z.enum(appRoleValues),
        })
      )
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== "admin" && ctx.user.role !== "superadmin") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "No tienes permisos para crear colaboradores.",
          });
        }

        if (ctx.user.role === "admin" && input.role === "superadmin") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Solo un superadministrador puede crear otro superadministrador.",
          });
        }

        const existing = await db.getUserByEmail(input.email);
        if (existing) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Ya existe un colaborador con este correo electrónico.",
          });
        }

        const pwdHash = hashPassword(input.password);
        await db.upsertUser({
          openId: input.email.toLowerCase().trim(),
          name: input.name.trim(),
          email: input.email.toLowerCase().trim(),
          passwordHash: pwdHash,
          role: input.role,
          lastSignedIn: new Date(),
        });

        return { success: true };
      }),
  }),
  leads: leadsRouter,
  settings: settingsRouter,
  automation: automationRouter,
});

export type AppRouter = typeof appRouter;
