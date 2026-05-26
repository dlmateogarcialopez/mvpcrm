import { int, varchar, text, timestamp, boolean, mysqlTable, primaryKey, index } from "drizzle-orm/mysql-core";

/**
 * Tabla para almacenar etapas de embudo personalizadas
 */
export const pipelineStages = mysqlTable(
  "pipeline_stages",
  {
    id: int().primaryKey().autoincrement(),
    organizationId: int().notNull(),
    name: varchar({ length: 100 }).notNull(),
    displayName: varchar({ length: 100 }).notNull(),
    color: varchar({ length: 7 }).default("#3b82f6"), // Código hexadecimal
    order: int().default(0),
    isActive: boolean().default(true),
    createdAt: timestamp().defaultNow(),
    updatedAt: timestamp().defaultNow().onUpdateNow(),
  },
  table => ({
    orgIdx: index("org_id_idx").on(table.organizationId),
  })
);

/**
 * Tabla para etiquetas personalizadas
 */
export const customLabels = mysqlTable(
  "custom_labels",
  {
    id: int().primaryKey().autoincrement(),
    organizationId: int().notNull(),
    name: varchar({ length: 50 }).notNull(),
    color: varchar({ length: 7 }).default("#6b7280"),
    description: text(),
    createdAt: timestamp().defaultNow(),
    updatedAt: timestamp().defaultNow().onUpdateNow(),
  },
  table => ({
    orgIdx: index("org_id_idx").on(table.organizationId),
  })
);

/**
 * Tabla para canales personalizados
 */
export const customChannels = mysqlTable(
  "custom_channels",
  {
    id: int().primaryKey().autoincrement(),
    organizationId: int().notNull(),
    name: varchar({ length: 100 }).notNull(),
    icon: varchar({ length: 50 }).default("MessageSquare"),
    isActive: boolean().default(true),
    createdAt: timestamp().defaultNow(),
    updatedAt: timestamp().defaultNow().onUpdateNow(),
  },
  table => ({
    orgIdx: index("org_id_idx").on(table.organizationId),
  })
);

/**
 * Tabla para automatizaciones (reglas)
 */
export const automationRules = mysqlTable(
  "automation_rules",
  {
    id: int().primaryKey().autoincrement(),
    organizationId: int().notNull(),
    name: varchar({ length: 150 }).notNull(),
    description: text(),
    trigger: varchar({ length: 50 }).notNull(), // "lead_created", "status_changed", "label_added"
    triggerCondition: text(), // JSON con las condiciones
    action: varchar({ length: 50 }).notNull(), // "assign_agent", "send_email", "add_label", "change_status"
    actionData: text(), // JSON con los datos de la acción
    isActive: boolean().default(true),
    executionCount: int().default(0),
    lastExecutedAt: timestamp(),
    createdAt: timestamp().defaultNow(),
    updatedAt: timestamp().defaultNow().onUpdateNow(),
  },
  table => ({
    orgIdx: index("org_id_idx").on(table.organizationId),
  })
);

/**
 * Tabla para campañas de email marketing
 */
export const emailCampaigns = mysqlTable(
  "email_campaigns",
  {
    id: int().primaryKey().autoincrement(),
    organizationId: int().notNull(),
    name: varchar({ length: 150 }).notNull(),
    subject: varchar({ length: 200 }).notNull(),
    templateId: int(),
    content: text(),
    targetSegment: varchar({ length: 50 }).notNull(), // "all_leads", "by_stage", "by_label"
    targetSegmentData: text(), // JSON con filtros
    status: varchar({ length: 20 }).default("draft"), // "draft", "scheduled", "sent", "paused"
    scheduledAt: timestamp(),
    sentAt: timestamp(),
    totalSent: int().default(0),
    totalOpened: int().default(0),
    totalClicked: int().default(0),
    createdAt: timestamp().defaultNow(),
    updatedAt: timestamp().defaultNow().onUpdateNow(),
  },
  table => ({
    orgIdx: index("org_id_idx").on(table.organizationId),
  })
);

/**
 * Tabla para plantillas de email
 */
export const emailTemplates = mysqlTable(
  "email_templates",
  {
    id: int().primaryKey().autoincrement(),
    organizationId: int().notNull(),
    name: varchar({ length: 100 }).notNull(),
    subject: varchar({ length: 200 }).notNull(),
    content: text(),
    variables: text(), // JSON con variables disponibles
    createdAt: timestamp().defaultNow(),
    updatedAt: timestamp().defaultNow().onUpdateNow(),
  },
  table => ({
    orgIdx: index("org_id_idx").on(table.organizationId),
  })
);

/**
 * Tabla para seguimiento de emails
 */
export const emailTracking = mysqlTable(
  "email_tracking",
  {
    id: int().primaryKey().autoincrement(),
    campaignId: int().notNull(),
    leadId: int().notNull(),
    status: varchar({ length: 20 }).default("sent"), // "sent", "opened", "clicked", "bounced"
    openedAt: timestamp(),
    clickedAt: timestamp(),
    clickedUrl: varchar({ length: 500 }),
    createdAt: timestamp().defaultNow(),
  },
  table => ({
    campaignIdx: index("campaign_id_idx").on(table.campaignId),
    leadIdx: index("lead_id_idx").on(table.leadId),
  })
);
