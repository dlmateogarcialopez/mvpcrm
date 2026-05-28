import {
  bigint,
  boolean,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  index,
} from "drizzle-orm/mysql-core";
import {
  appRoleValues,
  calendarSyncStatusValues,
  leadPriorityValues,
  leadSourceValues,
  leadStatusValues,
  leadTypeValues,
} from "../shared/leads";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", [...appRoleValues]).default("agent").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const appSettings = mysqlTable("appSettings", {
  id: int("id").autoincrement().primaryKey(),
  configName: varchar("configName", { length: 120 }).notNull().default("Configuración principal"),
  isDefault: boolean("isDefault").notNull().default(true),
  precioMultiple: int("precioMultiple").notNull().default(99000),
  precioJunior: int("precioJunior").notNull().default(69000),
  precioSenior: int("precioSenior").notNull().default(69000),
  precioParqueadero: int("precioParqueadero").notNull().default(8000),
  ticketPromedioReferencia: int("ticketPromedioReferencia").notNull().default(500000),
  minimoPersonasAmarillo: int("minimoPersonasAmarillo").notNull().default(100),
  minimoPersonasRojo: int("minimoPersonasRojo").notNull().default(200),
  minimoValorAmarillo: int("minimoValorAmarillo").notNull().default(20000000),
  minimoValorRojo: int("minimoValorRojo").notNull().default(35000000),
  diasUrgenciaAlta: int("diasUrgenciaAlta").notNull().default(2),
  horasLeadCaliente: int("horasLeadCaliente").notNull().default(1),
  scoreAltoThreshold: int("scoreAltoThreshold").notNull().default(65),
  metaIngresosMensual: int("metaIngresosMensual").notNull().default(50000000),
  comisionPorcentaje: int("comisionPorcentaje").notNull().default(5),
  calendarSyncEnabled: boolean("calendarSyncEnabled").notNull().default(false),
  googleCalendarId: varchar("googleCalendarId", { length: 255 }),
  emailAlertsEnabled: boolean("emailAlertsEnabled").notNull().default(false),
  smsAlertsEnabled: boolean("smsAlertsEnabled").notNull().default(false),
  alertEmailTo: varchar("alertEmailTo", { length: 320 }),
  alertSmsTo: varchar("alertSmsTo", { length: 32 }),
  updatedByUserId: int("updatedByUserId").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const settingsChangeLogs = mysqlTable("settingsChangeLogs", {
  id: int("id").autoincrement().primaryKey(),
  settingsId: int("settingsId").notNull().references(() => appSettings.id, { onDelete: "cascade" }),
  changedByUserId: int("changedByUserId").references(() => users.id, { onDelete: "set null" }),
  summary: varchar("summary", { length: 255 }).notNull(),
  changedFields: text("changedFields").notNull(),
  previousSnapshot: text("previousSnapshot").notNull(),
  nextSnapshot: text("nextSnapshot").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/**
 * Tabla para almacenar etapas de embudo personalizadas
 */
export const pipelineStages = mysqlTable(
  "pipeline_stages",
  {
    id: int("id").primaryKey().autoincrement(),
    name: varchar("name", { length: 100 }).notNull(),
    displayName: varchar("displayName", { length: 100 }).notNull(),
    color: varchar("color", { length: 7 }).default("#3b82f6"),
    order: int("order").default(0),
    isActive: boolean("isActive").default(true),
    createdAt: timestamp("createdAt").defaultNow(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
  }
);

/**
 * Tabla para etiquetas personalizadas
 */
export const customLabels = mysqlTable(
  "custom_labels",
  {
    id: int("id").primaryKey().autoincrement(),
    name: varchar("name", { length: 50 }).notNull(),
    color: varchar("color", { length: 7 }).default("#6b7280"),
    description: text("description"),
    createdAt: timestamp("createdAt").defaultNow(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
  }
);

/**
 * Tabla para canales personalizados
 */
export const customChannels = mysqlTable(
  "custom_channels",
  {
    id: int("id").primaryKey().autoincrement(),
    name: varchar("name", { length: 100 }).notNull(),
    icon: varchar("icon", { length: 50 }).default("MessageSquare"),
    isActive: boolean("isActive").default(true),
    createdAt: timestamp("createdAt").defaultNow(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
  }
);

export const leads = mysqlTable("leads", {
  id: int("id").autoincrement().primaryKey(),
  publicId: varchar("publicId", { length: 32 }).notNull().unique(),
  contactoNombre: varchar("contactoNombre", { length: 160 }),
  contactoTelefono: varchar("contactoTelefono", { length: 32 }),
  contactoCorreo: varchar("contactoCorreo", { length: 320 }),
  empresaNombre: varchar("empresaNombre", { length: 160 }),
  empresaCiudad: varchar("empresaCiudad", { length: 120 }),
  nombreCliente: varchar("nombreCliente", { length: 160 }).notNull(),
  nombreEmpresa: varchar("nombreEmpresa", { length: 160 }),
  ciudad: varchar("ciudad", { length: 120 }),
  telefono: varchar("telefono", { length: 32 }).notNull(),
  correo: varchar("correo", { length: 320 }).notNull(),
  fechaVisita: bigint("fechaVisita", { mode: "number" }).notNull(),
  motivoVisita: text("motivoVisita").notNull(),
  tipoEvento: mysqlEnum("tipoEvento", [...leadTypeValues]).notNull().default("otro"),
  objecionPrincipal: text("objecionPrincipal").notNull(),
  cantidadMultiple: int("cantidadMultiple").notNull().default(0),
  cantidadJunior: int("cantidadJunior").notNull().default(0),
  cantidadSenior: int("cantidadSenior").notNull().default(0),
  cantidadParqueadero: int("cantidadParqueadero").notNull().default(0),
  precioMultiple: int("precioMultiple").notNull().default(99000),
  precioJunior: int("precioJunior").notNull().default(69000),
  precioSenior: int("precioSenior").notNull().default(69000),
  precioParqueadero: int("precioParqueadero").notNull().default(8000),
  subtotalMultiple: int("subtotalMultiple").notNull().default(0),
  subtotalJunior: int("subtotalJunior").notNull().default(0),
  subtotalSenior: int("subtotalSenior").notNull().default(0),
  subtotalParqueadero: int("subtotalParqueadero").notNull().default(0),
  totalPersonas: int("totalPersonas").notNull().default(0),
  valorTotal: int("valorTotal").notNull().default(0),
  ticketPromedio: int("ticketPromedio").notNull().default(0),
  scoreCantidad: int("scoreCantidad").notNull().default(0),
  scoreValorTotal: int("scoreValorTotal").notNull().default(0),
  scoreTicketPromedio: int("scoreTicketPromedio").notNull().default(0),
  scoreUrgencia: int("scoreUrgencia").notNull().default(0),
  scoreRecencia: int("scoreRecencia").notNull().default(0),
  scoreTotal: int("scoreTotal").notNull().default(0),
  prioridadBase: mysqlEnum("prioridadBase", [...leadPriorityValues]).notNull().default("gris"),
  prioridad: mysqlEnum("prioridad", [...leadPriorityValues]).notNull().default("gris"),
  prioridadExplicacion: text("prioridadExplicacion"),
  estadoLead: varchar("estadoLead", { length: 50 }).notNull().default("nuevo"),
  canalOrigen: varchar("canalOrigen", { length: 100 }).notNull().default("otro"),
  labels: text("labels"), // JSON array de IDs de etiquetas
  agenteUserId: int("agenteUserId").references(() => users.id, { onDelete: "set null" }),
  agenteResponsable: varchar("agenteResponsable", { length: 160 }),
  fechaIngresoLead: bigint("fechaIngresoLead", { mode: "number" }).notNull(),
  fechaLimiteGestion: bigint("fechaLimiteGestion", { mode: "number" }),
  ultimaGestion: bigint("ultimaGestion", { mode: "number" }),
  proximaAccion: text("proximaAccion"),
  notasInternas: text("notasInternas"),
  motivoPerdido: varchar("motivoPerdido", { length: 240 }),
  motivoPausa: varchar("motivoPausa", { length: 240 }),
  lastActivityAt: bigint("lastActivityAt", { mode: "number" }),
  calendarEventId: varchar("calendarEventId", { length: 255 }),
  calendarEventUrl: text("calendarEventUrl"),
  calendarSyncStatus: mysqlEnum("calendarSyncStatus", [...calendarSyncStatusValues]).notNull().default("disabled"),
  calendarSyncMessage: text("calendarSyncMessage"),
  alertPending: boolean("alertPending").notNull().default(false),
  alertLastChannel: varchar("alertLastChannel", { length: 32 }),
  alertLastMessage: text("alertLastMessage"),
  lastAlertAt: bigint("lastAlertAt", { mode: "number" }),
  closedAt: bigint("closedAt", { mode: "number" }),
  createdByUserId: int("createdByUserId").notNull().references(() => users.id, { onDelete: "restrict" }),
  updatedByUserId: int("updatedByUserId").notNull().references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/**
 * Tabla para automatizaciones (reglas)
 */
export const automationRules = mysqlTable(
  "automation_rules",
  {
    id: int("id").primaryKey().autoincrement(),
    name: varchar("name", { length: 150 }).notNull(),
    description: text("description"),
    trigger: varchar("trigger", { length: 50 }).notNull(),
    triggerCondition: text("triggerCondition"),
    action: varchar("action", { length: 50 }).notNull(),
    actionData: text("actionData"),
    isActive: boolean("isActive").default(true),
    executionCount: int("executionCount").default(0),
    lastExecutedAt: timestamp("lastExecutedAt"),
    createdAt: timestamp("createdAt").defaultNow(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
  }
);

/**
 * Tabla para campañas de email marketing
 */
export const emailCampaigns = mysqlTable(
  "email_campaigns",
  {
    id: int("id").primaryKey().autoincrement(),
    name: varchar("name", { length: 150 }).notNull(),
    subject: varchar("subject", { length: 200 }).notNull(),
    templateId: int("templateId"),
    content: text("content"),
    targetSegment: varchar("targetSegment", { length: 50 }).notNull(),
    targetSegmentData: text("targetSegmentData"),
    status: varchar("status", { length: 20 }).default("draft"),
    scheduledAt: timestamp("scheduledAt"),
    sentAt: timestamp("sentAt"),
    totalSent: int("totalSent").default(0),
    totalOpened: int("totalOpened").default(0),
    totalClicked: int("totalClicked").default(0),
    createdAt: timestamp("createdAt").defaultNow(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
  }
);

export const leadActivities = mysqlTable("leadActivities", {
  id: int("id").autoincrement().primaryKey(),
  leadId: int("leadId").notNull().references(() => leads.id, { onDelete: "cascade" }),
  activityType: mysqlEnum("activityType", [
    "lead_created",
    "lead_updated",
    "status_changed",
    "note_added",
    "assignment_changed",
    "sensitive_fields_changed",
    "calendar_sync",
    "alert_sent",
    "automation",
  ]).notNull(),
  title: varchar("title", { length: 160 }).notNull(),
  description: text("description"),
  payload: text("payload"),
  isSystem: boolean("isSystem").notNull().default(false),
  createdByUserId: int("createdByUserId").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const leadCalendarSyncs = mysqlTable("leadCalendarSyncs", {
  id: int("id").autoincrement().primaryKey(),
  leadId: int("leadId").notNull().references(() => leads.id, { onDelete: "cascade" }),
  externalCalendarId: varchar("externalCalendarId", { length: 255 }),
  externalEventId: varchar("externalEventId", { length: 255 }),
  syncAction: mysqlEnum("syncAction", ["create", "update", "skip", "error", "manual"]).notNull(),
  syncStatus: mysqlEnum("syncStatus", ["pending", "success", "error"]).notNull().default("pending"),
  requestFingerprint: varchar("requestFingerprint", { length: 255 }),
  message: text("message"),
  triggeredByUserId: int("triggeredByUserId").references(() => users.id, { onDelete: "set null" }),
  syncedAt: timestamp("syncedAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type AppSettings = typeof appSettings.$inferSelect;
export type InsertAppSettings = typeof appSettings.$inferInsert;
export type SettingsChangeLog = typeof settingsChangeLogs.$inferSelect;
export type InsertSettingsChangeLog = typeof settingsChangeLogs.$inferInsert;
export type Lead = typeof leads.$inferSelect;
export type InsertLead = typeof leads.$inferInsert;
export type LeadActivity = typeof leadActivities.$inferSelect;
export type InsertLeadActivity = typeof leadActivities.$inferInsert;
export type LeadCalendarSync = typeof leadCalendarSyncs.$inferSelect;
export type InsertLeadCalendarSync = typeof leadCalendarSyncs.$inferInsert;
export type PipelineStage = typeof pipelineStages.$inferSelect;
export type CustomLabel = typeof customLabels.$inferSelect;
export type CustomChannel = typeof customChannels.$inferSelect;
export type AutomationRule = typeof automationRules.$inferSelect;
export type EmailCampaign = typeof emailCampaigns.$inferSelect;
