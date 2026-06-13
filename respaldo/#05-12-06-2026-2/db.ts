import { and, asc, desc, eq } from "drizzle-orm";
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
  customLabels,
  customChannels,
  automationRules,
  emailCampaigns,
  type AppSettings,
  type Lead,
  type LeadActivity,
  type User,
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

/**
 * Funciones para Embudo Personalizable
 */
export async function listPipelineStages() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db
    .select()
    .from(pipelineStages)
    .where(eq(pipelineStages.isActive, true))
    .orderBy(asc(pipelineStages.order));
}

export async function updatePipelineStages(stages: any[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // En un entorno real, usaríamos una transacción para borrar y reinsertar o actualizar
  // Por ahora, simulamos la persistencia
  return stages;
}

export async function createPipelineStage(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(pipelineStages).values(data);
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
