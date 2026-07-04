import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from "@shared/const";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { appRoleValues } from "../../shared/leads";
import type { TrpcContext } from "./context";
import { assertActiveOrgMembership } from "./orgContext";

const adminRoles = new Set<(typeof appRoleValues)[number]>([
  "admin",
  "superadmin",
]);

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || !adminRoles.has(ctx.user.role)) {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  })
);

export const superadminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== "superadmin") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Solo el superadministrador puede realizar esta acción.",
      });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  })
);

/**
 * Procedure que requiere:
 *  1. Usuario autenticado (requireUser)
 *  2. Membresía activa en la organización de la cookie
 *     `active_org_id` (validada contra la DB)
 *
 * Inyecta `ctx.organizationId: number` garantizado no-nulo
 * para que los handlers no tengan que hacer null-checks.
 *
 * Migración gradual: usar `orgProcedure` para código nuevo
 * y refactorizar routers existentes uno a uno. Los routers
 * que aún usan `protectedProcedure` siguen funcionando
 * pero deben ignorar la cookie (no filtran por org).
 */
export const orgProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
    }

    if (!ctx.activeOrganizationId) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "No hay una organización activa. Selecciona una para continuar.",
      });
    }

    const organizationId = await assertActiveOrgMembership(
      ctx.user.id,
      ctx.activeOrganizationId
    );

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
        organizationId,
      },
    });
  })
);

/**
 * Procedure para soporte/migración cross-tenant: solo
 * accesible para superadmin. NO requiere cookie de org
 * activa; los handlers pueden operar sobre cualquier org
 * pasándole el id explícitamente.
 *
 * Si el superadmin también tiene una `active_org_id` en
 * cookie (caso normal cuando navega la app), se inyecta
 * como `ctx.organizationId` para compatibilidad con
 * queries que ya filtran por org, pero NO se valida la
 * membresía (porque el superadmin no es miembro de cada
 * org, es owner de todas).
 */
export const superOrgProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== "superadmin") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Solo el superadministrador puede realizar esta acción.",
      });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
        organizationId: ctx.activeOrganizationId,
      },
    });
  })
);
