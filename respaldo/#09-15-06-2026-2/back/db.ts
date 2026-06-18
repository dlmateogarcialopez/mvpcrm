import { and, asc, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { nanoid } from "nanoid";
import {
  appSettings,
  InsertUser,
  leadActivities,
  leadCalendarSyncs,
  leads,
  settingsChangeLogs,
  users,
  pipelineStages,
  pipelines,
  leadPipelineStages,
  customLabels,
  customChannels,
  automationRules,
  automationRecipients,
  emailCampaigns,
  metricViews,
  type AppSettings,
  type AutomationRecipient,
  type InsertAutomationRecipient,
  type Lead,
  type LeadActivity,
  type Pipeline,
  type PipelineStage,
  type User,
  type MetricView,
  type InsertMetricView,
} from "../drizzle/schema";
import {
  isStructuredLeadReason,
  leadLostReasonOptions,
  leadPausedReasonOptions,
  type AppSettingsInput,
  type LeadActivityCreateInput,
  type LeadCreateInput,
  type LeadFiltersInput,
  type LeadStatusUpdateInput,
  type LeadUpdateInput,
  type SettingsChangeField,
  type SettingsChangeLogItem,
  type UserRoleUpdateInput,
} from "../shared/leadSchemas";
import {
  appRoleLabels,
  defaultBusinessSettings,
  computeLeadMetrics,
  estimateLeadCommission,
  inferLeadPartyKind,
  getLeadAlertFlags,
  leadPrimaryPipelineValues,
  leadStatusLabels,
  normalizeLeadStatus,
  normalizeLeadTravelReason,
  type AppRole,
  type LeadBusinessSettings,
} from "../shared/leads";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export type CurrentUser = {
  id: number;
  role: AppRole;
  name: string | null;
  email: string | null;
};

export type LeadContactBlock = {
  nombre: string;
  telefono: string;
  correo: string;
};

export type LeadCompanyBlock = {
  nombre: string;
  ciudad: string;
};

export type LeadListItem = Lead & {
  contacto: LeadContactBlock;
  empresa: LeadCompanyBlock;
  diasHastaVisita: number | null;
  horasDesdeUltimaGestion: number | null;
  isClosed: boolean;
  isOverdue: boolean;
};

export type LeadDetail = LeadListItem & {
  activities: LeadActivity[];
};

function normalizeText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeTimestamp(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : null;
}

function serializePayload(payload: unknown) {
  if (payload === undefined || payload === null) return null;
  return JSON.stringify(payload);
}

function isManagerRole(role: AppRole) {
  return role === "admin" || role === "superadmin";
}

function isSuperAdmin(role: AppRole) {
  return role === "superadmin";
}

function getDisplayName(user: Pick<User, "name" | "email"> | CurrentUser) {
  return (
    normalizeText(user.name) ?? normalizeText(user.email) ?? "Equipo comercial"
  );
}

export function buildLeadContactBlock(
  row: Pick<
    Lead,
    | "nombreCliente"
    | "telefono"
    | "correo"
    | "contactoNombre"
    | "contactoTelefono"
    | "contactoCorreo"
  >
): LeadContactBlock {
  return {
    nombre: row.contactoNombre?.trim() || row.nombreCliente.trim(),
    telefono: row.contactoTelefono?.trim() || row.telefono.trim(),
    correo:
      row.contactoCorreo?.trim().toLowerCase() ||
      row.correo.trim().toLowerCase(),
  };
}

export function buildLeadCompanyBlock(
  row: Pick<
    Lead,
    "nombreEmpresa" | "ciudad" | "empresaNombre" | "empresaCiudad"
  >
): LeadCompanyBlock {
  return {
    nombre: row.empresaNombre?.trim() || row.nombreEmpresa?.trim() || "",
    ciudad: row.empresaCiudad?.trim() || row.ciudad?.trim() || "",
  };
}

const settingsFieldLabels: Record<keyof AppSettingsInput, string> = {
  configName: "Nombre de la configuración",
  precioMultiple: "Precio múltiple",
  precioJunior: "Precio junior",
  precioSenior: "Precio senior",
  precioParqueadero: "Precio parqueadero",
  ticketPromedioReferencia: "Ticket promedio de referencia",
  minimoPersonasAmarillo: "Umbral amarillo por personas",
  minimoPersonasRojo: "Umbral rojo por personas",
  minimoValorAmarillo: "Umbral amarillo por valor",
  minimoValorRojo: "Umbral rojo por valor",
  diasUrgenciaAlta: "Días de urgencia alta",
  horasLeadCaliente: "Horas para lead caliente",
  scoreAltoThreshold: "Score alto",
  metaIngresosMensual: "Meta de ingresos mensual",
  comisionPorcentaje: "Comisión",
  calendarSyncEnabled: "Sincronización con Google Calendar",
  googleCalendarId: "ID del calendario",
  emailAlertsEnabled: "Alertas por correo",
  smsAlertsEnabled: "Alertas SMS",
  alertEmailTo: "Correo de alertas",
  alertSmsTo: "Número de alertas SMS",
};

function mergeBusinessSettings(
  record: AppSettings | null | undefined
): LeadBusinessSettings {
  if (!record) {
    return { ...defaultBusinessSettings };
  }

  return {
    precioMultiple: record.precioMultiple,
    precioJunior: record.precioJunior,
    precioSenior: record.precioSenior,
    precioParqueadero: record.precioParqueadero,
    ticketPromedioReferencia: record.ticketPromedioReferencia,
    minimoPersonasAmarillo: record.minimoPersonasAmarillo,
    minimoPersonasRojo: record.minimoPersonasRojo,
    minimoValorAmarillo: record.minimoValorAmarillo,
    minimoValorRojo: record.minimoValorRojo,
    diasUrgenciaAlta: record.diasUrgenciaAlta,
    horasLeadCaliente: record.horasLeadCaliente,
    scoreAltoThreshold: record.scoreAltoThreshold,
    metaIngresosMensual: record.metaIngresosMensual,
    comisionPorcentaje: record.comisionPorcentaje,
  };
}

function enrichLead(row: Lead): LeadListItem {
  const now = Date.now();
  const diasHastaVisita = row.fechaVisita
    ? Math.max(0, Math.floor((row.fechaVisita - now) / (1000 * 60 * 60 * 24)))
    : null;
  const horasDesdeUltimaGestion = row.ultimaGestion
    ? Math.max(0, Math.floor((now - row.ultimaGestion) / (1000 * 60 * 60)))
    : null;
  const normalizedStatus = normalizeLeadStatus(row.estadoLead);
  const isClosed = ["ganado", "perdido"].includes(normalizedStatus);
  const isOverdue =
    !!row.fechaLimiteGestion && row.fechaLimiteGestion < now && !isClosed;

  return {
    ...row,
    contacto: buildLeadContactBlock(row),
    empresa: buildLeadCompanyBlock(row),
    diasHastaVisita,
    horasDesdeUltimaGestion,
    isClosed,
    isOverdue,
  };
}

function matchesLeadFilters(row: LeadListItem, filters: LeadFiltersInput) {
  if (filters.estadoLead !== "todos" && row.estadoLead !== filters.estadoLead) {
    return false;
  }

  if (filters.prioridad !== "todas" && row.prioridad !== filters.prioridad) {
    return false;
  }

  if (
    filters.canalOrigen !== "todos" &&
    row.canalOrigen !== filters.canalOrigen
  ) {
    return false;
  }

  if (
    filters.tipoEvento !== "todos" &&
    normalizeLeadTravelReason(row.tipoEvento) !== filters.tipoEvento
  ) {
    return false;
  }

  if (
    filters.agenteUserId !== "todos" &&
    row.agenteUserId !== filters.agenteUserId
  ) {
    return false;
  }

  if (
    filters.ciudad.trim() &&
    !(row.ciudad ?? "")
      .toLowerCase()
      .includes(filters.ciudad.trim().toLowerCase())
  ) {
    return false;
  }

  if (filters.soloAlertas && !row.alertPending) {
    return false;
  }

  const query = filters.query.trim().toLowerCase();
  if (!query) {
    return true;
  }

  return [
    row.publicId,
    row.nombreCliente,
    row.nombreEmpresa ?? "",
    row.telefono,
    row.correo,
    row.ciudad ?? "",
    row.agenteResponsable ?? "",
    row.motivoVisita,
  ]
    .join(" ")
    .toLowerCase()
    .includes(query);
}

function sortLeadRows(rows: LeadListItem[], filters: LeadFiltersInput) {
  const ordered = [...rows];
  const direction = filters.sortOrder === "asc" ? 1 : -1;

  ordered.sort((a, b) => {
    const valueA =
      filters.sortBy === "fechaVisita"
        ? a.fechaVisita
        : filters.sortBy === "valorTotal"
          ? a.valorTotal
          : filters.sortBy === "scoreTotal"
            ? a.scoreTotal
            : a.updatedAt.getTime();
    const valueB =
      filters.sortBy === "fechaVisita"
        ? b.fechaVisita
        : filters.sortBy === "valorTotal"
          ? b.valorTotal
          : filters.sortBy === "scoreTotal"
            ? b.scoreTotal
            : b.updatedAt.getTime();

    if (valueA === valueB) {
      return b.updatedAt.getTime() - a.updatedAt.getTime();
    }

    return (valueA - valueB) * direction;
  });

  return ordered;
}

function canUserAccessLead(row: Lead, user: CurrentUser) {
  if (isManagerRole(user.role)) {
    return true;
  }

  if (user.role === "guest") {
    return row.createdByUserId === user.id;
  }

  return row.agenteUserId === user.id || row.createdByUserId === user.id;
}

function ensureStatusRequirements(
  status: Lead["estadoLead"],
  motivoPerdido?: string | null,
  motivoPausa?: string | null
) {
  if (status === "perdido") {
    if (!normalizeText(motivoPerdido)) {
      throw new Error(
        "Debes registrar el motivo de pérdida antes de marcar el lead como perdido."
      );
    }

    if (!isStructuredLeadReason(motivoPerdido, leadLostReasonOptions)) {
      throw new Error(
        "Selecciona un motivo de pérdida válido del catálogo antes de marcar el lead como perdido."
      );
    }
  }

  if (status === "pausado") {
    if (!normalizeText(motivoPausa)) {
      throw new Error(
        "Debes registrar el motivo de pausa antes de pausar el lead."
      );
    }

    if (!isStructuredLeadReason(motivoPausa, leadPausedReasonOptions)) {
      throw new Error(
        "Selecciona un motivo de pausa válido del catálogo antes de pausar el lead."
      );
    }
  }
}

async function ensureDefaultSettingsRecord() {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const existing = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.isDefault, true))
    .limit(1);
  if (existing[0]) {
    return existing[0];
  }

  await db.insert(appSettings).values({
    configName: "Configuración principal",
    isDefault: true,
    ...defaultBusinessSettings,
  });

  const created = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.isDefault, true))
    .limit(1);
  if (!created[0]) {
    throw new Error("Default settings could not be created");
  }

  return created[0];
}

async function createLeadActivity(params: {
  leadId: number;
  activityType: LeadActivity["activityType"];
  title: string;
  description?: string | null;
  payload?: unknown;
  isSystem?: boolean;
  createdByUserId?: number | null;
}) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  await db.insert(leadActivities).values({
    leadId: params.leadId,
    activityType: params.activityType,
    title: params.title,
    description: normalizeText(params.description ?? null),
    payload: serializePayload(params.payload),
    isSystem: params.isSystem ?? false,
    createdByUserId: params.createdByUserId ?? null,
  });
}

type SensitiveLeadChange = {
  label: string;
  before: string;
  after: string;
};

function formatLeadAuditValue(
  value: string | number | null | undefined,
  kind: "text" | "currency" | "datetime" = "text"
) {
  if (value === null || value === undefined || value === "") {
    return "sin dato";
  }

  if (kind === "currency" && typeof value === "number") {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(value);
  }

  if (kind === "datetime" && typeof value === "number") {
    return new Date(value).toLocaleString("es-CO");
  }

  return String(value);
}

function collectSensitiveLeadChanges(params: {
  existing: Lead;
  next: {
    fechaVisita: number;
    fechaLimiteGestion: number | null;
    proximaAccion: string | null;
    prioridad: Lead["prioridad"];
    valorTotal: number;
    motivoPerdido: string | null;
    motivoPausa: string | null;
  };
}) {
  const changes: SensitiveLeadChange[] = [];

  if (params.existing.fechaVisita !== params.next.fechaVisita) {
    changes.push({
      label: "fecha de visita",
      before: formatLeadAuditValue(params.existing.fechaVisita, "datetime"),
      after: formatLeadAuditValue(params.next.fechaVisita, "datetime"),
    });
  }

  if (
    (params.existing.fechaLimiteGestion ?? null) !==
    params.next.fechaLimiteGestion
  ) {
    changes.push({
      label: "fecha compromiso",
      before: formatLeadAuditValue(
        params.existing.fechaLimiteGestion,
        "datetime"
      ),
      after: formatLeadAuditValue(params.next.fechaLimiteGestion, "datetime"),
    });
  }

  if ((params.existing.proximaAccion ?? null) !== params.next.proximaAccion) {
    changes.push({
      label: "próximo paso",
      before: formatLeadAuditValue(params.existing.proximaAccion),
      after: formatLeadAuditValue(params.next.proximaAccion),
    });
  }

  if (params.existing.prioridad !== params.next.prioridad) {
    changes.push({
      label: "prioridad",
      before: params.existing.prioridad,
      after: params.next.prioridad,
    });
  }

  if (params.existing.valorTotal !== params.next.valorTotal) {
    changes.push({
      label: "valor estimado",
      before: formatLeadAuditValue(params.existing.valorTotal, "currency"),
      after: formatLeadAuditValue(params.next.valorTotal, "currency"),
    });
  }

  if ((params.existing.motivoPerdido ?? null) !== params.next.motivoPerdido) {
    changes.push({
      label: "motivo de pérdida",
      before: formatLeadAuditValue(params.existing.motivoPerdido),
      after: formatLeadAuditValue(params.next.motivoPerdido),
    });
  }

  if ((params.existing.motivoPausa ?? null) !== params.next.motivoPausa) {
    changes.push({
      label: "motivo de pausa",
      before: formatLeadAuditValue(params.existing.motivoPausa),
      after: formatLeadAuditValue(params.next.motivoPausa),
    });
  }

  return changes;
}

async function updateLeadActivityTimestamp(
  leadId: number,
  updatedByUserId: number,
  timestampMs = Date.now()
) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  await db
    .update(leads)
    .set({
      lastActivityAt: timestampMs,
      ultimaGestion: timestampMs,
      updatedByUserId,
    })
    .where(eq(leads.id, leadId));
}

async function resolveAssignee(params: {
  requestedUserId?: number | null;
  currentUser: CurrentUser;
  existingLead?: Lead | null;
  fallbackName?: string | null;
}) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const managerCanReassign = isManagerRole(params.currentUser.role);
  const candidateUserId = managerCanReassign
    ? (params.requestedUserId ??
      params.existingLead?.agenteUserId ??
      params.currentUser.id)
    : (params.existingLead?.agenteUserId ?? params.currentUser.id);

  if (!candidateUserId) {
    return {
      agenteUserId: null,
      agenteResponsable:
        normalizeText(params.fallbackName) ??
        params.existingLead?.agenteResponsable ??
        getDisplayName(params.currentUser),
    };
  }

  const [assignee] = await db
    .select()
    .from(users)
    .where(eq(users.id, candidateUserId))
    .limit(1);

  if (!assignee) {
    return {
      agenteUserId: params.existingLead?.agenteUserId ?? params.currentUser.id,
      agenteResponsable:
        params.existingLead?.agenteResponsable ??
        normalizeText(params.fallbackName) ??
        getDisplayName(params.currentUser),
    };
  }

  return {
    agenteUserId: assignee.id,
    agenteResponsable: getDisplayName(assignee),
  };
}

async function listVisibleLeadRows(user: CurrentUser) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const rows = await db
    .select()
    .from(leads)
    .orderBy(desc(leads.updatedAt), desc(leads.fechaVisita));
  return rows.filter(row => canUserAccessLead(row, user));
}

function mapLeadToMutableInput(row: Lead): Omit<LeadUpdateInput, "publicId"> {
  const contacto = buildLeadContactBlock(row);
  const empresa = buildLeadCompanyBlock(row);

  return {
    nombreCliente: contacto.nombre,
    nombreEmpresa: empresa.nombre,
    ciudad: empresa.ciudad,
    telefono: contacto.telefono,
    correo: contacto.correo,
    contacto,
    empresa,
    fechaVisita: row.fechaVisita,
    motivoVisita: row.motivoVisita,
    leadPartyKind: inferLeadPartyKind(row),
    tipoEvento: normalizeLeadTravelReason(row.tipoEvento),
    objecionPrincipal: row.objecionPrincipal,
    cantidadMultiple: row.cantidadMultiple,
    cantidadJunior: row.cantidadJunior,
    cantidadSenior: row.cantidadSenior,
    cantidadParqueadero: row.cantidadParqueadero,
    precioMultiple: row.precioMultiple,
    precioJunior: row.precioJunior,
    precioSenior: row.precioSenior,
    precioParqueadero: row.precioParqueadero,
    estadoLead: row.estadoLead as any,
    canalOrigen: row.canalOrigen as any,
    agenteUserId: row.agenteUserId,
    agenteResponsable: row.agenteResponsable,
    fechaIngresoLead: row.fechaIngresoLead,
    fechaLimiteGestion: row.fechaLimiteGestion,
    ultimaGestion: row.ultimaGestion,
    proximaAccion: row.proximaAccion,
    notasInternas: row.notasInternas,
    motivoPerdido: row.motivoPerdido,
    motivoPausa: row.motivoPausa,
  };
}

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = [
      "name",
      "email",
      "loginMethod",
      "passwordHash",
    ] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }

    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "superadmin";
      updateSet.role = "superadmin";
    } else {
      values.role = "agent";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db
    .select()
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserCount(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select().from(users);
  return result.length;
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase().trim()))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

function toSettingsInputSnapshot(record: AppSettings): AppSettingsInput {
  return {
    configName: record.configName,
    precioMultiple: record.precioMultiple,
    precioJunior: record.precioJunior,
    precioSenior: record.precioSenior,
    precioParqueadero: record.precioParqueadero,
    ticketPromedioReferencia: record.ticketPromedioReferencia,
    minimoPersonasAmarillo: record.minimoPersonasAmarillo,
    minimoPersonasRojo: record.minimoPersonasRojo,
    minimoValorAmarillo: record.minimoValorAmarillo,
    minimoValorRojo: record.minimoValorRojo,
    diasUrgenciaAlta: record.diasUrgenciaAlta,
    horasLeadCaliente: record.horasLeadCaliente,
    scoreAltoThreshold: record.scoreAltoThreshold,
    metaIngresosMensual: record.metaIngresosMensual,
    comisionPorcentaje: record.comisionPorcentaje,
    calendarSyncEnabled: record.calendarSyncEnabled,
    googleCalendarId: record.googleCalendarId ?? "",
    emailAlertsEnabled: record.emailAlertsEnabled,
    smsAlertsEnabled: record.smsAlertsEnabled,
    alertEmailTo: record.alertEmailTo ?? "",
    alertSmsTo: record.alertSmsTo ?? "",
  };
}

function normalizeSettingsInput(input: AppSettingsInput) {
  return {
    configName: input.configName,
    precioMultiple: input.precioMultiple,
    precioJunior: input.precioJunior,
    precioSenior: input.precioSenior,
    precioParqueadero: input.precioParqueadero,
    ticketPromedioReferencia: input.ticketPromedioReferencia,
    minimoPersonasAmarillo: input.minimoPersonasAmarillo,
    minimoPersonasRojo: input.minimoPersonasRojo,
    minimoValorAmarillo: input.minimoValorAmarillo,
    minimoValorRojo: input.minimoValorRojo,
    diasUrgenciaAlta: input.diasUrgenciaAlta,
    horasLeadCaliente: input.horasLeadCaliente,
    scoreAltoThreshold: input.scoreAltoThreshold,
    metaIngresosMensual: input.metaIngresosMensual,
    comisionPorcentaje: Math.round(input.comisionPorcentaje),
    calendarSyncEnabled: input.calendarSyncEnabled,
    googleCalendarId: normalizeText(input.googleCalendarId),
    emailAlertsEnabled: input.emailAlertsEnabled,
    smsAlertsEnabled: input.smsAlertsEnabled,
    alertEmailTo: normalizeText(input.alertEmailTo),
    alertSmsTo: normalizeText(input.alertSmsTo),
  };
}

function formatSettingsFieldValue(
  field: keyof AppSettingsInput,
  value: AppSettingsInput[keyof AppSettingsInput] | null | undefined
) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "boolean") {
    return value ? "Activo" : "Inactivo";
  }

  if (field === "comisionPorcentaje") {
    return `${value}%`;
  }

  return String(value);
}

function buildSettingsChangeFields(
  previous: AppSettingsInput,
  next: AppSettingsInput
): SettingsChangeField[] {
  return (Object.keys(settingsFieldLabels) as Array<keyof AppSettingsInput>)
    .filter(field => previous[field] !== next[field])
    .map(field => ({
      field,
      label: settingsFieldLabels[field],
      previous: formatSettingsFieldValue(field, previous[field]),
      next: formatSettingsFieldValue(field, next[field]),
    }));
}

function buildSettingsChangeSummary(changes: SettingsChangeField[]) {
  const preview = changes
    .slice(0, 3)
    .map(change => change.label.toLowerCase())
    .join(", ");

  return changes.length === 1
    ? `Se actualizó ${preview}.`
    : `Se actualizaron ${changes.length} campos: ${preview}${changes.length > 3 ? ", entre otros." : "."}`;
}

function parseSettingsChangeFields(raw: string): SettingsChangeField[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed
          .filter(item => item && typeof item === "object")
          .map(item => ({
            field: typeof item.field === "string" ? item.field : "campo",
            label: typeof item.label === "string" ? item.label : "Campo",
            previous:
              typeof item.previous === "string" || item.previous === null
                ? item.previous
                : null,
            next:
              typeof item.next === "string" || item.next === null
                ? item.next
                : null,
          }))
      : [];
  } catch {
    return [];
  }
}

export async function getAppSettings() {
  return ensureDefaultSettingsRecord();
}

export async function getAppSettingsHistory(
  limit = 8
): Promise<SettingsChangeLogItem[]> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const rows = await db
    .select({
      log: settingsChangeLogs,
      changedByName: users.name,
      changedByEmail: users.email,
    })
    .from(settingsChangeLogs)
    .leftJoin(users, eq(settingsChangeLogs.changedByUserId, users.id))
    .orderBy(desc(settingsChangeLogs.createdAt))
    .limit(limit);

  return rows.map(({ log, changedByName, changedByEmail }) => {
    const fields = parseSettingsChangeFields(log.changedFields);

    return {
      id: log.id,
      changedAt: log.createdAt.getTime(),
      changedByName:
        normalizeText(changedByName) ??
        normalizeText(changedByEmail) ??
        "Sistema",
      changedByEmail: normalizeText(changedByEmail),
      summary: log.summary,
      changeCount: fields.length,
      fields,
    } satisfies SettingsChangeLogItem;
  });
}

export async function updateAppSettings(
  input: AppSettingsInput,
  userId: number
) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const current = await ensureDefaultSettingsRecord();
  const previousSnapshot = toSettingsInputSnapshot(current);
  const normalizedUpdate = normalizeSettingsInput(input);
  const nextSnapshot: AppSettingsInput = {
    ...input,
    comisionPorcentaje: normalizedUpdate.comisionPorcentaje,
    googleCalendarId: normalizedUpdate.googleCalendarId ?? "",
    alertEmailTo: normalizedUpdate.alertEmailTo ?? "",
    alertSmsTo: normalizedUpdate.alertSmsTo ?? "",
  };
  const changedFields = buildSettingsChangeFields(
    previousSnapshot,
    nextSnapshot
  );

  if (changedFields.length === 0) {
    return current;
  }

  await db
    .update(appSettings)
    .set({
      ...normalizedUpdate,
      updatedByUserId: userId,
    })
    .where(eq(appSettings.id, current.id));

  const updated = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.id, current.id))
    .limit(1);
  if (!updated[0]) {
    throw new Error("Settings could not be updated");
  }

  await db.insert(settingsChangeLogs).values({
    settingsId: current.id,
    changedByUserId: userId,
    summary: buildSettingsChangeSummary(changedFields),
    changedFields: serializePayload(changedFields) ?? "[]",
    previousSnapshot: serializePayload(previousSnapshot) ?? "{}",
    nextSnapshot: serializePayload(nextSnapshot) ?? "{}",
  });

  return updated[0];
}

export async function listLeads(filters: LeadFiltersInput, user: CurrentUser) {
  const visibleRows = await listVisibleLeadRows(user);
  const filteredRows = visibleRows
    .map(enrichLead)
    .filter(row => (filters.assignedToMe ? row.agenteUserId === user.id : true))
    .filter(row => matchesLeadFilters(row, filters));

  return sortLeadRows(filteredRows, filters);
}

export async function listLeadsForExport(user: CurrentUser) {
  const visibleRows = await listVisibleLeadRows(user);
  return visibleRows.map(enrichLead);
}

export async function getLeadByPublicId(publicId: string, user: CurrentUser) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const result = await db
    .select()
    .from(leads)
    .where(eq(leads.publicId, publicId))
    .limit(1);
  const row = result[0];
  if (!row || !canUserAccessLead(row, user)) {
    return null;
  }

  const activities = await db
    .select()
    .from(leadActivities)
    .where(eq(leadActivities.leadId, row.id))
    .orderBy(desc(leadActivities.createdAt));

  return {
    ...enrichLead(row),
    activities,
  } satisfies LeadDetail;
}

export async function createLead(input: LeadCreateInput, user: CurrentUser) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const initialStatus: Lead["estadoLead"] = "nuevo";
  ensureStatusRequirements(
    initialStatus,
    input.motivoPerdido,
    input.motivoPausa
  );

  const settings = await ensureDefaultSettingsRecord();
  const businessSettings = mergeBusinessSettings(settings);
  const fechaIngresoLead = Date.now();
  const metrics = computeLeadMetrics({
    ...input,
    fechaIngresoLead,
    scoreAltoThreshold: businessSettings.scoreAltoThreshold,
    minimoPersonasAmarillo: businessSettings.minimoPersonasAmarillo,
    minimoPersonasRojo: businessSettings.minimoPersonasRojo,
    minimoValorAmarillo: businessSettings.minimoValorAmarillo,
    minimoValorRojo: businessSettings.minimoValorRojo,
  });
  const alerts = getLeadAlertFlags(
    metrics,
    input.fechaLimiteGestion,
    initialStatus
  );
  const publicId = `LEAD-${nanoid(8).toUpperCase()}`;
  const assignment = await resolveAssignee({
    requestedUserId: input.agenteUserId,
    currentUser: user,
    fallbackName: input.agenteResponsable,
  });
  const activityAt = Date.now();

  const contacto = input.contacto ?? {
    nombre: input.nombreCliente.trim(),
    telefono: input.telefono.trim(),
    correo: input.correo.trim().toLowerCase(),
  };
  const empresa =
    input.leadPartyKind === "empresa"
      ? (input.empresa ?? {
          nombre: input.nombreEmpresa ?? "",
          ciudad: input.ciudad ?? "",
        })
      : {
          nombre: "",
          ciudad: input.ciudad ?? "",
        };

  await db.insert(leads).values({
    publicId,
    contactoNombre: contacto.nombre.trim(),
    contactoTelefono: contacto.telefono.trim(),
    contactoCorreo: contacto.correo.trim().toLowerCase(),
    empresaNombre: normalizeText(empresa.nombre),
    empresaCiudad: normalizeText(empresa.ciudad),
    nombreCliente: contacto.nombre.trim(),
    nombreEmpresa: normalizeText(empresa.nombre),
    ciudad: normalizeText(empresa.ciudad),
    telefono: contacto.telefono.trim(),
    correo: contacto.correo.trim().toLowerCase(),
    fechaVisita: input.fechaVisita,
    motivoVisita: input.motivoVisita.trim(),
    tipoEvento: input.tipoEvento,
    objecionPrincipal: input.objecionPrincipal.trim(),
    cantidadMultiple: metrics.cantidadMultiple,
    cantidadJunior: metrics.cantidadJunior,
    cantidadSenior: metrics.cantidadSenior,
    cantidadParqueadero: metrics.cantidadParqueadero,
    precioMultiple: metrics.precioMultiple,
    precioJunior: metrics.precioJunior,
    precioSenior: metrics.precioSenior,
    precioParqueadero: metrics.precioParqueadero,
    subtotalMultiple: metrics.subtotalMultiple,
    subtotalJunior: metrics.subtotalJunior,
    subtotalSenior: metrics.subtotalSenior,
    subtotalParqueadero: metrics.subtotalParqueadero,
    totalPersonas: metrics.totalPersonas,
    valorTotal: metrics.valorTotal,
    ticketPromedio: metrics.ticketPromedio,
    scoreCantidad: metrics.scoreCantidad,
    scoreValorTotal: metrics.scoreValorTotal,
    scoreTicketPromedio: metrics.scoreTicketPromedio,
    scoreUrgencia: metrics.scoreUrgencia,
    scoreRecencia: metrics.scoreRecencia,
    scoreTotal: metrics.scoreTotal,
    prioridadBase: metrics.prioridadBase,
    prioridad: metrics.prioridad,
    prioridadExplicacion: metrics.explicacionBreve,
    estadoLead: initialStatus,
    canalOrigen: input.canalOrigen,
    agenteUserId: assignment.agenteUserId,
    agenteResponsable: assignment.agenteResponsable,
    fechaIngresoLead,
    fechaLimiteGestion: normalizeTimestamp(input.fechaLimiteGestion),
    ultimaGestion: activityAt,
    proximaAccion: normalizeText(input.proximaAccion),
    notasInternas: normalizeText(input.notasInternas),
    motivoPerdido: normalizeText(input.motivoPerdido),
    motivoPausa: normalizeText(input.motivoPausa),
    lastActivityAt: activityAt,
    calendarSyncStatus: settings.calendarSyncEnabled ? "pending" : "disabled",
    calendarSyncMessage: settings.calendarSyncEnabled
      ? "Pendiente de sincronización"
      : "Integración desactivada",
    alertPending: alerts.requiereAtencion,
    closedAt: null,
    createdByUserId: user.id,
    updatedByUserId: user.id,
  });

  const created = await db
    .select()
    .from(leads)
    .where(eq(leads.publicId, publicId))
    .limit(1);
  const lead = created[0];
  if (!lead) {
    throw new Error("Lead could not be created");
  }

  await createLeadActivity({
    leadId: lead.id,
    activityType: "lead_created",
    title: "Lead creado",
    description: `Lead ${lead.publicId} creado con prioridad ${lead.prioridad}.`,
    payload: {
      scoreTotal: lead.scoreTotal,
      prioridad: lead.prioridad,
      valorTotal: lead.valorTotal,
      agenteResponsable: lead.agenteResponsable,
    },
    createdByUserId: user.id,
  });

  return getLeadByPublicId(publicId, user);
}

export async function updateLead(input: LeadUpdateInput, user: CurrentUser) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  ensureStatusRequirements(
    input.estadoLead,
    input.motivoPerdido,
    input.motivoPausa
  );

  const current = await db
    .select()
    .from(leads)
    .where(eq(leads.publicId, input.publicId))
    .limit(1);
  const existing = current[0];
  if (!existing || !canUserAccessLead(existing, user)) {
    return null;
  }

  const settings = await ensureDefaultSettingsRecord();
  const businessSettings = mergeBusinessSettings(settings);
  const metrics = computeLeadMetrics({
    ...input,
    scoreAltoThreshold: businessSettings.scoreAltoThreshold,
    minimoPersonasAmarillo: businessSettings.minimoPersonasAmarillo,
    minimoPersonasRojo: businessSettings.minimoPersonasRojo,
    minimoValorAmarillo: businessSettings.minimoValorAmarillo,
    minimoValorRojo: businessSettings.minimoValorRojo,
  });
  const normalizedDeadline = normalizeTimestamp(input.fechaLimiteGestion);
  const normalizedNextStep = normalizeText(input.proximaAccion);
  const normalizedNotes = normalizeText(input.notasInternas);
  const normalizedLostReason = normalizeText(input.motivoPerdido);
  const normalizedPausedReason = normalizeText(input.motivoPausa);
  const alerts = getLeadAlertFlags(
    metrics,
    normalizedDeadline,
    input.estadoLead
  );
  const statusChanged = existing.estadoLead !== input.estadoLead;
  const assignment = await resolveAssignee({
    requestedUserId: input.agenteUserId,
    currentUser: user,
    existingLead: existing,
    fallbackName: input.agenteResponsable,
  });
  const assignmentChanged = existing.agenteUserId !== assignment.agenteUserId;
  const activityAt = normalizeTimestamp(input.ultimaGestion) ?? Date.now();
  const nextClosedAt = ["ganado", "perdido"].includes(input.estadoLead)
    ? Date.now()
    : null;
  const sensitiveChanges = collectSensitiveLeadChanges({
    existing,
    next: {
      fechaVisita: input.fechaVisita,
      fechaLimiteGestion: normalizedDeadline,
      proximaAccion: normalizedNextStep,
      prioridad: metrics.prioridad,
      valorTotal: metrics.valorTotal,
      motivoPerdido: normalizedLostReason,
      motivoPausa: normalizedPausedReason,
    },
  });

  const contacto = input.contacto ?? {
    nombre: input.nombreCliente.trim(),
    telefono: input.telefono.trim(),
    correo: input.correo.trim().toLowerCase(),
  };
  const empresa =
    input.leadPartyKind === "empresa"
      ? (input.empresa ?? {
          nombre: input.nombreEmpresa ?? "",
          ciudad: input.ciudad ?? "",
        })
      : {
          nombre: "",
          ciudad: input.ciudad ?? "",
        };

  await db
    .update(leads)
    .set({
      contactoNombre: contacto.nombre.trim(),
      contactoTelefono: contacto.telefono.trim(),
      contactoCorreo: contacto.correo.trim().toLowerCase(),
      empresaNombre: normalizeText(empresa.nombre),
      empresaCiudad: normalizeText(empresa.ciudad),
      nombreCliente: contacto.nombre.trim(),
      nombreEmpresa: normalizeText(empresa.nombre),
      ciudad: normalizeText(empresa.ciudad),
      telefono: contacto.telefono.trim(),
      correo: contacto.correo.trim().toLowerCase(),
      fechaVisita: input.fechaVisita,
      motivoVisita: input.motivoVisita.trim(),
      tipoEvento: input.tipoEvento,
      objecionPrincipal: input.objecionPrincipal.trim(),
      cantidadMultiple: metrics.cantidadMultiple,
      cantidadJunior: metrics.cantidadJunior,
      cantidadSenior: metrics.cantidadSenior,
      cantidadParqueadero: metrics.cantidadParqueadero,
      precioMultiple: metrics.precioMultiple,
      precioJunior: metrics.precioJunior,
      precioSenior: metrics.precioSenior,
      precioParqueadero: metrics.precioParqueadero,
      subtotalMultiple: metrics.subtotalMultiple,
      subtotalJunior: metrics.subtotalJunior,
      subtotalSenior: metrics.subtotalSenior,
      subtotalParqueadero: metrics.subtotalParqueadero,
      totalPersonas: metrics.totalPersonas,
      valorTotal: metrics.valorTotal,
      ticketPromedio: metrics.ticketPromedio,
      scoreCantidad: metrics.scoreCantidad,
      scoreValorTotal: metrics.scoreValorTotal,
      scoreTicketPromedio: metrics.scoreTicketPromedio,
      scoreUrgencia: metrics.scoreUrgencia,
      scoreRecencia: metrics.scoreRecencia,
      scoreTotal: metrics.scoreTotal,
      prioridadBase: metrics.prioridadBase,
      prioridad: metrics.prioridad,
      prioridadExplicacion: metrics.explicacionBreve,
      estadoLead: input.estadoLead,
      canalOrigen: input.canalOrigen,
      agenteUserId: assignment.agenteUserId,
      agenteResponsable: assignment.agenteResponsable,
      fechaIngresoLead: input.fechaIngresoLead ?? existing.fechaIngresoLead,
      fechaLimiteGestion: normalizedDeadline,
      ultimaGestion: activityAt,
      proximaAccion: normalizedNextStep,
      notasInternas: normalizedNotes,
      motivoPerdido: normalizedLostReason,
      motivoPausa: normalizedPausedReason,
      lastActivityAt: activityAt,
      calendarSyncStatus: settings.calendarSyncEnabled
        ? "pending"
        : existing.calendarSyncStatus,
      calendarSyncMessage: settings.calendarSyncEnabled
        ? "Pendiente de sincronización"
        : existing.calendarSyncMessage,
      alertPending: alerts.requiereAtencion,
      closedAt: nextClosedAt,
      updatedByUserId: user.id,
    })
    .where(eq(leads.id, existing.id));

  await createLeadActivity({
    leadId: existing.id,
    activityType: "lead_updated",
    title: "Lead actualizado",
    description: `Lead ${existing.publicId} actualizado por ${getDisplayName(user)}.`,
    payload: {
      scoreTotal: metrics.scoreTotal,
      prioridad: metrics.prioridad,
      valorTotal: metrics.valorTotal,
    },
    createdByUserId: user.id,
  });

  if (statusChanged) {
    await createLeadActivity({
      leadId: existing.id,
      activityType: "status_changed",
      title: "Estado actualizado",
      description: `Cambio de estado de ${(leadStatusLabels as any)[existing.estadoLead]} a ${leadStatusLabels[input.estadoLead]}.`,
      payload: {
        before: existing.estadoLead,
        after: input.estadoLead,
      },
      createdByUserId: user.id,
    });
  }

  if (assignmentChanged) {
    await createLeadActivity({
      leadId: existing.id,
      activityType: "assignment_changed",
      title: "Asignación actualizada",
      description: `Lead reasignado a ${assignment.agenteResponsable}.`,
      payload: {
        before: existing.agenteUserId,
        after: assignment.agenteUserId,
      },
      createdByUserId: user.id,
    });
  }

  if (sensitiveChanges.length > 0) {
    await createLeadActivity({
      leadId: existing.id,
      activityType: "sensitive_fields_changed",
      title: "Cambios sensibles registrados",
      description: `Se ajustaron ${sensitiveChanges.map(change => change.label).join(", ")}.`,
      payload: {
        fields: sensitiveChanges,
      },
      createdByUserId: user.id,
    });
  }

  return getLeadByPublicId(existing.publicId, user);
}

export async function updateLeadStatus(
  input: LeadStatusUpdateInput,
  user: CurrentUser
) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const current = await db
    .select()
    .from(leads)
    .where(eq(leads.publicId, input.publicId))
    .limit(1);
  const existing = current[0];
  if (!existing || !canUserAccessLead(existing, user)) {
    return null;
  }

  return updateLead(
    {
      publicId: existing.publicId,
      ...mapLeadToMutableInput(existing),
      estadoLead: input.estadoLead,
      proximaAccion: input.proximaAccion ?? existing.proximaAccion,
      notasInternas: input.notasInternas ?? existing.notasInternas,
      fechaLimiteGestion:
        input.fechaLimiteGestion ?? existing.fechaLimiteGestion,
      ultimaGestion: input.ultimaGestion ?? Date.now(),
      motivoPerdido: input.motivoPerdido ?? existing.motivoPerdido,
      motivoPausa: input.motivoPausa ?? existing.motivoPausa,
    },
    user
  );
}

export async function addLeadActivity(
  input: LeadActivityCreateInput,
  user: CurrentUser
) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const [lead] = await db
    .select()
    .from(leads)
    .where(eq(leads.publicId, input.publicId))
    .limit(1);
  if (!lead || !canUserAccessLead(lead, user)) {
    return null;
  }

  const timestampMs = Date.now();
  await createLeadActivity({
    leadId: lead.id,
    activityType: "note_added",
    title: input.title.trim(),
    description: normalizeText(input.description),
    createdByUserId: user.id,
  });
  await updateLeadActivityTimestamp(lead.id, user.id, timestampMs);

  return getLeadByPublicId(lead.publicId, user);
}

export async function updateLeadCalendarState(params: {
  leadId: number;
  eventId?: string | null;
  eventUrl?: string | null;
  syncStatus: Lead["calendarSyncStatus"];
  syncMessage?: string | null;
  updatedByUserId: number;
}) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  await db
    .update(leads)
    .set({
      calendarEventId: normalizeText(params.eventId ?? null),
      calendarEventUrl: normalizeText(params.eventUrl ?? null),
      calendarSyncStatus: params.syncStatus,
      calendarSyncMessage: normalizeText(params.syncMessage ?? null),
      updatedByUserId: params.updatedByUserId,
      lastActivityAt: Date.now(),
    })
    .where(eq(leads.id, params.leadId));
}

export async function recordCalendarSync(params: {
  leadId: number;
  externalCalendarId?: string | null;
  externalEventId?: string | null;
  syncAction: "create" | "update" | "skip" | "error" | "manual";
  syncStatus: "pending" | "success" | "error";
  requestFingerprint?: string | null;
  message?: string | null;
  triggeredByUserId?: number | null;
}) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  await db.insert(leadCalendarSyncs).values({
    leadId: params.leadId,
    externalCalendarId: normalizeText(params.externalCalendarId ?? null),
    externalEventId: normalizeText(params.externalEventId ?? null),
    syncAction: params.syncAction,
    syncStatus: params.syncStatus,
    requestFingerprint: normalizeText(params.requestFingerprint ?? null),
    message: normalizeText(params.message ?? null),
    triggeredByUserId: params.triggeredByUserId ?? null,
  });

  await createLeadActivity({
    leadId: params.leadId,
    activityType: "calendar_sync",
    title: "Sincronización de calendario",
    description:
      normalizeText(params.message) ??
      `Estado ${params.syncStatus} en la acción ${params.syncAction}.`,
    payload: {
      syncAction: params.syncAction,
      syncStatus: params.syncStatus,
      externalEventId: params.externalEventId,
    },
    isSystem: true,
    createdByUserId: params.triggeredByUserId ?? null,
  });
}

export async function recordLeadAlertDelivery(params: {
  leadId: number;
  channel: string;
  message: string;
  updatedByUserId: number;
}) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  await db
    .update(leads)
    .set({
      alertLastChannel: params.channel,
      alertLastMessage: params.message,
      lastAlertAt: Date.now(),
      lastActivityAt: Date.now(),
      updatedByUserId: params.updatedByUserId,
    })
    .where(eq(leads.id, params.leadId));

  await createLeadActivity({
    leadId: params.leadId,
    activityType: "alert_sent",
    title: "Alerta operativa enviada",
    description: params.message,
    payload: {
      channel: params.channel,
    },
    isSystem: true,
    createdByUserId: params.updatedByUserId,
  });
}

export async function getCommercialTeam(currentUser: CurrentUser) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const rows = await db
    .select()
    .from(users)
    .orderBy(desc(users.lastSignedIn), asc(users.name));

  return rows.map(row => ({
    id: row.id,
    name: getDisplayName(row),
    email: row.email,
    role: row.role,
    roleLabel: appRoleLabels[row.role],
    lastSignedIn: row.lastSignedIn,
    canEdit:
      isManagerRole(currentUser.role) &&
      !(currentUser.role === "admin" && row.role === "superadmin") &&
      row.id !== currentUser.id,
  }));
}

export async function updateUserRole(
  input: UserRoleUpdateInput,
  currentUser: CurrentUser
) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  if (!isManagerRole(currentUser.role)) {
    throw new Error("No tienes permisos para cambiar roles.");
  }

  const [targetUser] = await db
    .select()
    .from(users)
    .where(eq(users.id, input.userId))
    .limit(1);
  if (!targetUser) {
    throw new Error("Usuario no encontrado.");
  }

  if (targetUser.id === currentUser.id) {
    throw new Error("No puedes modificar tu propio rol desde esta pantalla.");
  }

  if (!isSuperAdmin(currentUser.role)) {
    if (targetUser.role === "superadmin" || input.role === "superadmin") {
      throw new Error("Solo un superadministrador puede gestionar ese rol.");
    }
  }

  await db
    .update(users)
    .set({
      role: input.role,
    })
    .where(eq(users.id, targetUser.id));

  const [updated] = await db
    .select()
    .from(users)
    .where(eq(users.id, targetUser.id))
    .limit(1);
  if (!updated) {
    throw new Error("No fue posible actualizar el rol.");
  }

  return {
    id: updated.id,
    name: getDisplayName(updated),
    email: updated.email,
    role: updated.role,
    roleLabel: appRoleLabels[updated.role],
    lastSignedIn: updated.lastSignedIn,
  };
}

export async function getDashboardSnapshot(user: CurrentUser) {
  const rows = (await listVisibleLeadRows(user)).map(enrichLead);
  const settings = mergeBusinessSettings(await ensureDefaultSettingsRecord());
  const now = Date.now();
  const openRows = rows.filter(row => !row.isClosed);
  const wonRows = rows.filter(
    row => normalizeLeadStatus(row.estadoLead) === "ganado"
  );
  const upcomingVisits = [...openRows]
    .filter(row => row.fechaVisita >= now)
    .sort((a, b) => a.fechaVisita - b.fechaVisita)
    .slice(0, 6);
  const urgentRows = [...openRows]
    .filter(row => row.prioridad === "rojo" || row.prioridad === "amarillo")
    .sort((a, b) => b.scoreTotal - a.scoreTotal)
    .slice(0, 6);
  const overdueRows = openRows.filter(row => row.isOverdue);
  const unattendedRows = openRows.filter(
    row => (row.horasDesdeUltimaGestion ?? 0) >= 24
  );
  const pipelineValue = openRows.reduce((sum, row) => sum + row.valorTotal, 0);
  const wonValue = wonRows.reduce((sum, row) => sum + row.valorTotal, 0);
  const conversionRate =
    rows.length > 0
      ? Math.round((wonRows.length / rows.length) * 1000) / 10
      : 0;
  const averageTicket =
    rows.length > 0
      ? Math.round(
          rows.reduce((sum, row) => sum + row.valorTotal, 0) / rows.length
        )
      : 0;
  const progressToGoal =
    settings.metaIngresosMensual > 0
      ? Math.min(
          100,
          Math.round((wonValue / settings.metaIngresosMensual) * 1000) / 10
        )
      : 0;

  const pipeline = leadPrimaryPipelineValues.map(status => {
    const bucketRows = rows.filter(
      row => normalizeLeadStatus(row.estadoLead) === status
    );
    return {
      status,
      label: leadStatusLabels[status],
      count: bucketRows.length,
      value: bucketRows.reduce((sum, row) => sum + row.valorTotal, 0),
    };
  });

  const byAgentMap = new Map<
    string,
    {
      name: string;
      count: number;
      value: number;
      won: number;
      closedCount: number;
    }
  >();
  const byCityMap = new Map<
    string,
    { city: string; count: number; value: number }
  >();

  for (const row of rows) {
    const agentName = row.agenteResponsable ?? "Sin asignar";
    const currentAgent = byAgentMap.get(agentName) ?? {
      name: agentName,
      count: 0,
      value: 0,
      won: 0,
      closedCount: 0,
    };
    if (!row.isClosed) {
      currentAgent.count += 1;
      currentAgent.value += row.valorTotal;
    } else {
      currentAgent.closedCount += 1;
      if (normalizeLeadStatus(row.estadoLead) === "ganado") {
        currentAgent.won += 1;
      }
    }
    byAgentMap.set(agentName, currentAgent);
  }

  for (const row of openRows) {
    const cityName = normalizeText(row.ciudad) ?? "Sin ciudad";
    const currentCity = byCityMap.get(cityName) ?? {
      city: cityName,
      count: 0,
      value: 0,
    };
    currentCity.count += 1;
    currentCity.value += row.valorTotal;
    byCityMap.set(cityName, currentCity);
  }

  return {
    settings: {
      metaIngresosMensual: settings.metaIngresosMensual,
      comisionPorcentaje: settings.comisionPorcentaje,
    },
    summary: {
      total: rows.length,
      abiertos: openRows.length,
      ganados: wonRows.length,
      vencidos: overdueRows.length,
      alertas: openRows.filter(row => row.alertPending).length,
      pipelineValue,
      wonValue,
      averageTicket,
      conversionRate,
      progressToGoal,
      projectedPipelineCommission: estimateLeadCommission(
        pipelineValue,
        settings.comisionPorcentaje
      ),
      projectedWonCommission: estimateLeadCommission(
        wonValue,
        settings.comisionPorcentaje
      ),
    },
    pipeline,
    byAgent: Array.from(byAgentMap.values())
      .sort((a, b) => b.value - a.value)
      .slice(0, 6),
    byCity: Array.from(byCityMap.values())
      .sort((a, b) => b.value - a.value)
      .slice(0, 6),
    upcomingVisits,
    urgentRows,
    overdueRows: overdueRows.slice(0, 6),
    unattendedRows: unattendedRows.slice(0, 6),
    recentRows: [...rows]
      .sort(
        (a, b) =>
          (b.lastActivityAt ?? b.updatedAt.getTime()) -
          (a.lastActivityAt ?? a.updatedAt.getTime())
      )
      .slice(0, 8),
  };
}

/* ============================================================
 * CRUD de Pipelines (embudos) y Pipeline Stages (fases)
 * Cada fase pertenece a un pipeline; un lead puede estar en una
 * fase distinta por cada pipeline (relación vía lead_pipeline_stages).
 * ============================================================ */

export async function listPipelines() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(pipelines).orderBy(asc(pipelines.order));
}

export async function listActivePipelines() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db
    .select()
    .from(pipelines)
    .where(eq(pipelines.isActive, true))
    .orderBy(asc(pipelines.order));
}

export async function getPipeline(id: number): Promise<Pipeline | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [row] = await db
    .select()
    .from(pipelines)
    .where(eq(pipelines.id, id))
    .limit(1);
  return row ?? null;
}

/**
 * Devuelve el primer pipeline activo (orden 1). Si no hay ninguno, el primero de la tabla.
 * Se usa como "pipeline por defecto" para mantener compatibilidad.
 */
export async function getDefaultPipeline(): Promise<Pipeline | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [row] = await db
    .select()
    .from(pipelines)
    .where(eq(pipelines.isActive, true))
    .orderBy(asc(pipelines.order))
    .limit(1);
  if (row) return row;
  const all = await db
    .select()
    .from(pipelines)
    .orderBy(asc(pipelines.order))
    .limit(1);
  return all[0] ?? null;
}

export async function createPipeline(
  data: Omit<Pipeline, "id" | "createdAt" | "updatedAt">
): Promise<Pipeline> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [row] = await db.insert(pipelines).values(data).$returningId();
  if (!row) throw new Error("No fue posible crear el embudo.");
  return getPipeline(row.id) as Promise<Pipeline>;
}

export async function updatePipeline(
  id: number,
  data: Partial<Omit<Pipeline, "id" | "createdAt" | "updatedAt">>
): Promise<Pipeline | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(pipelines).set(data).where(eq(pipelines.id, id));
  return getPipeline(id);
}

export async function setPipelineActive(
  id: number,
  isActive: boolean
): Promise<Pipeline | null> {
  return updatePipeline(id, { isActive });
}

export async function deletePipeline(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(pipelines).where(eq(pipelines.id, id));
}

export async function reorderPipelines(orderedIds: number[]): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  for (let i = 0; i < orderedIds.length; i++) {
    await db
      .update(pipelines)
      .set({ order: i + 1 })
      .where(eq(pipelines.id, orderedIds[i]));
  }
}

/* ----- Stages ----- */

export async function listPipelineStages(pipelineId?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (pipelineId) {
    return db
      .select()
      .from(pipelineStages)
      .where(eq(pipelineStages.pipelineId, pipelineId))
      .orderBy(asc(pipelineStages.order));
  }
  return db.select().from(pipelineStages).orderBy(asc(pipelineStages.order));
}

export async function listActivePipelineStages(pipelineId?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (pipelineId) {
    return db
      .select()
      .from(pipelineStages)
      .where(
        and(
          eq(pipelineStages.isActive, true),
          eq(pipelineStages.pipelineId, pipelineId)
        )
      )
      .orderBy(asc(pipelineStages.order));
  }
  return db
    .select()
    .from(pipelineStages)
    .where(eq(pipelineStages.isActive, true))
    .orderBy(asc(pipelineStages.order));
}

export async function getPipelineStage(
  id: number
): Promise<PipelineStage | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [row] = await db
    .select()
    .from(pipelineStages)
    .where(eq(pipelineStages.id, id))
    .limit(1);
  return row ?? null;
}

export async function getPipelineStageByName(
  pipelineId: number,
  name: string
): Promise<PipelineStage | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [row] = await db
    .select()
    .from(pipelineStages)
    .where(
      and(
        eq(pipelineStages.pipelineId, pipelineId),
        eq(pipelineStages.name, name)
      )
    )
    .limit(1);
  return row ?? null;
}

export async function getPipelineStageByKind(
  pipelineId: number,
  kind: "open" | "won" | "lost" | "paused"
): Promise<PipelineStage | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [row] = await db
    .select()
    .from(pipelineStages)
    .where(
      and(
        eq(pipelineStages.pipelineId, pipelineId),
        eq(pipelineStages.kind, kind)
      )
    )
    .limit(1);
  return row ?? null;
}

export async function createPipelineStage(
  data: Omit<PipelineStage, "id" | "createdAt" | "updatedAt">
): Promise<PipelineStage> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [row] = await db.insert(pipelineStages).values(data).$returningId();
  if (!row) throw new Error("No fue posible crear la fase.");
  return getPipelineStage(row.id) as Promise<PipelineStage>;
}

export async function updatePipelineStage(
  id: number,
  data: Partial<Omit<PipelineStage, "id" | "createdAt" | "updatedAt">>
): Promise<PipelineStage | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(pipelineStages).set(data).where(eq(pipelineStages.id, id));
  return getPipelineStage(id);
}

export async function setPipelineStageActive(
  id: number,
  isActive: boolean
): Promise<PipelineStage | null> {
  return updatePipelineStage(id, { isActive });
}

export async function deletePipelineStage(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(pipelineStages).where(eq(pipelineStages.id, id));
}

/**
 * Cuenta cuántos leads están en una fase (por id) en la BD.
 * Sirve para bloquear el borrado si la fase tiene leads.
 */
export async function countLeadsByStageId(stageId: number): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db
    .select({ id: leadPipelineStages.leadId })
    .from(leadPipelineStages)
    .where(eq(leadPipelineStages.stageId, stageId));
  return rows.length;
}

/**
 * Cuenta leads por nombre de fase en leads.estadoLead (denormalizado).
 * Mantener para retro-compatibilidad.
 */
export async function countLeadsByStageName(name: string): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db
    .select({ id: leads.id })
    .from(leads)
    .where(eq(leads.estadoLead, name as any));
  return rows.length;
}

/**
 * Reordena un conjunto de fases según el array de IDs (en el mismo pipeline).
 * El primer ID queda con order=1, el segundo con order=2, etc.
 */
export async function reorderPipelineStages(
  orderedIds: number[]
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  for (let i = 0; i < orderedIds.length; i++) {
    await db
      .update(pipelineStages)
      .set({ order: i + 1 })
      .where(eq(pipelineStages.id, orderedIds[i]));
  }
}

/* ----- lead_pipeline_stages (relación lead × pipeline × stage) ----- */

export async function getLeadStageInPipeline(
  leadId: number,
  pipelineId: number
): Promise<{ id: number; stageId: number; movedAt: Date } | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [row] = await db
    .select()
    .from(leadPipelineStages)
    .where(
      and(
        eq(leadPipelineStages.leadId, leadId),
        eq(leadPipelineStages.pipelineId, pipelineId)
      )
    )
    .limit(1);
  if (!row) return null;
  return { id: row.id, stageId: row.stageId, movedAt: row.movedAt as any };
}

export async function listLeadStageAssignments(leadId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db
    .select()
    .from(leadPipelineStages)
    .where(eq(leadPipelineStages.leadId, leadId));
}

export async function setLeadStageInPipeline(
  leadId: number,
  pipelineId: number,
  stageId: number,
  movedByUserId?: number
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // INSERT siempre: guarda historial de movimientos en lugar de
  // una sola fila por lead+pipeline. Las métricas de conversión
  // (transición, tiempo promedio, velocidad, dropoff) dependen
  // de este historial para calcular tasas reales.
  await db.insert(leadPipelineStages).values({
    leadId,
    pipelineId,
    stageId,
    movedAt: new Date(),
    movedByUserId: movedByUserId ?? null,
  });
}

export async function listLeadsInStage(stageId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db
    .select({ leadId: leadPipelineStages.leadId })
    .from(leadPipelineStages)
    .where(eq(leadPipelineStages.stageId, stageId));
}

export async function countLeadsInPipeline(
  pipelineId: number
): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Si es el pipeline Principal (order=1), todos los leads existen en él
  // porque PipelinePage agrupa por estadoLead (denormalizado).
  const [pipe] = await db
    .select()
    .from(pipelines)
    .where(eq(pipelines.id, pipelineId))
    .limit(1);

  if (pipe && pipe.order === 1) {
    const all = await db.select({ id: leads.id }).from(leads);
    return all.length;
  }

  // Para otros pipelines, contar desde lead_pipeline_stages
  const rows = await db
    .select({ id: leadPipelineStages.id })
    .from(leadPipelineStages)
    .where(eq(leadPipelineStages.pipelineId, pipelineId));
  return rows.length;
}

/**
 * Funciones para Etiquetas Personalizadas
 */
export async function listCustomLabels() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(customLabels).orderBy(asc(customLabels.name));
}

export async function createCustomLabel(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(customLabels).values(data);
}

/**
 * Funciones para Canales Personalizados
 */
export async function listCustomChannels() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db
    .select()
    .from(customChannels)
    .where(eq(customChannels.isActive, true));
}

/**
 * Funciones para Automatizaciones
 */
export async function listAutomationRules() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db
    .select()
    .from(automationRules)
    .orderBy(desc(automationRules.createdAt));
}

export async function createAutomationRule(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(automationRules).values(data);
}

export async function getActiveAutomationRules() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db
    .select()
    .from(automationRules)
    .where(eq(automationRules.isActive, true))
    .orderBy(desc(automationRules.createdAt));
}

export async function updateAutomationRule(id: number, data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(automationRules).set(data).where(eq(automationRules.id, id));
  const [updated] = await db
    .select()
    .from(automationRules)
    .where(eq(automationRules.id, id))
    .limit(1);
  return updated;
}

export async function deleteAutomationRule(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(automationRules).where(eq(automationRules.id, id));
}

export async function incrementRuleExecution(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [rule] = await db
    .select()
    .from(automationRules)
    .where(eq(automationRules.id, id))
    .limit(1);
  if (!rule) return;
  const currentCount = rule.executionCount ?? 0;
  await db
    .update(automationRules)
    .set({
      executionCount: currentCount + 1,
      lastExecutedAt: new Date(),
    })
    .where(eq(automationRules.id, id));
}

/**
 * Funciones para Email Marketing
 */
export async function listEmailCampaigns() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db
    .select()
    .from(emailCampaigns)
    .orderBy(desc(emailCampaigns.createdAt));
}

export async function createEmailCampaign(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(emailCampaigns).values(data);
}

export async function getEmailCampaign(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [campaign] = await db
    .select()
    .from(emailCampaigns)
    .where(eq(emailCampaigns.id, id))
    .limit(1);
  return campaign;
}

export async function updateEmailCampaign(id: number, data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(emailCampaigns).set(data).where(eq(emailCampaigns.id, id));
  return getEmailCampaign(id);
}

export async function deleteEmailCampaign(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(emailCampaigns).where(eq(emailCampaigns.id, id));
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return user;
}

/* ============================================================
 * Helpers para el motor de automatizaciones (trigger gestion_vencida)
 * ============================================================ */

/**
 * Busca un usuario por nombre (coincidencia exacta case-insensitive primero,
 * luego parcial). Si no encuentra nada, devuelve null.
 */
export async function findUserByName(name: string): Promise<User | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const target = name.trim();
  if (!target) return null;

  const all = await db.select().from(users);
  const lower = target.toLowerCase();
  const exact = all.find(u => (u.name || "").toLowerCase() === lower);
  if (exact) return exact;
  const partial = all.find(u => (u.name || "").toLowerCase().includes(lower));
  if (partial) return partial;
  const byEmail = all.find(u => (u.email || "").toLowerCase() === lower);
  return byEmail ?? null;
}

/**
 * Reasigna un lead a un agente, registrando la actividad correspondiente.
 * Devuelve el lead actualizado (LeadListItem) o null si falla.
 */
export async function assignLeadAgent(
  leadId: number,
  agenteUserId: number | null,
  agenteResponsable: string,
  updatedByUserId: number
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [existing] = await db
    .select()
    .from(leads)
    .where(eq(leads.id, leadId))
    .limit(1);
  if (!existing) return null;

  await db
    .update(leads)
    .set({
      agenteUserId,
      agenteResponsable: normalizeText(agenteResponsable) ?? "Sin asignar",
      updatedByUserId,
      lastActivityAt: Date.now(),
    })
    .where(eq(leads.id, leadId));

  await createLeadActivity({
    leadId,
    activityType: "assignment_changed",
    title: "Asignación actualizada por automatización",
    description: `Regla automática asignó el lead a ${agenteResponsable}.`,
    payload: {
      before: existing.agenteUserId,
      after: agenteUserId,
      source: "automation",
    },
    isSystem: true,
    createdByUserId: updatedByUserId,
  });

  // Devolver el lead enriquecido (sin chequeo de visibilidad: el caller ya validó)
  return getLeadByPublicId(existing.publicId, {
    id: updatedByUserId,
    role: "admin",
    name: null,
    email: null,
  });
}

/**
 * Persiste el array de etiquetas de un lead (serializado como JSON) y registra actividad.
 * Devuelve el lead enriquecido o null si falla.
 */
export async function updateLeadLabels(
  leadId: number,
  labels: string[],
  updatedByUserId: number
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [existing] = await db
    .select()
    .from(leads)
    .where(eq(leads.id, leadId))
    .limit(1);
  if (!existing) return null;

  const previous = existing.labels ?? "[]";
  const next = JSON.stringify(labels);

  await db
    .update(leads)
    .set({
      labels: next,
      updatedByUserId,
      lastActivityAt: Date.now(),
    })
    .where(eq(leads.id, leadId));

  await createLeadActivity({
    leadId,
    activityType: "lead_updated",
    title: "Etiqueta añadida por automatización",
    description: `La automatización agregó la(s) etiqueta(s): ${labels.join(", ")}.`,
    payload: {
      previous,
      next,
      source: "automation",
    },
    isSystem: true,
    createdByUserId: updatedByUserId,
  });

  return getLeadByPublicId(existing.publicId, {
    id: updatedByUserId,
    role: "admin",
    name: null,
    email: null,
  });
}

/**
 * Cambia el estado de un lead y registra actividad. NO recalcula scores
 * (es una mutación puntual del motor de automatizaciones).
 */
export async function updateLeadStatusField(
  leadId: number,
  newStatus: string,
  updatedByUserId: number
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [existing] = await db
    .select()
    .from(leads)
    .where(eq(leads.id, leadId))
    .limit(1);
  if (!existing) return null;

  const now = Date.now();
  const isClosing = ["ganado", "perdido"].includes(newStatus);
  const closedAt = isClosing ? now : existing.closedAt;

  await db
    .update(leads)
    .set({
      estadoLead: newStatus,
      closedAt,
      updatedByUserId,
      lastActivityAt: now,
    })
    .where(eq(leads.id, leadId));

  await createLeadActivity({
    leadId,
    activityType: "status_changed",
    title: "Estado actualizado por automatización",
    description: `Cambio de estado de "${existing.estadoLead}" a "${newStatus}" vía regla automática.`,
    payload: {
      before: existing.estadoLead,
      after: newStatus,
      source: "automation",
    },
    isSystem: true,
    createdByUserId: updatedByUserId,
  });

  return getLeadByPublicId(existing.publicId, {
    id: updatedByUserId,
    role: "admin",
    name: null,
    email: null,
  });
}

/**
 * Registra un envío de email por automatización en el log de actividades.
 */
export async function recordAutomationEmail(
  leadId: number,
  recipient: string,
  subject: string,
  success: boolean,
  updatedByUserId: number
) {
  await createLeadActivity({
    leadId,
    activityType: "alert_sent",
    title: success
      ? "Email de automatización enviado"
      : "Fallo al enviar email de automatización",
    description: `Para: ${recipient} — Asunto: ${subject}`,
    payload: {
      channel: "email",
      recipient,
      subject,
      success,
      source: "automation",
    },
    isSystem: true,
    createdByUserId: updatedByUserId,
  });
}

/**
 * Devuelve los leads visibles para un usuario que están vencidos AHORA.
 * Aplica el mismo control de acceso que listVisibleLeadRows y reutiliza enrichLead.
 */
export async function listOverdueLeadsForUser(
  user: CurrentUser
): Promise<LeadListItem[]> {
  const rows = await listVisibleLeadRows(user);
  return rows.map(enrichLead).filter(row => row.isOverdue);
}

/**
 * Devuelve los leads visibles para un usuario cuya `fechaLimiteGestion` está
 * en el futuro pero a menos de `diasUmbral` días de vencer. Si `diasUmbral`
 * no es un número positivo, devuelve lista vacía.
 */
export async function listProximosAVencerLeadsForUser(
  user: CurrentUser,
  diasUmbral: number
): Promise<LeadListItem[]> {
  if (!Number.isFinite(diasUmbral) || diasUmbral <= 0) return [];
  const rows = await listVisibleLeadRows(user);
  const now = Date.now();
  const ms = diasUmbral * 24 * 60 * 60 * 1000;
  return rows.map(enrichLead).filter(row => {
    if (row.isClosed) return false;
    if (!row.fechaLimiteGestion) return false;
    const diff = row.fechaLimiteGestion - now;
    return diff > 0 && diff <= ms;
  });
}

/* ============================================================
 * CRUD de destinatarios de automatizaciones (solo superadmin)
 * Usado por los triggers opportunity_* y las acciones send_*_to_user.
 * ============================================================ */

export async function listAutomationRecipients(): Promise<
  AutomationRecipient[]
> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db
    .select()
    .from(automationRecipients)
    .orderBy(asc(automationRecipients.name));
}

export async function getAutomationRecipient(
  id: number
): Promise<AutomationRecipient | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [row] = await db
    .select()
    .from(automationRecipients)
    .where(eq(automationRecipients.id, id))
    .limit(1);
  return row ?? null;
}

export async function createAutomationRecipient(
  data: Omit<InsertAutomationRecipient, "id" | "createdAt" | "updatedAt">
): Promise<AutomationRecipient> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [row] = await db
    .insert(automationRecipients)
    .values(data)
    .$returningId();
  if (!row) throw new Error("No fue posible crear el destinatario.");
  return getAutomationRecipient(row.id) as Promise<AutomationRecipient>;
}

export async function updateAutomationRecipient(
  id: number,
  data: Partial<
    Omit<InsertAutomationRecipient, "id" | "createdAt" | "updatedAt">
  >
): Promise<AutomationRecipient | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(automationRecipients)
    .set(data)
    .where(eq(automationRecipients.id, id));
  return getAutomationRecipient(id);
}

export async function deleteAutomationRecipient(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(automationRecipients).where(eq(automationRecipients.id, id));
}

/* ============================================================
 * Helpers para asignaciones lead × pipeline × stage
 * (UI de mover leads entre embudos)
 * ============================================================ */

/**
 * Devuelve las asignaciones del lead a pipelines con datos completos
 * del pipeline y del stage. Útil para mostrar en el panel de un lead.
 */
export async function listLeadPipelineAssignmentsWithDetails(leadId: number) {
  const dbConn = await getDb();
  if (!dbConn) throw new Error("Database not available");

  const rows = await dbConn
    .select({
      pipelineId: leadPipelineStages.pipelineId,
      stageId: leadPipelineStages.stageId,
      movedAt: leadPipelineStages.movedAt,
    })
    .from(leadPipelineStages)
    .where(eq(leadPipelineStages.leadId, leadId))
    .orderBy(asc(leadPipelineStages.movedAt));

  // Con el modelo de historial (INSERT), un lead puede tener múltiples
  // registros por pipeline. Tomamos solo el último movimiento de cada uno.
  const latestByPipeline = new Map<
    number,
    { stageId: number; movedAt: Date }
  >();
  for (const r of rows) {
    latestByPipeline.set(r.pipelineId, {
      stageId: r.stageId,
      movedAt: r.movedAt as any,
    });
  }

  const result: Array<{
    pipelineId: number;
    pipelineName: string;
    pipelineColor: string | null;
    stageId: number;
    stageName: string;
    stageDisplayName: string;
    stageColor: string | null;
    stageKind: string;
    movedAt: Date;
  }> = [];

  for (const [pipelineId, entry] of Array.from(latestByPipeline.entries())) {
    const [pipeline] = await dbConn
      .select()
      .from(pipelines)
      .where(eq(pipelines.id, pipelineId))
      .limit(1);
    const [stage] = await dbConn
      .select()
      .from(pipelineStages)
      .where(eq(pipelineStages.id, entry.stageId))
      .limit(1);
    if (pipeline && stage) {
      result.push({
        pipelineId: pipeline.id,
        pipelineName: pipeline.name,
        pipelineColor: pipeline.color,
        stageId: stage.id,
        stageName: stage.name,
        stageDisplayName: stage.displayName,
        stageColor: stage.color,
        stageKind: stage.kind,
        movedAt: entry.movedAt as any,
      });
    }
  }

  return result;
}

/**
 * Quita al lead de un pipeline (elimina la asignación en lead_pipeline_stages).
 * Si era el pipeline Principal, el `leads.estadoLead` se mantiene con el valor anterior.
 */
export async function removeLeadFromPipeline(
  leadId: number,
  pipelineId: number
): Promise<void> {
  const dbConn = await getDb();
  if (!dbConn) throw new Error("Database not available");
  await dbConn
    .delete(leadPipelineStages)
    .where(
      and(
        eq(leadPipelineStages.leadId, leadId),
        eq(leadPipelineStages.pipelineId, pipelineId)
      )
    );
}

/**
 * Devuelve todos los leads asignados a un pipeline, con su stageId
 * correspondiente. Usa lead_pipeline_stages y enriquece via enrichLead.
 * El resultado incluye el campo `pipelineStageId` para agrupación visual.
 */
export async function listLeadsByPipeline(
  pipelineId: number,
  user: CurrentUser
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const rows = await db
    .select({
      leadId: leadPipelineStages.leadId,
      stageId: leadPipelineStages.stageId,
    })
    .from(leadPipelineStages)
    .where(eq(leadPipelineStages.pipelineId, pipelineId))
    .orderBy(asc(leadPipelineStages.movedAt));

  // Recorremos en orden cronológico. Para cada lead, el último valor
  // (más reciente) es el que queda en el Map.
  const stageMap = new Map<number, number>(); // leadId -> stageId
  for (const r of rows) {
    stageMap.set(r.leadId, r.stageId);
  }

  if (stageMap.size === 0) return [];

  const leadIds = Array.from(stageMap.keys());
  const allRows = await listVisibleLeadRows(user);
  const filtered = allRows.filter(row => leadIds.includes(row.id));

  return filtered.map(row => ({
    ...enrichLead(row),
    pipelineStageId: stageMap.get(row.id) ?? null,
  }));
}

/* ============================================================
 * Métricas de conversión para embudos
 * 6 tipos: funnel, stage_transition, by_segment, avg_time,
 *          velocity, dropoff.
 * Todos consultan lead_pipeline_stages y se basan en cohortes
 * por pipeline y período.
 * ============================================================ */

const DEFAULT_METRIC_DAYS = 30;

function parseMetricDates(
  startDate?: string,
  endDate?: string
): { start: Date; end: Date } {
  const end = endDate ? new Date(endDate) : new Date();
  const start = startDate
    ? new Date(startDate)
    : new Date(end.getTime() - DEFAULT_METRIC_DAYS * 24 * 60 * 60 * 1000);
  return { start, end };
}

/** Obtiene los leadIds de la cohorte de entrada (primera fase open del pipeline) en el período. */
async function getCohortLeadIds(
  pipelineId: number,
  start: Date,
  end: Date
): Promise<number[]> {
  const db = await getDb();
  if (!db) return [];

  // Encontrar todos los leads que tienen asignación en este pipeline
  // y cuya fecha de ingreso cae dentro del período.
  // Usamos leads.fechaIngresoLead para que la cohorte no dependa de
  // la fase actual del lead (un lead sigue en la cohorte aunque cambie de fase).
  const rows = await db
    .select({ leadId: leadPipelineStages.leadId })
    .from(leadPipelineStages)
    .innerJoin(leads, eq(leads.id, leadPipelineStages.leadId))
    .where(
      and(
        eq(leadPipelineStages.pipelineId, pipelineId),
        gte(leads.fechaIngresoLead, start.getTime()),
        lte(leads.fechaIngresoLead, end.getTime())
      )
    );

  return Array.from(new Set(rows.map(r => r.leadId)));
}

/**
 * 1) FUNNEL: De los leads que entraron en el período, cuántos llegaron a cada fase.
 */
export async function getPipelineFunnel(
  pipelineId: number,
  startDate?: string,
  endDate?: string
) {
  const db = await getDb();
  if (!db) return { stages: [], total: 0 };

  const { start, end } = parseMetricDates(startDate, endDate);
  const cohortIds = await getCohortLeadIds(pipelineId, start, end);
  const total = cohortIds.length;
  if (total === 0) return { stages: [], total: 0 };

  const stages = await db
    .select()
    .from(pipelineStages)
    .where(eq(pipelineStages.pipelineId, pipelineId))
    .orderBy(asc(pipelineStages.order));

  const result = [];
  for (const stage of stages) {
    const count =
      cohortIds.length === 0
        ? 0
        : await (async () => {
            const rows = await db
              .select({ leadId: leadPipelineStages.leadId })
              .from(leadPipelineStages)
              .where(
                and(
                  eq(leadPipelineStages.stageId, stage.id),
                  inArray(leadPipelineStages.leadId, cohortIds)
                )
              );
            return rows.length;
          })();

    result.push({
      stageId: stage.id,
      stageName: stage.name,
      stageDisplayName: stage.displayName,
      stageColor: stage.color,
      stageKind: stage.kind,
      stageOrder: stage.order,
      count,
      percentage: Math.round((count / total) * 1000) / 10,
    });
  }

  return { stages: result, total };
}

/**
 * 2) STAGE TRANSITION: De leads que estuvieron en fromStage, cuántos llegaron a toStage.
 */
export async function getStageTransition(
  pipelineId: number,
  fromStageId: number,
  toStageId: number,
  startDate?: string,
  endDate?: string
) {
  const db = await getDb();
  if (!db) return { fromCount: 0, toCount: 0, percentage: 0 };

  const { start, end } = parseMetricDates(startDate, endDate);

  const fromRows = await db
    .select({ leadId: leadPipelineStages.leadId })
    .from(leadPipelineStages)
    .where(
      and(
        eq(leadPipelineStages.stageId, fromStageId),
        gte(leadPipelineStages.movedAt, start),
        lte(leadPipelineStages.movedAt, end)
      )
    );
  const fromLeads = Array.from(new Set(fromRows.map(r => r.leadId)));
  const fromCount = fromLeads.length;
  if (fromCount === 0) return { fromCount: 0, toCount: 0, percentage: 0 };

  const toRows = await db
    .select({ leadId: leadPipelineStages.leadId })
    .from(leadPipelineStages)
    .where(
      and(
        eq(leadPipelineStages.stageId, toStageId),
        inArray(leadPipelineStages.leadId, fromLeads)
      )
    );
  const toCount = Array.from(new Set(toRows.map(r => r.leadId))).length;

  return {
    fromCount,
    toCount,
    percentage: Math.round((toCount / fromCount) * 1000) / 10,
  };
}

/**
 * 3) BY SEGMENT: Conversión segmentada por un campo del lead.
 */
export async function getConversionBySegment(
  pipelineId: number,
  segmentField: string,
  startDate?: string,
  endDate?: string
) {
  const db = await getDb();
  if (!db) return [];

  const { start, end } = parseMetricDates(startDate, endDate);
  const cohortIds = await getCohortLeadIds(pipelineId, start, end);
  if (cohortIds.length === 0) return [];

  const wonStage = await db
    .select()
    .from(pipelineStages)
    .where(
      and(
        eq(pipelineStages.pipelineId, pipelineId),
        eq(pipelineStages.kind, "won")
      )
    )
    .limit(1);
  const wonStageId = wonStage.length > 0 ? wonStage[0].id : null;

  // Obtener todos los leads de la cohorte con sus datos
  const leadRows = await db
    .select()
    .from(leads)
    .where(inArray(leads.id, cohortIds));
  const leadMap = new Map(leadRows.map(l => [l.id, l]));

  // Leads ganados de la cohorte
  let wonLeadIds: number[] = [];
  if (wonStageId) {
    const wonRows = await db
      .select({ leadId: leadPipelineStages.leadId })
      .from(leadPipelineStages)
      .where(
        and(
          eq(leadPipelineStages.stageId, wonStageId),
          inArray(leadPipelineStages.leadId, cohortIds)
        )
      );
    wonLeadIds = Array.from(new Set(wonRows.map(r => r.leadId)));
  }
  const wonSet = new Set(wonLeadIds);

  // Agrupar por segmento
  const segments = new Map<string, { total: number; won: number }>();
  for (const id of cohortIds) {
    const lead = leadMap.get(id);
    const value = (lead as any)?.[segmentField] ?? "Sin dato";
    const key = String(value).trim() || "Sin dato";
    if (!segments.has(key)) segments.set(key, { total: 0, won: 0 });
    const s = segments.get(key)!;
    s.total++;
    if (wonSet.has(id)) s.won++;
  }

  return Array.from(segments.entries())
    .map(([label, data]) => ({
      label,
      total: data.total,
      won: data.won,
      percentage: Math.round((data.won / data.total) * 1000) / 10,
    }))
    .sort((a, b) => b.total - a.total);
}

/**
 * 4) AVG TIME: Tiempo promedio en cada transición de fase (una fase a la siguiente).
 */
export async function getAverageTimeInStage(
  pipelineId: number,
  startDate?: string,
  endDate?: string
) {
  const db = await getDb();
  if (!db) return [];

  const { start, end } = parseMetricDates(startDate, endDate);
  const cohortIds = await getCohortLeadIds(pipelineId, start, end);
  if (cohortIds.length === 0) return [];

  const stages = await db
    .select()
    .from(pipelineStages)
    .where(eq(pipelineStages.pipelineId, pipelineId))
    .orderBy(asc(pipelineStages.order));

  const result = [];
  for (let i = 0; i < stages.length - 1; i++) {
    const fromStage = stages[i];
    const toStage = stages[i + 1];

    // Leads que pasaron de fromStage a toStage
    const transitions = await db
      .select({
        leadId: leadPipelineStages.leadId,
        fromMovedAt: leadPipelineStages.movedAt,
      })
      .from(leadPipelineStages)
      .where(
        and(
          eq(leadPipelineStages.stageId, fromStage.id),
          inArray(leadPipelineStages.leadId, cohortIds)
        )
      );

    const leadIds = transitions.map(t => t.leadId);
    if (leadIds.length === 0) {
      result.push({
        fromStage: fromStage.displayName,
        toStage: toStage.displayName,
        avgDays: null,
        count: 0,
      });
      continue;
    }

    const toMoves = await db
      .select({
        leadId: leadPipelineStages.leadId,
        movedAt: leadPipelineStages.movedAt,
      })
      .from(leadPipelineStages)
      .where(
        and(
          eq(leadPipelineStages.stageId, toStage.id),
          inArray(leadPipelineStages.leadId, leadIds)
        )
      );
    const toMap = new Map(toMoves.map(r => [r.leadId, r.movedAt]));

    let totalDays = 0;
    let count = 0;
    for (const t of transitions) {
      const toDate = toMap.get(t.leadId);
      if (toDate) {
        const fromMs =
          t.fromMovedAt instanceof Date
            ? t.fromMovedAt.getTime()
            : new Date(t.fromMovedAt as any).getTime();
        const toMs =
          toDate instanceof Date
            ? toDate.getTime()
            : new Date(toDate as any).getTime();
        totalDays += (toMs - fromMs) / (1000 * 60 * 60 * 24);
        count++;
      }
    }

    result.push({
      fromStage: fromStage.displayName,
      toStage: toStage.displayName,
      avgDays: count > 0 ? Math.round((totalDays / count) * 10) / 10 : null,
      count,
    });
  }

  return result;
}

/**
 * 5) VELOCITY: Tiempo total desde entrada hasta cierre (ganado/perdido).
 */
export async function getPipelineVelocity(
  pipelineId: number,
  startDate?: string,
  endDate?: string
) {
  const db = await getDb();
  if (!db)
    return {
      min: null,
      max: null,
      avg: null,
      median: null,
      distribution: [],
      count: 0,
    };

  const { start, end } = parseMetricDates(startDate, endDate);
  const cohortIds = await getCohortLeadIds(pipelineId, start, end);
  if (cohortIds.length === 0)
    return {
      min: null,
      max: null,
      avg: null,
      median: null,
      distribution: [],
      count: 0,
    };

  // Fases terminales (won, lost)
  const terminal = await db
    .select()
    .from(pipelineStages)
    .where(
      and(
        eq(pipelineStages.pipelineId, pipelineId),
        eq(pipelineStages.isActive, true),
        inArray(pipelineStages.kind, ["won", "lost"])
      )
    );
  const terminalIds = terminal.map(s => s.id);
  if (terminalIds.length === 0)
    return {
      min: null,
      max: null,
      avg: null,
      median: null,
      distribution: [],
      count: 0,
    };

  const days: number[] = [];
  for (const leadId of cohortIds) {
    // Fecha de entrada (primera fase)
    const first = await db
      .select({ movedAt: leadPipelineStages.movedAt })
      .from(leadPipelineStages)
      .where(eq(leadPipelineStages.leadId, leadId))
      .orderBy(asc(leadPipelineStages.movedAt))
      .limit(1);
    if (first.length === 0) continue;

    // Fecha de cierre (última fase terminal)
    const last = await db
      .select({ movedAt: leadPipelineStages.movedAt })
      .from(leadPipelineStages)
      .where(
        and(
          eq(leadPipelineStages.leadId, leadId),
          inArray(leadPipelineStages.stageId, terminalIds)
        )
      )
      .orderBy(desc(leadPipelineStages.movedAt))
      .limit(1);
    if (last.length === 0) continue;

    const fromMs =
      first[0].movedAt instanceof Date
        ? first[0].movedAt.getTime()
        : new Date(first[0].movedAt as any).getTime();
    const toMs =
      last[0].movedAt instanceof Date
        ? last[0].movedAt.getTime()
        : new Date(last[0].movedAt as any).getTime();
    days.push((toMs - fromMs) / (1000 * 60 * 60 * 24));
  }

  if (days.length === 0)
    return {
      min: null,
      max: null,
      avg: null,
      median: null,
      distribution: [],
      count: 0,
    };

  const sorted = [...days].sort((a, b) => a - b);
  const median =
    sorted.length % 2 === 0
      ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      : sorted[Math.floor(sorted.length / 2)];

  // Distribución por buckets: 0-7, 8-14, 15-30, 31+
  const buckets = [
    { label: "0-7 días", min: 0, max: 7, count: 0, pct: 0 },
    { label: "8-14 días", min: 8, max: 14, count: 0, pct: 0 },
    { label: "15-30 días", min: 15, max: 30, count: 0, pct: 0 },
    { label: "31+ días", min: 31, max: Infinity, count: 0, pct: 0 },
  ];
  for (const d of days) {
    for (const b of buckets) {
      if (d >= b.min && d <= b.max) {
        b.count++;
        break;
      }
    }
  }
  for (const b of buckets) b.pct = Math.round((b.count / days.length) * 100);

  return {
    min: Math.round(sorted[0] * 10) / 10,
    max: Math.round(sorted[sorted.length - 1] * 10) / 10,
    avg: Math.round((days.reduce((a, b) => a + b, 0) / days.length) * 10) / 10,
    median: Math.round(median * 10) / 10,
    distribution: buckets,
    count: days.length,
  };
}

/**
 * 6) DROPOFF: Leads que no avanzaron de cada fase a la siguiente.
 */
export async function getDropOff(
  pipelineId: number,
  startDate?: string,
  endDate?: string
) {
  const db = await getDb();
  if (!db) return [];

  const { start, end } = parseMetricDates(startDate, endDate);
  const cohortIds = await getCohortLeadIds(pipelineId, start, end);
  if (cohortIds.length === 0) return [];

  const stages = await db
    .select()
    .from(pipelineStages)
    .where(eq(pipelineStages.pipelineId, pipelineId))
    .orderBy(asc(pipelineStages.order));

  const result = [];
  for (let i = 0; i < stages.length - 1; i++) {
    const fromStage = stages[i];
    const toStage = stages[i + 1];

    const inFrom = await db
      .select({ leadId: leadPipelineStages.leadId })
      .from(leadPipelineStages)
      .where(
        and(
          eq(leadPipelineStages.stageId, fromStage.id),
          inArray(leadPipelineStages.leadId, cohortIds)
        )
      );
    const fromIds = new Set(inFrom.map(r => r.leadId));
    if (fromIds.size === 0) continue;

    const inTo = await db
      .select({ leadId: leadPipelineStages.leadId })
      .from(leadPipelineStages)
      .where(
        and(
          eq(leadPipelineStages.stageId, toStage.id),
          inArray(leadPipelineStages.leadId, Array.from(fromIds))
        )
      );
    const toIds = new Set(inTo.map(r => r.leadId));
    const dropped = fromIds.size - toIds.size;

    result.push({
      fromStage: fromStage.displayName,
      toStage: toStage.displayName,
      entered: fromIds.size,
      advanced: toIds.size,
      dropped,
      dropRate: Math.round((dropped / fromIds.size) * 1000) / 10,
    });
  }

  return result;
}

/* ============================================================
 * CRUD de metric_views (vistas guardadas de métricas)
 * ============================================================ */

export async function listMetricViewsForUser(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db
    .select()
    .from(metricViews)
    .where(eq(metricViews.userId, userId))
    .orderBy(desc(metricViews.updatedAt));
}

export async function createMetricView(
  data: Omit<InsertMetricView, "id" | "createdAt" | "updatedAt">
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [row] = await db.insert(metricViews).values(data).$returningId();
  if (!row) throw new Error("No fue posible guardar la vista.");
  const [saved] = await db
    .select()
    .from(metricViews)
    .where(eq(metricViews.id, row.id))
    .limit(1);
  return saved;
}

export async function deleteMetricView(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(metricViews).where(eq(metricViews.id, id));
}

/**
 * Busca un lead por teléfono o correo. Usado para detección de duplicados
 * en la importación de Excel.
 */
export async function findLeadByPhoneOrEmail(
  telefono: string | null,
  correo: string | null
): Promise<{ id: number; publicId: string } | null> {
  const db = await getDb();
  if (!db) return null;

  if (telefono) {
    const found = await db
      .select({ id: leads.id, publicId: leads.publicId })
      .from(leads)
      .where(eq(leads.telefono, telefono))
      .limit(1);
    if (found.length > 0) return found[0];
  }
  if (correo) {
    const found = await db
      .select({ id: leads.id, publicId: leads.publicId })
      .from(leads)
      .where(eq(leads.correo, correo))
      .limit(1);
    if (found.length > 0) return found[0];
  }
  return null;
}
