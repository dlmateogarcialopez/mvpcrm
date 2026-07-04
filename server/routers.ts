import {
  ACTIVE_ORG_COOKIE_NAME,
  COOKIE_NAME,
  ONE_YEAR_MS,
} from "@shared/const";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  getActiveOrgCookieOptions,
  getSessionCookieOptions,
} from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { leadsRouter } from "./routers/leads";
import { settingsRouter } from "./routers/settings";
import { automationRouter } from "./routers/automation";
import { pipelineRouter } from "./routers/pipeline";
import { pipelinesRouter } from "./routers/pipelines";
import { permissionsRouter } from "./routers/permissions";
import { organizationsRouter } from "./routers/organizations";
import { dialingRouter } from "./routers/dialing";
import { phoneListsRouter } from "./routers/phoneLists";
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
      const orgCookieOptions = getActiveOrgCookieOptions(ctx.req);
      ctx.res.clearCookie(ACTIVE_ORG_COOKIE_NAME, {
        ...orgCookieOptions,
        maxAge: -1,
      });
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
        ctx.res.cookie(COOKIE_NAME, sessionToken, {
          ...cookieOptions,
          maxAge: ONE_YEAR_MS,
        });

        // Auto-seleccionar org si el usuario pertenece a exactamente una.
        // Si pertenece a varias, el cliente muestra el selector (fase 3).
        // Si no pertenece a ninguna, la UI muestra "Contacta al superadmin".
        const orgs = await db.listOrganizationsForUser(user.id);
        if (orgs.length === 1) {
          const orgCookieOptions = getActiveOrgCookieOptions(ctx.req);
          ctx.res.cookie(ACTIVE_ORG_COOKIE_NAME, String(orgs[0].id), {
            ...orgCookieOptions,
            maxAge: ONE_YEAR_MS,
          });
        }

        return {
          ...user,
          organizations: orgs.map(o => ({
            id: o.id,
            name: o.name,
            slug: o.slug,
            orgRole: o.orgRole,
            displayName: null, // se rellena en el cliente con currentSettings
            primaryColor: null,
          })),
        };
      }),

    createUser: protectedProcedure
      .input(
        z.object({
          name: z.string().min(3),
          email: z.string().email(),
          password: z.string().min(6),
          role: z.enum(appRoleValues),
          permissionIds: z.array(z.number()).optional(),
          organizationId: z.number().int().positive().optional(),
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
            message:
              "Solo un superadministrador puede crear otro superadministrador.",
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

        // Si hay org activa (caso normal multi-tenant), el nuevo
        // usuario se agrega como miembro de esa org. Si no hay
        // org activa, fallback a org=1 (legacy).
        const targetOrgId =
          input.organizationId ?? ctx.activeOrganizationId ?? 1;

        if (input.role === "custom" && input.permissionIds) {
          await db.createCustomUser({
            name: input.name.trim(),
            email: input.email.toLowerCase().trim(),
            passwordHash: pwdHash,
            role: "custom",
            permissionIds: input.permissionIds,
            organizationId: targetOrgId,
            orgRole: "agent",
          });
        } else {
          await db.upsertUser({
            openId: input.email.toLowerCase().trim(),
            name: input.name.trim(),
            email: input.email.toLowerCase().trim(),
            passwordHash: pwdHash,
            role: input.role,
            lastSignedIn: new Date(),
          });
          // Vincular como miembro de la org objetivo
          await db.addMemberToOrganization({
            organizationId: targetOrgId,
            userId: (await db.getUserByEmail(input.email.toLowerCase().trim()))!
              .id,
            orgRole: "agent",
          });
        }

        return { success: true };
      }),
  }),
  leads: leadsRouter,
  settings: settingsRouter,
  automation: automationRouter,
  pipeline: pipelineRouter,
  pipelines: pipelinesRouter,
  permissions: permissionsRouter,
  organizations: organizationsRouter,
  dialing: dialingRouter,
  phoneLists: phoneListsRouter,
});

export type AppRouter = typeof appRouter;
