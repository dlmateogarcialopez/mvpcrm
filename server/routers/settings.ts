import { appSettingsInputSchema, userRoleUpdateSchema } from "../../shared/leadSchemas";
import { getAppSettings, getAppSettingsHistory, getCommercialTeam, updateAppSettings, updateUserRole } from "../db";
import { adminProcedure, protectedProcedure, router } from "../_core/trpc";

export const settingsRouter = router({
  get: protectedProcedure.query(async () => {
    return getAppSettings();
  }),

  team: protectedProcedure.query(async ({ ctx }) => {
    return getCommercialTeam(ctx.user);
  }),

  history: protectedProcedure.query(async () => {
    return getAppSettingsHistory();
  }),

  update: adminProcedure.input(appSettingsInputSchema).mutation(async ({ ctx, input }) => {
    return updateAppSettings(input, ctx.user.id);
  }),

  updateUserRole: adminProcedure.input(userRoleUpdateSchema).mutation(async ({ ctx, input }) => {
    return updateUserRole(input, ctx.user);
  }),
});
