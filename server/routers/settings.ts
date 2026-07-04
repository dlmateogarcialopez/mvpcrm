import { TRPCError } from "@trpc/server";
import { appSettingsInputSchema, userRoleUpdateSchema } from "../../shared/leadSchemas";
import {
  getAppSettings,
  getAppSettingsHistory,
  getCommercialTeam,
  getOrganizationSettings,
  updateAppSettings,
  updateOrganizationSettings,
  updateUserRole,
} from "../db";
import {
  adminProcedure,
  protectedProcedure,
  orgProcedure,
  router,
} from "../_core/trpc";

/**
 * Router de settings + equipo comercial.
 *
 * `get` y `update` leen/escriben `organization_settings` cuando
 * hay una org activa (caso normal multi-tenant); caen al legacy
 * `appSettings` solo cuando no hay org activa (compatibilidad).
 *
 * El historial sigue siendo global (settingsChangeLogs) por ahora.
 */
export const settingsRouter = router({
  /**
   * Devuelve los settings de la org activa si existe, si no
   * el legacy appSettings. La UI consume el mismo shape.
   */
  get: orgProcedure.query(async ({ ctx }) => {
    const orgSettings = await getOrganizationSettings(ctx.organizationId);
    if (orgSettings) {
      return mapOrgSettingsToAppSettings(orgSettings);
    }
    // Fallback legacy
    return getAppSettings();
  }),

  team: protectedProcedure.query(async ({ ctx }) => {
    return getCommercialTeam(ctx.user);
  }),

  history: protectedProcedure.query(async () => {
    return getAppSettingsHistory();
  }),

  /**
   * Actualiza los settings de la org activa (NO el legacy
   * appSettings). Solo admin/owner de la org.
   */
  update: orgProcedure
    .input(appSettingsInputSchema)
    .mutation(async ({ ctx, input }) => {
      const me = await import("../db").then(m => m.getOrganizationMember(ctx.user.id, ctx.organizationId));
      if (!me || (me.orgRole !== "owner" && me.orgRole !== "admin")) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Solo administradores pueden modificar la configuración.",
        });
      }
      // Mapear el input de appSettings (columnas planas) a las
      // columnas JSON de organization_settings. Mantiene la
      // compatibilidad con la UI existente.
      const pricing = {
        precioMultiple: input.precioMultiple,
        precioJunior: input.precioJunior,
        precioSenior: input.precioSenior,
        precioParqueadero: input.precioParqueadero,
        ticketPromedioReferencia: input.ticketPromedioReferencia,
      };
      const scoring = {
        minimoPersonasAmarillo: input.minimoPersonasAmarillo,
        minimoPersonasRojo: input.minimoPersonasRojo,
        minimoValorAmarillo: input.minimoValorAmarillo,
        minimoValorRojo: input.minimoValorRojo,
        diasUrgenciaAlta: input.diasUrgenciaAlta,
        horasLeadCaliente: input.horasLeadCaliente,
        scoreAltoThreshold: input.scoreAltoThreshold,
      };
      const meta = {
        metaIngresosMensual: input.metaIngresosMensual,
        comisionPorcentaje: input.comisionPorcentaje,
      };
      const integrations = {
        googleCalendar: {
          enabled: input.calendarSyncEnabled,
          calendarId: input.googleCalendarId,
        },
        email: {
          enabled: input.emailAlertsEnabled,
          to: input.alertEmailTo,
        },
        sms: {
          enabled: input.smsAlertsEnabled,
          to: input.alertSmsTo,
        },
      };
      const updated = await updateOrganizationSettings({
        organizationId: ctx.organizationId,
        pricing,
        scoring,
        meta,
        integrations,
      });
      if (!updated) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "No fue posible actualizar la configuración.",
        });
      }
      return mapOrgSettingsToAppSettings(updated);
    }),

  /**
   * Actualiza el rol global de un usuario. Este cambio afecta
   * a TODAS las orgs (es a nivel de cuenta), por eso se hace
   * con adminProcedure (no orgProcedure). Solo admin+.
   */
  updateUserRole: adminProcedure
    .input(userRoleUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      return updateUserRole(input, ctx.user);
    }),
});

/**
 * Convierte una fila de organization_settings (columnas JSON
 * pricing/scoring/meta/integrations) al shape plano de
 * appSettings que la UI espera. Mantiene retrocompatibilidad
 * sin tocar la UI en esta fase.
 */
function mapOrgSettingsToAppSettings(
  row: Awaited<ReturnType<typeof getOrganizationSettings>>
) {
  if (!row) {
    throw new Error("mapOrgSettingsToAppSettings: row is null");
  }
  const pricing = parseJson<Record<string, number>>(row.pricing);
  const scoring = parseJson<Record<string, number>>(row.scoring);
  const meta = parseJson<Record<string, number>>(row.meta);
  const integrations = parseJson<Record<string, Record<string, unknown>>>(
    row.integrations
  );
  const calendar = integrations?.googleCalendar ?? {};
  const email = integrations?.email ?? {};
  const sms = integrations?.sms ?? {};
  return {
    id: 0,
    configName: row.displayName ?? "Configuración",
    isDefault: false,
    precioMultiple: pricing?.precioMultiple ?? 99000,
    precioJunior: pricing?.precioJunior ?? 69000,
    precioSenior: pricing?.precioSenior ?? 69000,
    precioParqueadero: pricing?.precioParqueadero ?? 8000,
    ticketPromedioReferencia: pricing?.ticketPromedioReferencia ?? 500000,
    minimoPersonasAmarillo: scoring?.minimoPersonasAmarillo ?? 100,
    minimoPersonasRojo: scoring?.minimoPersonasRojo ?? 200,
    minimoValorAmarillo: scoring?.minimoValorAmarillo ?? 20000000,
    minimoValorRojo: scoring?.minimoValorRojo ?? 35000000,
    diasUrgenciaAlta: scoring?.diasUrgenciaAlta ?? 2,
    horasLeadCaliente: scoring?.horasLeadCaliente ?? 1,
    scoreAltoThreshold: scoring?.scoreAltoThreshold ?? 65,
    metaIngresosMensual: meta?.metaIngresosMensual ?? 50000000,
    comisionPorcentaje: meta?.comisionPorcentaje ?? 5,
    calendarSyncEnabled: Boolean(calendar.enabled),
    googleCalendarId: (calendar.calendarId as string) ?? null,
    emailAlertsEnabled: Boolean(email.enabled),
    smsAlertsEnabled: Boolean(sms.enabled),
    alertEmailTo: (email.to as string) ?? null,
    alertSmsTo: (sms.to as string) ?? null,
    updatedByUserId: null,
    createdAt: row.updatedAt,
    updatedAt: row.updatedAt,
  };
}

function parseJson<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}
