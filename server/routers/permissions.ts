import { z } from "zod";
import {
  superadminProcedure,
  protectedProcedure,
  orgProcedure,
  router,
} from "../_core/trpc";
import * as db from "../db";

/**
 * Router de permisos del sistema.
 * Los permisos custom se almacenan por (userId, organizationId),
 * por lo que los procedures que leen/escriben permisos usan
 * `orgProcedure` para obtener el organizationId activo.
 */
export const permissionsRouter = router({
  /**
   * Lista todos los permisos del catálogo (global, no por org).
   * Accesible a todos los usuarios autenticados.
   */
  list: protectedProcedure.query(async () => {
    return db.listPermissions();
  }),

  /**
   * Lista los permisos de un usuario específico dentro de la
   * org activa. Cualquier miembro de la org puede consultar
   * (útil para que un admin vea qué permisos custom tiene
   * asignado otro usuario en su misma org).
   */
  listForUser: orgProcedure
    .input(z.number())
    .query(async ({ ctx, input }) => {
      return db.listUserPermissions(input, ctx.organizationId);
    }),

  /**
   * Asigna un conjunto de permisos a un usuario dentro de la
   * org activa. Solo superadmin (es el único que puede asignar
   * permisos globales; en fase futura se podrá delegar a
   * owner de la org con un permiso "users.edit_permissions").
   */
  setForUser: superadminProcedure
    .input(
      z.object({
        userId: z.number(),
        permissionIds: z.array(z.number()),
        organizationId: z.number().int().positive().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const orgId = input.organizationId ?? 1;
      await db.setUserPermissions(input.userId, input.permissionIds, orgId);
      return { success: true };
    }),

  /**
   * Asigna permisos dentro de la org activa. Variante para
   * cuando el owner de la org (no superadmin) gestiona los
   * permisos de su equipo. Por ahora lo dejamos solo para
   * owner (no admin) para mantener paridad con la UI actual.
   */
  setForUserInActiveOrg: orgProcedure
    .input(
      z.object({
        userId: z.number(),
        permissionIds: z.array(z.number()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const member = await db.getOrganizationMember(
        ctx.user.id,
        ctx.organizationId
      );
      if (!member || member.orgRole !== "owner") {
        const { TRPCError } = await import("@trpc/server");
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Solo el owner puede asignar permisos en esta org.",
        });
      }
      await db.setUserPermissions(
        input.userId,
        input.permissionIds,
        ctx.organizationId
      );
      return { success: true };
    }),
});
