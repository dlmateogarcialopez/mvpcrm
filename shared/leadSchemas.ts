import { z } from "zod";
import {
  appRoleValues,
  defaultBusinessSettings,
  leadPartyKindValues,
  leadPriorityValues,
  leadSourceValues,
  leadStatusValues,
  leadTravelReasonValues,
} from "./leads";

const trimmedText = (max: number) => z.string().trim().max(max);
const nullableText = (max: number) => z.string().trim().max(max).optional().nullable().or(z.literal(""));
const nonNegativeInt = z.coerce.number().int().min(0);
const positiveTimestamp = z.coerce.number().int().positive();

export const leadContactBlockSchema = z.object({
  nombre: trimmedText(160).min(3),
  telefono: trimmedText(40).min(7),
  correo: z.string().trim().email().max(191),
});

export const leadCompanyBlockSchema = z.object({
  nombre: nullableText(160).default(""),
  ciudad: nullableText(120).default(""),
});


export const appSettingsInputSchema = z
  .object({
    configName: trimmedText(120).min(3),
    precioMultiple: nonNegativeInt.default(defaultBusinessSettings.precioMultiple),
    precioJunior: nonNegativeInt.default(defaultBusinessSettings.precioJunior),
    precioSenior: nonNegativeInt.default(defaultBusinessSettings.precioSenior),
    precioParqueadero: nonNegativeInt.default(defaultBusinessSettings.precioParqueadero),
    ticketPromedioReferencia: nonNegativeInt.default(defaultBusinessSettings.ticketPromedioReferencia),
    minimoPersonasAmarillo: z.coerce.number().int().min(1).default(defaultBusinessSettings.minimoPersonasAmarillo),
    minimoPersonasRojo: z.coerce.number().int().min(1).default(defaultBusinessSettings.minimoPersonasRojo),
    minimoValorAmarillo: z.coerce.number().int().min(0).default(defaultBusinessSettings.minimoValorAmarillo),
    minimoValorRojo: z.coerce.number().int().min(0).default(defaultBusinessSettings.minimoValorRojo),
    diasUrgenciaAlta: z.coerce.number().int().min(1).max(30).default(defaultBusinessSettings.diasUrgenciaAlta),
    horasLeadCaliente: z.coerce.number().int().min(1).max(168).default(defaultBusinessSettings.horasLeadCaliente),
    scoreAltoThreshold: z.coerce.number().int().min(1).max(200).default(defaultBusinessSettings.scoreAltoThreshold),
    metaIngresosMensual: nonNegativeInt.default(defaultBusinessSettings.metaIngresosMensual),
    comisionPorcentaje: z.coerce.number().min(0).max(100).default(defaultBusinessSettings.comisionPorcentaje),
    calendarSyncEnabled: z.boolean().default(false),
    googleCalendarId: nullableText(191).default(""),
    emailAlertsEnabled: z.boolean().default(false),
    smsAlertsEnabled: z.boolean().default(false),
    alertEmailTo: nullableText(191).default(""),
    alertSmsTo: nullableText(64).default(""),
  })
  .superRefine((value, ctx) => {
    const calendarId = (value.googleCalendarId ?? "").trim();
    const alertEmail = (value.alertEmailTo ?? "").trim();
    const alertSms = (value.alertSmsTo ?? "").trim();
    const normalizedSms = alertSms.replace(/\s+/g, "");

    if (value.minimoPersonasRojo < value.minimoPersonasAmarillo) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["minimoPersonasRojo"],
        message: "El umbral rojo de personas no puede quedar por debajo del amarillo.",
      });
    }

    if (value.minimoValorRojo < value.minimoValorAmarillo) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["minimoValorRojo"],
        message: "El umbral rojo de valor no puede quedar por debajo del amarillo.",
      });
    }

    if (value.calendarSyncEnabled && !calendarId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["googleCalendarId"],
        message: "Activa Calendar solo si también defines el ID del calendario.",
      });
    }

    if (value.emailAlertsEnabled && !alertEmail) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["alertEmailTo"],
        message: "Activa alertas por correo solo si defines un correo destino.",
      });
    }

    if (alertEmail && !z.string().email().safeParse(alertEmail).success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["alertEmailTo"],
        message: "Ingresa un correo válido para las alertas.",
      });
    }

    if (value.smsAlertsEnabled && !normalizedSms) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["alertSmsTo"],
        message: "Activa SMS solo si defines un número destino.",
      });
    }

    if (normalizedSms && !/^\+?\d{10,15}$/.test(normalizedSms)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["alertSmsTo"],
        message: "El número de SMS debe tener entre 10 y 15 dígitos.",
      });
    }
  });

export type AppSettingsInput = z.infer<typeof appSettingsInputSchema>;

export const settingsChangeFieldSchema = z.object({
  field: z.string().trim().min(1),
  label: z.string().trim().min(1),
  previous: z.string().nullable(),
  next: z.string().nullable(),
});

export const settingsChangeLogItemSchema = z.object({
  id: z.number().int().positive(),
  changedAt: z.number().int().nonnegative(),
  changedByName: z.string().trim().min(1),
  changedByEmail: z.string().trim().email().nullable(),
  summary: z.string().trim().min(1),
  changeCount: z.number().int().nonnegative(),
  fields: z.array(settingsChangeFieldSchema),
});

export type SettingsChangeField = z.infer<typeof settingsChangeFieldSchema>;
export type SettingsChangeLogItem = z.infer<typeof settingsChangeLogItemSchema>;

const leadBaseObjectSchema = z.object({
  nombreCliente: trimmedText(160).min(3),
  nombreEmpresa: nullableText(160).default(""),
  ciudad: nullableText(120).default(""),
  telefono: trimmedText(40).min(7),
  correo: z.string().trim().email().max(191),
  fechaVisita: positiveTimestamp,
  motivoVisita: trimmedText(300).min(3),
  tipoEvento: z.enum(leadTravelReasonValues).default("social"),
  objecionPrincipal: trimmedText(300).min(2),
  cantidadMultiple: nonNegativeInt.default(0),
  cantidadJunior: nonNegativeInt.default(0),
  cantidadSenior: nonNegativeInt.default(0),
  cantidadParqueadero: nonNegativeInt.default(0),
  precioMultiple: nonNegativeInt.default(defaultBusinessSettings.precioMultiple),
  precioJunior: nonNegativeInt.default(defaultBusinessSettings.precioJunior),
  precioSenior: nonNegativeInt.default(defaultBusinessSettings.precioSenior),
  precioParqueadero: nonNegativeInt.default(defaultBusinessSettings.precioParqueadero),
  canalOrigen: z.enum(leadSourceValues).default("whatsapp"),
  agenteUserId: z.coerce.number().int().positive().optional().nullable(),
  agenteResponsable: nullableText(160).default(""),
  fechaLimiteGestion: positiveTimestamp.optional().nullable(),
  proximaAccion: nullableText(240).default(""),
  notasInternas: nullableText(2000).default(""),
  motivoPerdido: nullableText(240).default(""),
  motivoPausa: nullableText(240).default(""),
  leadPartyKind: z.enum(leadPartyKindValues).default("persona"),
  contacto: leadContactBlockSchema.optional(),
  empresa: leadCompanyBlockSchema.optional(),
});

function withLeadPartyValidation<T extends z.ZodTypeAny>(schema: T) {
  return schema.superRefine((value, ctx) => {
    const candidate = value as {
      leadPartyKind?: "persona" | "empresa";
      empresa?: { nombre?: string | null } | null;
      nombreEmpresa?: string | null;
    };
    const companyName = (candidate.empresa?.nombre ?? candidate.nombreEmpresa ?? "").trim();

    if (candidate.leadPartyKind === "empresa" && !companyName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["nombreEmpresa"],
        message: "Si eliges empresa, debes registrar el nombre de la empresa o cuenta.",
      });
    }
  });
}

function normalizeLeadPartyBlocks<T extends {
  nombreCliente: string;
  telefono: string;
  correo: string;
  nombreEmpresa?: string | null;
  ciudad?: string | null;
  contacto?: LeadContactBlock;
  empresa?: LeadCompanyBlock;
}>(value: T) {
  const contacto = value.contacto ?? {
    nombre: value.nombreCliente,
    telefono: value.telefono,
    correo: value.correo,
  };
  const empresa = value.empresa ?? {
    nombre: value.nombreEmpresa ?? "",
    ciudad: value.ciudad ?? "",
  };

  return {
    ...value,
    nombreCliente: contacto.nombre,
    telefono: contacto.telefono,
    correo: contacto.correo,
    nombreEmpresa: empresa.nombre,
    ciudad: empresa.ciudad,
    contacto,
    empresa,
  };
}

export const leadCreateSchema = withLeadPartyValidation(leadBaseObjectSchema);

export const leadUpdateSchema = withLeadPartyValidation(
  leadBaseObjectSchema.safeExtend({
    publicId: trimmedText(32).min(4),
    estadoLead: z.enum(leadStatusValues).default("nuevo"),
    fechaIngresoLead: positiveTimestamp.optional().nullable(),
    ultimaGestion: positiveTimestamp.optional().nullable(),
  }),
);

export const leadStatusUpdateSchema = z.object({
  publicId: trimmedText(32).min(4),
  estadoLead: z.enum(leadStatusValues),
  proximaAccion: nullableText(240).default(""),
  notasInternas: nullableText(2000).default(""),
  fechaLimiteGestion: positiveTimestamp.optional().nullable(),
  ultimaGestion: positiveTimestamp.optional().nullable(),
  motivoPerdido: nullableText(240).default(""),
  motivoPausa: nullableText(240).default(""),
});

export const leadFiltersSchema = z.object({
  query: z.string().trim().max(120).default(""),
  estadoLead: z.enum(["todos", ...leadStatusValues]).default("todos"),
  prioridad: z.enum(["todas", ...leadPriorityValues]).default("todas"),
  canalOrigen: z.enum(["todos", ...leadSourceValues]).default("todos"),
  tipoEvento: z.enum(["todos", ...leadTravelReasonValues]).default("todos"),
  ciudad: z.string().trim().max(120).default(""),
  agenteUserId: z.union([z.literal("todos"), z.coerce.number().int().positive()]).default("todos"),
  soloAlertas: z.boolean().default(false),
  assignedToMe: z.boolean().default(false),
  sortBy: z.enum(["updatedAt", "fechaVisita", "valorTotal", "scoreTotal"]).default("updatedAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const leadIdSchema = z.object({
  publicId: trimmedText(32).min(4),
});

export const leadActivityCreateSchema = z.object({
  publicId: trimmedText(32).min(4),
  title: trimmedText(160).min(3),
  description: nullableText(2000).default(""),
});

export const systemLeadActivityTypes = [
  "lead_created",
  "lead_updated",
  "status_changed",
  "assignment_changed",
  "sensitive_fields_changed",
  "calendar_sync",
  "alert_sent",
] as const;

export const leadLostReasonOptions = [
  "Precio fuera de presupuesto",
  "Eligió a otro proveedor",
  "No respondió después del seguimiento",
  "Fecha o logística no viable",
  "No califica para el servicio",
  "Proyecto cancelado por el cliente",
] as const;

export const leadPausedReasonOptions = [
  "Cliente pidió retomar más adelante",
  "Pendiente aprobación interna",
  "Pendiente presupuesto o propuesta final",
  "Pendiente definir fecha del evento",
  "Falta información clave del cliente",
] as const;

export type LeadActivitySummaryItem = {
  activityType: string;
  createdAt?: number | string | Date | null;
};

function toActivityTimestamp(value: LeadActivitySummaryItem["createdAt"]) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

export function isSystemLeadActivityType(activityType: string) {
  return systemLeadActivityTypes.includes(activityType as (typeof systemLeadActivityTypes)[number]);
}

export function summarizeLeadActivityTimeline(activities: LeadActivitySummaryItem[]) {
  return activities.reduce(
    (summary, activity) => {
      const createdAt = toActivityTimestamp(activity.createdAt);
      const isSystem = isSystemLeadActivityType(activity.activityType);
      const isSensitive = activity.activityType === "sensitive_fields_changed";
      const isAutomation = activity.activityType === "calendar_sync" || activity.activityType === "alert_sent";

      if (isSystem) {
        summary.systemCount += 1;
      }

      if (isSensitive) {
        summary.sensitiveChangesCount += 1;
        if (createdAt && (!summary.latestSensitiveChangeAt || createdAt > summary.latestSensitiveChangeAt)) {
          summary.latestSensitiveChangeAt = createdAt;
        }
      }

      if (isAutomation) {
        summary.automationCount += 1;
        if (createdAt && (!summary.latestAutomationAt || createdAt > summary.latestAutomationAt)) {
          summary.latestAutomationAt = createdAt;
        }
      }

      return summary;
    },
    {
      systemCount: 0,
      sensitiveChangesCount: 0,
      automationCount: 0,
      latestSensitiveChangeAt: null as number | null,
      latestAutomationAt: null as number | null,
    },
  );
}

export function isStructuredLeadReason(reason: string | null | undefined, options: readonly string[]) {
  const normalizedReason = reason?.trim();
  return Boolean(normalizedReason && options.includes(normalizedReason));
}

export const userRoleUpdateSchema = z.object({
  userId: z.coerce.number().int().positive(),
  role: z.enum(appRoleValues),
});

export type LeadContactBlock = z.infer<typeof leadContactBlockSchema>;
export type LeadCompanyBlock = z.infer<typeof leadCompanyBlockSchema>;
export type LeadCreateInput = z.infer<typeof leadCreateSchema>;
export type LeadUpdateInput = z.infer<typeof leadUpdateSchema>;
export type LeadStatusUpdateInput = z.infer<typeof leadStatusUpdateSchema>;
export type LeadFiltersInput = z.infer<typeof leadFiltersSchema>;
export type LeadActivityCreateInput = z.infer<typeof leadActivityCreateSchema>;
export type UserRoleUpdateInput = z.infer<typeof userRoleUpdateSchema>;
