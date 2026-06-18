import { z } from "zod";
import { superadminProcedure, protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";

/**
 * Router de permisos del sistema.
 * Solo el superadministrador puede gestionar permisos.
 * Los usuarios pueden consultar SUS propios permisos.
 */
export const permissionsRouter = router({
  /**
   * Lista todos los permisos del catálogo (agrupados por groupName).
   * Accesible a todos los usuarios autenticados (para que los usuarios
   * custom puedan ver qué permisos tienen asignados).
   */
  list: protectedProcedure.query(async () => {
    return db.listPermissions();
  }),

  /**
   * Lista los permisos de un usuario específico.
   * Solo superadmin puede ver permisos de otros usuarios.
   */
  listForUser: superadminProcedure
    .input(z.number())
    .query(async ({ input }) => {
      return db.listUserPermissions(input);
    }),

  /**
   * Asigna un conjunto de permisos a un usuario.
   * Solo superadmin.
   */
  setForUser: superadminProcedure
    .input(
      z.object({
        userId: z.number(),
        permissionIds: z.array(z.number()),
      })
    )
    .mutation(async ({ input }) => {
      await db.setUserPermissions(input.userId, input.permissionIds);
      return { success: true };
    }),
});
