import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure } from "../_core/trpc";
import { requireRole } from "../middleware/requireRole";
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
      return updateUserInfo(input.userId, { name: input.name, email: input.email });
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
      return { success: true };
    }),

  restore: publicProcedure
    .input(z.object({ userId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      requireRole(ctx.user, ["superadmin"]);
      const target = await getUserById(input.userId);
      if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "Usuario no encontrado" });
      await restoreUser(input.userId);
      return { success: true };
    }),
});
