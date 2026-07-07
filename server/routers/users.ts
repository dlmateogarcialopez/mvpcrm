import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure } from "../_core/trpc";
import { requireRole } from "../middleware/requireRole";
import { logAudit } from "../db";
import {
  getUserById,
  listAllUsers,
  softDeleteUser,
  restoreUser,
  updateUserInfo,
} from "../db";

export const usersRouter = router({
  list: publicProcedure.query(async ({ ctx }) => {
    requireRole(ctx.user, ["superadmin"]);
    return listAllUsers(true);
  }),

  update: publicProcedure
    .input(
      z.object({
        userId: z.number().int().positive(),
        name: z.string().min(1).optional(),
        email: z.string().email().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireRole(ctx.user, ["superadmin"]);
      const target = await getUserById(input.userId);
      if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "Usuario no encontrado" });
      const result = await updateUserInfo(input.userId, { name: input.name, email: input.email });
      await logAudit({
        organizationId: ctx.activeOrganizationId ?? 1,
        actorUserId: ctx.user?.id,
        actorEmail: ctx.user?.email ?? null,
        actorName: ctx.user?.name ?? null,
        action: "update",
        entityType: "user",
        entityId: String(input.userId),
        entityName: target.name ?? target.email ?? String(input.userId),
        summary: `Actualizó el usuario "${target.name || target.email}"`,
        details: { name: input.name, email: input.email },
      });
      return result;
    }),

  softDelete: publicProcedure
    .input(z.object({ userId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      requireRole(ctx.user, ["superadmin"]);
      if (ctx.user?.id === input.userId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No puedes desactivarte a ti mismo" });
      }
      const target = await getUserById(input.userId);
      if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "Usuario no encontrado" });
      if (target.deletedAt) throw new TRPCError({ code: "BAD_REQUEST", message: "El usuario ya está desactivado" });
      await softDeleteUser(input.userId);
      await logAudit({
        organizationId: ctx.activeOrganizationId ?? 1,
        actorUserId: ctx.user?.id,
        actorEmail: ctx.user?.email ?? null,
        actorName: ctx.user?.name ?? null,
        action: "soft_delete",
        entityType: "user",
        entityId: String(input.userId),
        entityName: target.name ?? target.email ?? String(input.userId),
        summary: `Desactivó el usuario "${target.name || target.email}"`,
      });
      return { success: true };
    }),

  restore: publicProcedure
    .input(z.object({ userId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      requireRole(ctx.user, ["superadmin"]);
      const target = await getUserById(input.userId);
      if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "Usuario no encontrado" });
      await restoreUser(input.userId);
      await logAudit({
        organizationId: ctx.activeOrganizationId ?? 1,
        actorUserId: ctx.user?.id,
        actorEmail: ctx.user?.email ?? null,
        actorName: ctx.user?.name ?? null,
        action: "restore",
        entityType: "user",
        entityId: String(input.userId),
        entityName: target.name ?? target.email ?? String(input.userId),
        summary: `Restauró el usuario "${target.name || target.email}"`,
      });
      return { success: true };
    }),
});
