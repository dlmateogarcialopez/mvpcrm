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
  invitationStatusValues,
  leadPriorityValues,
  leadSourceValues,
  leadStatusValues,
  leadTypeValues,
  orgMemberStatusValues,
  orgRoleValues,
  orgStatusValues,
} from "../shared/leads";

/**
 * Raíz del aislamiento multi-tenant. Toda tabla de datos
 * (leads, pipelines, automatizaciones, etc.) cuelga de un
 * organizationId. La org con id=1 es la "default" que recibe
 * el backfill de los datos históricos.
 */
export const organizations = mysqlTable("organizations", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  slug: varchar("slug", { length: 80 }).notNull().unique(),
  status: mysqlEnum("status", [...orgStatusValues])
    .notNull()
    .default("active"),
  createdByUserId: int("createdByUserId").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/**
 * Membresía: qué usuarios pertenecen a qué organizaciones y
 * con qué rol interno. Un usuario puede estar en N orgs con
 * roles distintos (owner en Tienda, agent en Parqueadero).
 */
export const organizationMembers = mysqlTable(
  "organization_members",
  {
    id: int("id").autoincrement().primaryKey(),
    organizationId: int("organizationId")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: int("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    orgRole: mysqlEnum("orgRole", [...orgRoleValues])
      .notNull()
      .default("agent"),
    status: mysqlEnum("status", [...orgMemberStatusValues])
      .notNull()
      .default("active"),
    joinedAt: timestamp("joinedAt").defaultNow().notNull(),
  },
  table => ({
    uniqMember: index("uniq_organization_members_org_user").on(
      table.organizationId,
      table.userId
    ),
    byUser: index("idx_organization_members_user").on(table.userId),
  })
);

/**
 * Personalización por organización: branding, pricing, scoring,
 * meta, integraciones. La fuente de verdad reemplaza a la tabla
 * legacy appSettings (que se mantiene por compatibilidad).
 */
export const organizationSettings = mysqlTable("organization_settings", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId")
    .notNull()
    .unique()
    .references(() => organizations.id, { onDelete: "cascade" }),
  displayName: varchar("displayName", { length: 200 }),
  primaryColor: varchar("primaryColor", { length: 20 }),
  logoUrl: text("logoUrl"),
  faviconUrl: text("faviconUrl"),
  pricing: text("pricing"),
  scoring: text("scoring"),
  meta: text("meta"),
    integrations: text("integrations"),
    leadFieldDefs: text("leadFieldDefs"),
    formLayout: text("formLayout"),
    pricingFields: text("pricingFields"),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/**
 * Invitaciones pendientes a una organización. Cuando el usuario
 * las acepta, se crea una fila en organization_members.
 */
export const organizationInvitations = mysqlTable(
  "organization_invitations",
  {
    id: int("id").autoincrement().primaryKey(),
    organizationId: int("organizationId")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    email: varchar("email", { length: 320 }).notNull(),
    orgRole: mysqlEnum("orgRole", [...orgRoleValues])
      .notNull()
      .default("agent"),
    invitedByUserId: int("invitedByUserId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: varchar("token", { length: 64 }).notNull().unique(),
    status: mysqlEnum("status", [...invitationStatusValues])
      .notNull()
      .default("pending"),
    expiresAt: timestamp("expiresAt").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    byEmail: index("idx_organization_invitations_email").on(table.email),
    byOrg: index("idx_organization_invitations_org").on(table.organizationId),
  })
);

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  passwordHash: text("passwordHash"),
  role: mysqlEnum("role", [...appRoleValues])
    .default("agent")
    .notNull(),
  telegramChatId: varchar("telegramChatId", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

/**
 * Tabla legacy de configuración global. Mantenida por
 * compatibilidad: la fuente de verdad es organization_settings.
 * Programado para eliminar en migración 0015 post-validación.
 */
export const appSettings = mysqlTable("appSettings", {
  id: int("id").autoincrement().primaryKey(),
  configName: varchar("configName", { length: 120 })
    .notNull()
    .default("Configuración principal"),
  isDefault: boolean("isDefault").notNull().default(true),
  precioMultiple: int("precioMultiple").notNull().default(99000),
  precioJunior: int("precioJunior").notNull().default(69000),
  precioSenior: int("precioSenior").notNull().default(69000),
  precioParqueadero: int("precioParqueadero").notNull().default(8000),
  ticketPromedioReferencia: int("ticketPromedioReferencia")
    .notNull()
    .default(500000),
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
  updatedByUserId: int("updatedByUserId").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const settingsChangeLogs = mysqlTable(
  "settingsChangeLogs",
  {
    id: int("id").autoincrement().primaryKey(),
    organizationId: int("organizationId").notNull().default(1),
    settingsId: int("settingsId")
      .notNull()
      .references(() => appSettings.id, { onDelete: "cascade" }),
    changedByUserId: int("changedByUserId").references(() => users.id, {
      onDelete: "set null",
    }),
    summary: varchar("summary", { length: 255 }).notNull(),
    changedFields: text("changedFields").notNull(),
    previousSnapshot: text("previousSnapshot").notNull(),
    nextSnapshot: text("nextSnapshot").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    byOrg: index("idx_settings_change_logs_org").on(table.organizationId),
  })
);

/**
 * Tabla de embudos (pipelines). Cada embudo tiene sus propias fases.
 */
export const pipelines = mysqlTable(
  "pipelines",
  {
    id: int("id").primaryKey().autoincrement(),
    organizationId: int("organizationId").notNull().default(1),
    name: varchar("name", { length: 100 }).notNull(),
    description: text("description"),
    color: varchar("color", { length: 7 }).default("#3b82f6"),
    order: int("order").default(0),
    isActive: boolean("isActive").default(true),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    byOrg: index("idx_pipelines_org").on(table.organizationId),
  })
);

/**
 * Tabla para almacenar etapas de embudo personalizadas.
 * Cada fase pertenece a UN pipeline. El campo `kind` define su tipo semántico:
 *  - open: fase normal, sigue el flujo.
 *  - won: cierre positivo (terminal).
 *  - lost: cierre negativo (terminal).
 *  - paused: en espera.
 */
export const pipelineStages = mysqlTable(
  "pipeline_stages",
  {
    id: int("id").primaryKey().autoincrement(),
    organizationId: int("organizationId").notNull().default(1),
    pipelineId: int("pipelineId").notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    displayName: varchar("displayName", { length: 100 }).notNull(),
    color: varchar("color", { length: 7 }).default("#3b82f6"),
    order: int("order").default(0),
    isActive: boolean("isActive").default(true),
    kind: mysqlEnum("kind", ["open", "won", "lost", "paused"])
      .notNull()
      .default("open"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    byOrg: index("idx_pipeline_stages_org").on(table.organizationId),
  })
);

/**
 * Relación N:1 entre leads y fases por pipeline.
 * Un lead puede estar en UNA fase por cada pipeline.
 */
export const leadPipelineStages = mysqlTable(
  "lead_pipeline_stages",
  {
    id: int("id").primaryKey().autoincrement(),
    organizationId: int("organizationId").notNull().default(1),
    leadId: int("leadId").notNull(),
    pipelineId: int("pipelineId").notNull(),
    stageId: int("stageId").notNull(),
    movedAt: timestamp("movedAt").defaultNow().notNull(),
    movedByUserId: int("movedByUserId"),
  },
  table => ({
    byOrg: index("idx_lead_pipeline_stages_org").on(table.organizationId),
  })
);

/**
 * Tabla de permisos del sistema. Cada permiso es una acción atómica
 * que puede asignarse a usuarios con rol "custom".
 */
export const permissions = mysqlTable("permissions", {
  id: int("id").primaryKey().autoincrement(),
  key: varchar("key", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 100 }).notNull(),
  groupName: varchar("groupName", { length: 50 }).notNull(),
  description: varchar("description", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/**
 * Asignación de permisos a usuarios con rol "custom".
 * Scopado por organización: un usuario puede tener permission X
 * en la org A pero no en la org B.
 */
export const userPermissions = mysqlTable(
  "user_permissions",
  {
    id: int("id").primaryKey().autoincrement(),
    organizationId: int("organizationId").notNull().default(1),
    userId: int("userId").notNull(),
    permissionId: int("permissionId").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    byOrg: index("idx_user_permissions_org").on(table.organizationId),
  })
);

/**
 * Vistas guardadas de métricas de conversión.
 * Cada usuario puede guardar configuraciones de métricas para acceso rápido.
 */
export const metricViews = mysqlTable(
  "metric_views",
  {
    id: int("id").primaryKey().autoincrement(),
    organizationId: int("organizationId").notNull().default(1),
    userId: int("userId").notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    config: text("config").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    byOrg: index("idx_metric_views_org").on(table.organizationId),
  })
);

/**
 * Tabla para etiquetas personalizadas
 */
export const customLabels = mysqlTable(
  "custom_labels",
  {
    id: int("id").primaryKey().autoincrement(),
    organizationId: int("organizationId").notNull().default(1),
    name: varchar("name", { length: 50 }).notNull(),
    color: varchar("color", { length: 7 }).default("#6b7280"),
    description: text("description"),
    createdAt: timestamp("createdAt").defaultNow(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
  },
  table => ({
    byOrg: index("idx_custom_labels_org").on(table.organizationId),
  })
);

/**
 * Tabla para canales personalizados
 */
export const customChannels = mysqlTable(
  "custom_channels",
  {
    id: int("id").primaryKey().autoincrement(),
    organizationId: int("organizationId").notNull().default(1),
    name: varchar("name", { length: 100 }).notNull(),
    icon: varchar("icon", { length: 50 }).default("MessageSquare"),
    isActive: boolean("isActive").default(true),
    createdAt: timestamp("createdAt").defaultNow(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
  },
  table => ({
    byOrg: index("idx_custom_channels_org").on(table.organizationId),
  })
);

export const leads = mysqlTable(
  "leads",
  {
    id: int("id").autoincrement().primaryKey(),
    organizationId: int("organizationId").notNull().default(1),
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
    tipoEvento: mysqlEnum("tipoEvento", [...leadTypeValues])
      .notNull()
      .default("otro"),
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
    prioridadBase: mysqlEnum("prioridadBase", [...leadPriorityValues])
      .notNull()
      .default("gris"),
    prioridad: mysqlEnum("prioridad", [...leadPriorityValues])
      .notNull()
      .default("gris"),
    prioridadExplicacion: text("prioridadExplicacion"),
    estadoLead: varchar("estadoLead", { length: 50 })
      .notNull()
      .default("nuevo"),
    canalOrigen: varchar("canalOrigen", { length: 100 })
      .notNull()
      .default("otro"),
    labels: text("labels"), // JSON array de IDs de etiquetas
    agenteUserId: int("agenteUserId").references(() => users.id, {
      onDelete: "set null",
    }),
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
    calendarSyncStatus: mysqlEnum("calendarSyncStatus", [
      ...calendarSyncStatusValues,
    ])
      .notNull()
      .default("disabled"),
    calendarSyncMessage: text("calendarSyncMessage"),
    alertPending: boolean("alertPending").notNull().default(false),
    alertLastChannel: varchar("alertLastChannel", { length: 32 }),
    alertLastMessage: text("alertLastMessage"),
    lastAlertAt: bigint("lastAlertAt", { mode: "number" }),
    lastCallAt: timestamp("lastCallAt"),
    lastSmsAt: timestamp("lastSmsAt"),
    dialingStatus: varchar("dialingStatus", { length: 80 }),
    totalDialAttempts: int("totalDialAttempts").notNull().default(0),
    firedAfterVisitAt: timestamp("firedAfterVisitAt"),
    customData: text("customData"),
    closedAt: bigint("closedAt", { mode: "number" }),
    createdByUserId: int("createdByUserId")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    updatedByUserId: int("updatedByUserId")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    byOrg: index("idx_leads_org").on(table.organizationId),
  })
);

/**
 * Tabla para automatizaciones (reglas)
 */
export const automationRules = mysqlTable(
  "automation_rules",
  {
    id: int("id").primaryKey().autoincrement(),
    organizationId: int("organizationId").notNull().default(1),
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
  },
  table => ({
    byOrg: index("idx_automation_rules_org").on(table.organizationId),
  })
);

/**
 * Tabla para campañas de email marketing
 */
export const emailCampaigns = mysqlTable(
  "email_campaigns",
  {
    id: int("id").primaryKey().autoincrement(),
    organizationId: int("organizationId").notNull().default(1),
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
  },
  table => ({
    byOrg: index("idx_email_campaigns_org").on(table.organizationId),
  })
);

/**
 * Libreta de destinatarios para automatizaciones a personas específicas
 * (triggers opportunity_* y acciones send_*_to_user).
 * Solo el superadministrador puede gestionar este catálogo.
 */
export const automationRecipients = mysqlTable(
  "automation_recipients",
  {
    id: int("id").primaryKey().autoincrement(),
    organizationId: int("organizationId").notNull().default(1),
    name: varchar("name", { length: 160 }).notNull(),
    telegramChatId: varchar("telegramChatId", { length: 64 }),
    email: varchar("email", { length: 320 }).unique(),
    notes: text("notes"),
    isActive: boolean("isActive").notNull().default(true),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    byOrg: index("idx_automation_recipients_org").on(table.organizationId),
  })
);

export const leadActivities = mysqlTable(
  "leadActivities",
  {
    id: int("id").autoincrement().primaryKey(),
    organizationId: int("organizationId").notNull().default(1),
    leadId: int("leadId")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
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
      "call_attempt",
      "call_answered",
      "call_no_answer",
      "sms_sent",
      "sms_received",
    ]).notNull(),
    title: varchar("title", { length: 160 }).notNull(),
    description: text("description"),
    payload: text("payload"),
    isSystem: boolean("isSystem").notNull().default(false),
    createdByUserId: int("createdByUserId").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    byOrg: index("idx_lead_activities_org").on(table.organizationId),
  })
);

export const leadCalendarSyncs = mysqlTable(
  "leadCalendarSyncs",
  {
    id: int("id").autoincrement().primaryKey(),
    organizationId: int("organizationId").notNull().default(1),
    leadId: int("leadId")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    externalCalendarId: varchar("externalCalendarId", { length: 255 }),
    externalEventId: varchar("externalEventId", { length: 255 }),
    syncAction: mysqlEnum("syncAction", [
      "create",
      "update",
      "skip",
      "error",
      "manual",
    ]).notNull(),
    syncStatus: mysqlEnum("syncStatus", ["pending", "success", "error"])
      .notNull()
      .default("pending"),
    requestFingerprint: varchar("requestFingerprint", { length: 255 }),
    message: text("message"),
    triggeredByUserId: int("triggeredByUserId").references(() => users.id, {
      onDelete: "set null",
    }),
    syncedAt: timestamp("syncedAt").defaultNow().notNull(),
  },
  table => ({
    byOrg: index("idx_lead_calendar_syncs_org").on(table.organizationId),
  })
);

// ============================================================
// Módulo de Marcación (VoIP + SMS + Grabaciones)
// ============================================================

export const dialingQueues = mysqlTable(
  "dialing_queues",
  {
    id: int("id").autoincrement().primaryKey(),
    organizationId: int("organizationId").notNull().default(1),
    name: varchar("name", { length: 200 }).notNull(),
    ownerUserId: int("ownerUserId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    leadFilter: text("leadFilter"),
    maxAttempts: int("maxAttempts").notNull().default(1),
    retryDelayMinutes: int("retryDelayMinutes").notNull().default(60),
    callDelayMs: int("callDelayMs").notNull().default(3000),
    callerIdNumber: varchar("callerIdNumber", { length: 32 })
      .notNull()
      .default(""),
    whatsappNoAnswerTemplateName: varchar("whatsappNoAnswerTemplateName", {
      length: 120,
    }),
    whatsappNoAnswerTemplateVars: text("whatsappNoAnswerTemplateVars"),
    status: mysqlEnum("status", [
      "draft",
      "active",
      "paused",
      "completed",
      "cancelled",
    ])
      .notNull()
      .default("draft"),
    currentLeadId: int("currentLeadId"),
    totalLeads: int("totalLeads").notNull().default(0),
    completedLeads: int("completedLeads").notNull().default(0),
    startedAt: timestamp("startedAt"),
    pausedAt: timestamp("pausedAt"),
    completedAt: timestamp("completedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    byOrg: index("idx_dialing_queues_org").on(table.organizationId),
    byStatus: index("idx_dialing_queues_status").on(
      table.organizationId,
      table.status
    ),
  })
);

export const dialingQueueLeads = mysqlTable(
  "dialing_queue_leads",
  {
    id: int("id").autoincrement().primaryKey(),
    organizationId: int("organizationId").notNull().default(1),
    queueId: int("queueId")
      .notNull()
      .references(() => dialingQueues.id, { onDelete: "cascade" }),
    leadId: int("leadId")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    position: int("position").notNull(),
    status: mysqlEnum("status", [
      "pending",
      "calling",
      "answered",
      "no_answer",
      "skipped",
      "exhausted",
      "completed",
    ])
      .notNull()
      .default("pending"),
    attempts: int("attempts").notNull().default(0),
    lastAttemptId: int("lastAttemptId"),
    lastOutcome: mysqlEnum("lastOutcome", [
      "answered",
      "no_answer",
      "busy",
      "failed",
      "skipped",
    ]),
    lastAttemptAt: timestamp("lastAttemptAt"),
    completedAt: timestamp("completedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    uniqQueueLead: index("uniq_dialing_queue_leads_queue_lead").on(
      table.queueId,
      table.leadId
    ),
    byOrg: index("idx_dialing_queue_leads_org").on(table.organizationId),
    byStatus: index("idx_dialing_queue_leads_status").on(
      table.queueId,
      table.status,
      table.position
    ),
  })
);

export const dialAttempts = mysqlTable(
  "dial_attempts",
  {
    id: int("id").autoincrement().primaryKey(),
    organizationId: int("organizationId").notNull().default(1),
    queueId: int("queueId")
      .notNull()
      .references(() => dialingQueues.id, { onDelete: "cascade" }),
    queueLeadId: int("queueLeadId")
      .notNull()
      .references(() => dialingQueueLeads.id, { onDelete: "cascade" }),
    leadId: int("leadId")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    userId: int("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    twilioCallSid: varchar("twilioCallSid", { length: 64 }),
    status: mysqlEnum("status", [
      "initiated",
      "ringing",
      "in_progress",
      "completed",
      "busy",
      "failed",
      "no_answer",
    ])
      .notNull()
      .default("initiated"),
    initiatedAt: timestamp("initiatedAt").defaultNow().notNull(),
    answeredAt: timestamp("answeredAt"),
    endedAt: timestamp("endedAt"),
    durationSec: int("durationSec"),
    whatsappMessageSid: varchar("whatsappMessageSid", { length: 64 }),
    whatsappSentAt: timestamp("whatsappSentAt"),
    agentMarkedOutcome: mysqlEnum("agentMarkedOutcome", [
      "answered",
      "no_answer",
    ]),
    agentMarkedAt: timestamp("agentMarkedAt"),
    recordingUrl: varchar("recordingUrl", { length: 500 }),
    notes: text("notes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    byOrg: index("idx_dial_attempts_org").on(
      table.organizationId,
      table.createdAt
    ),
    byLead: index("idx_dial_attempts_lead").on(table.leadId),
  })
);

export const smsMessages = mysqlTable(
  "sms_messages",
  {
    id: int("id").autoincrement().primaryKey(),
    organizationId: int("organizationId").notNull().default(1),
    leadId: int("leadId")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    twilioMessageSid: varchar("twilioMessageSid", { length: 64 }),
    direction: mysqlEnum("direction", ["inbound", "outbound"])
      .notNull()
      .default("outbound"),
    fromNumber: varchar("fromNumber", { length: 32 }).notNull(),
    toNumber: varchar("toNumber", { length: 32 }).notNull(),
    body: text("body"),
    numMedia: int("numMedia").notNull().default(0),
    mediaUrl: text("mediaUrl"),
    sentAt: timestamp("sentAt").defaultNow().notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    byOrg: index("idx_sms_messages_org").on(table.organizationId, table.sentAt),
    byLead: index("idx_sms_messages_lead").on(table.leadId),
  })
);

export const callRecordings = mysqlTable(
  "call_recordings",
  {
    id: int("id").autoincrement().primaryKey(),
    organizationId: int("organizationId").notNull().default(1),
    leadId: int("leadId").references(() => leads.id, { onDelete: "set null" }),
    attemptId: int("attemptId").references(() => dialAttempts.id, {
      onDelete: "set null",
    }),
    twilioCallSid: varchar("twilioCallSid", { length: 64 }),
    twilioRecordingSid: varchar("twilioRecordingSid", { length: 64 }),
    filePath: varchar("filePath", { length: 500 }),
    durationSec: int("durationSec").notNull().default(0),
    status: mysqlEnum("status", ["pending", "downloaded", "failed"])
      .notNull()
      .default("pending"),
    downloadedAt: timestamp("downloadedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    byOrg: index("idx_call_recordings_org").on(table.organizationId),
    byLead: index("idx_call_recordings_lead").on(table.leadId),
  })
);

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
export type InsertPipelineStage = typeof pipelineStages.$inferInsert;
export type Pipeline = typeof pipelines.$inferSelect;
export type InsertPipeline = typeof pipelines.$inferInsert;
export type LeadPipelineStage = typeof leadPipelineStages.$inferSelect;
export type InsertLeadPipelineStage = typeof leadPipelineStages.$inferInsert;
export type MetricView = typeof metricViews.$inferSelect;
export type InsertMetricView = typeof metricViews.$inferInsert;
export type CustomLabel = typeof customLabels.$inferSelect;
export type CustomChannel = typeof customChannels.$inferSelect;
export type AutomationRule = typeof automationRules.$inferSelect;
export type EmailCampaign = typeof emailCampaigns.$inferSelect;
export type AutomationRecipient = typeof automationRecipients.$inferSelect;
export type InsertAutomationRecipient =
  typeof automationRecipients.$inferInsert;
export type Permission = typeof permissions.$inferSelect;
export type InsertPermission = typeof permissions.$inferInsert;
export type UserPermission = typeof userPermissions.$inferSelect;
export type InsertUserPermission = typeof userPermissions.$inferInsert;

// ============================================================
// Listas Telefónicas con Auto-Marcación
// ============================================================

export const phoneLists = mysqlTable(
  "phone_lists",
  {
    id: int("id").autoincrement().primaryKey(),
    organizationId: int("organizationId").notNull().default(1),
    name: varchar("name", { length: 200 }).notNull(),
    ownerUserId: int("ownerUserId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: mysqlEnum("status", [
      "idle",
      "active",
      "paused",
      "completed",
      "cancelled",
    ])
      .notNull()
      .default("idle"),
    callDelayMs: int("callDelayMs").notNull().default(3000),
    autoMessage: text("autoMessage"),
    currentEntryId: int("currentEntryId"),
    totalEntries: int("totalEntries").notNull().default(0),
    completedEntries: int("completedEntries").notNull().default(0),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    byOrg: index("idx_phone_lists_org").on(table.organizationId),
  })
);

export const phoneListEntries = mysqlTable(
  "phone_list_entries",
  {
    id: int("id").autoincrement().primaryKey(),
    listId: int("listId")
      .notNull()
      .references(() => phoneLists.id, { onDelete: "cascade" }),
    organizationId: int("organizationId").notNull().default(1),
    name: varchar("name", { length: 200 }).notNull().default(""),
    phoneNumber: varchar("phoneNumber", { length: 32 }).notNull(),
    leadId: int("leadId").references(() => leads.id, { onDelete: "set null" }),
    position: int("position").notNull(),
    status: mysqlEnum("status", [
      "pending",
      "calling",
      "answered",
      "no_answer",
      "skipped",
    ])
      .notNull()
      .default("pending"),
    calledAt: timestamp("calledAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    byList: index("idx_phone_list_entries_list").on(
      table.listId,
      table.position
    ),
    byOrg: index("idx_phone_list_entries_org").on(table.organizationId),
    byLead: index("idx_phone_list_entries_lead").on(table.leadId),
  })
);

// Multi-tenant (organizations)
export type Organization = typeof organizations.$inferSelect;
export type InsertOrganization = typeof organizations.$inferInsert;
export type OrganizationMember = typeof organizationMembers.$inferSelect;
export type InsertOrganizationMember = typeof organizationMembers.$inferInsert;
export type OrganizationSettings = typeof organizationSettings.$inferSelect;
export type InsertOrganizationSettings =
  typeof organizationSettings.$inferInsert;
export type OrganizationInvitation =
  typeof organizationInvitations.$inferSelect;
export type InsertOrganizationInvitation =
  typeof organizationInvitations.$inferInsert;

// Módulo de Marcación (VoIP + SMS + Grabaciones)
export type DialingQueue = typeof dialingQueues.$inferSelect;
export type InsertDialingQueue = typeof dialingQueues.$inferInsert;
export type DialingQueueLead = typeof dialingQueueLeads.$inferSelect;
export type InsertDialingQueueLead = typeof dialingQueueLeads.$inferInsert;
export type DialAttempt = typeof dialAttempts.$inferSelect;
export type InsertDialAttempt = typeof dialAttempts.$inferInsert;
export type SmsMessage = typeof smsMessages.$inferSelect;
export type InsertSmsMessage = typeof smsMessages.$inferInsert;
export type CallRecording = typeof callRecordings.$inferSelect;
export type InsertCallRecording = typeof callRecordings.$inferInsert;

// Listas Telefónicas
export type PhoneList = typeof phoneLists.$inferSelect;
export type InsertPhoneList = typeof phoneLists.$inferInsert;
export type PhoneListEntry = typeof phoneListEntries.$inferSelect;
export type InsertPhoneListEntry = typeof phoneListEntries.$inferInsert;
