import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as XLSX from "xlsx";
import * as db from "../db";
import {
  addLeadActivity,
  createLead,
  findDuplicateLeads,
  getDashboardSnapshot,
  getDefaultPipeline,
  getLeadByPublicId,
  getLeadFieldDefs,
  getFormLayout,
  getPipelineStage,
  getPipelineStageByName,
  getPricingFieldsConfig,
  getPricingLines,
  DEFAULT_PRICING_LINES,
  listLeadPipelineAssignmentsWithDetails,
  listLeads,
  listLeadsByPipeline,
  listLeadsForExport,
  listPipelineStages,
  removeLeadFromPipeline,
  setLeadFieldDefs,
  setFormLayout,
  setPricingFieldsConfig,
  setLeadStageInPipeline,
  updateLead,
  updateLeadStatus,
  updateLeadStatusField,
  type CurrentUser,
} from "../db";
import {
  validateLeadImport,
  LEAD_IMPORT_FIELDS,
  type ValidationResult,
} from "../services/leadImport";
import {
  leadActivityCreateSchema,
  leadCreateSchema,
  leadFiltersSchema,
  leadIdSchema,
  leadStatusUpdateSchema,
  leadUpdateSchema,
} from "../../shared/leadSchemas";
import { protectedProcedure, router } from "../_core/trpc";
import { runLeadAutomation } from "../services/leadAutomation";
import { buildLeadWorkbookBuffer } from "../services/leadExport";
import { normalizeLeadTravelReason } from "../../shared/leads";

const FIELD_DISPLAY_ORDER: string[] = [
  "nombreCliente",
  "telefono",
  "correo",
  "nombreEmpresa",
  "ciudad",
  "canalOrigen",
  "fechaVisita",
  "tipoEvento",
  "motivoVisita",
  "objecionPrincipal",
  "cantidadMultiple",
  "cantidadJunior",
  "cantidadSenior",
  "cantidadParqueadero",
  "precioMultiple",
  "precioJunior",
  "precioSenior",
  "precioParqueadero",
  "estadoLead",
  "agenteResponsable",
  "fechaIngresoLead",
  "fechaLimiteGestion",
  "motivoPerdido",
  "motivoPausa",
  "notasInternas",
];

const BLOCK_INSERT_AFTER: Record<string, string> = {
  correo: "contacto",
  canalOrigen: "clasificacion",
  tipoEvento: "contexto",
};

interface FieldColumn {
  key: string;
  label: string;
  type: string;
  isCustom?: boolean;
  isPricing?: boolean;
}

function buildTemplateFieldOrder(
  customFields: any[],
  pricingFieldDefs: FieldColumn[]
): FieldColumn[] {
  const result: FieldColumn[] = [];
  const keyMap = new Map(Object.entries(LEAD_IMPORT_FIELDS));
  const seen = new Set<string>();
  const customByBlock: Record<string, any[]> = {};
  const unblocked: any[] = [];

  for (const cf of customFields) {
    if (cf.block) {
      (customByBlock[cf.block] ??= []).push(cf);
    } else {
      unblocked.push(cf);
    }
  }

  for (const block of Object.keys(customByBlock)) {
    customByBlock[block].sort((a: any, b: any) => (a.order ?? 99) - (b.order ?? 99));
  }

  function pushField(key: string, label: string, type: string, meta?: Partial<FieldColumn>) {
    result.push({ key, label, type, ...meta });
    seen.add(key);
  }

  for (const key of FIELD_DISPLAY_ORDER) {
    const def = keyMap.get(key);
    if (def) pushField(key, def.label, def.type);

    if (BLOCK_INSERT_AFTER[key]) {
      const blockFields = customByBlock[BLOCK_INSERT_AFTER[key]] ?? [];
      for (const cf of blockFields) {
        pushField(cf.key, cf.label, cf.type, { isCustom: true });
      }
    }

    if (key === "precioParqueadero") {
      for (const pf of pricingFieldDefs) {
        pushField(pf.key, pf.label, pf.type, { isPricing: true });
      }
    }
  }

  for (const cf of unblocked) {
    pushField(cf.key, cf.label, cf.type, { isCustom: true });
  }

  for (const [key, def] of Object.entries(LEAD_IMPORT_FIELDS)) {
    if (!seen.has(key)) pushField(key, def.label, def.type);
  }

  return result;
}

type RouterUser = Pick<CurrentUser, "id" | "role" | "name" | "email">;

function toCurrentUser(
  user: RouterUser,
  ctx?: { activeOrganizationId?: number | null; user?: any }
): CurrentUser {
  // El user del context (ctx.user) ya tiene activeOrgId y activeOrgRole
  // propagados desde el middleware. Si nos pasan el ctx.user, lo usamos
  // completo. Si nos pasan un user reducido (RouterUser), inferimos el
  // activeOrgId del ctx pero no podemos inferir el orgRole.
  if (ctx?.user && "activeOrgId" in ctx.user) {
    return {
      id: user.id,
      role: user.role,
      name: user.name,
      email: user.email,
      activeOrgId: ctx.user.activeOrgId,
      activeOrgRole: ctx.user.activeOrgRole ?? null,
    };
  }
  return {
    id: user.id,
    role: user.role,
    name: user.name,
    email: user.email,
    activeOrgId: ctx?.activeOrganizationId ?? null,
    activeOrgRole: null,
  };
}

async function loadLeadOrThrow(publicId: string, user: CurrentUser) {
  const lead = await getLeadByPublicId(publicId, user);

  if (!lead) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Lead no encontrado." });
  }

  return lead;
}

export const leadsRouter = router({
  dashboard: protectedProcedure.query(async ({ ctx }) => {
    const dashboard = await getDashboardSnapshot(toCurrentUser(ctx.user, ctx));
    // Ejecutar reglas after_visit para leads que aún no se han disparado.
    // Se ejecutan en segundo plano (fire-and-forget) para no ralentizar el dashboard.
    const orgId = ctx.activeOrganizationId;
    if (orgId) {
      const activeRules = await db.getActiveAutomationRules(orgId);
      const afterVisitRules = activeRules.filter(
        (r: any) => r.trigger === "after_visit"
      );
      if (afterVisitRules.length > 0) {
        const { getOrgIntegrations } = await import("../_core/orgIntegrations");
        const orgIntegrations = await getOrgIntegrations(orgId);
        const visible = await db.listVisibleLeadRows(
          toCurrentUser(ctx.user, ctx)
        );
        const enriched = visible.map(db.enrichLead);
        for (const lead of enriched) {
          if ((lead as any).firedAfterVisitAt) continue;
          if (lead.isClosed) continue;
          if (["ganado", "perdido"].includes(lead.estadoLead)) continue;
          if (!lead.fechaVisita || lead.fechaVisita >= Date.now()) continue;
          for (const rule of afterVisitRules) {
            try {
              const { executeRuleAction } =
                await import("../services/leadAutomation");
              await executeRuleAction(
                rule,
                lead as any,
                ctx.user.id,
                orgIntegrations
              );
              await db.incrementRuleExecution(rule.id);
              await db.markLeadAfterVisitFired(lead.id);
              console.log(
                `[Dashboard] after_visit disparado para ${lead.publicId}`
              );
            } catch (e: any) {
              console.warn(
                `[Dashboard] after_visit falló para ${lead.publicId}:`,
                e?.message
              );
            }
          }
        }
      }
    }
    return dashboard;
  }),

  list: protectedProcedure
    .input(leadFiltersSchema)
    .query(async ({ ctx, input }) => {
      return listLeads(input, toCurrentUser(ctx.user, ctx));
    }),

  exportSpreadsheet: protectedProcedure.mutation(async ({ ctx }) => {
    const orgId = ctx.activeOrganizationId ?? 1;
    const customFields = await getLeadFieldDefs(orgId);
    const pricingConfig = await getPricingFieldsConfig(orgId);
    const pricingLines = getPricingLines(pricingConfig);
    const customPricingLines = pricingLines.filter(l => !l.isStandard && l.visible);
    const pricingFieldDefs: FieldColumn[] = customPricingLines.flatMap(l => [
      { key: l.cantidadKey, label: `${l.label} (cantidad)`, type: "number" },
      { key: l.precioKey, label: `${l.label} (precio)`, type: "number" },
    ]);
    const columns = buildTemplateFieldOrder(customFields, pricingFieldDefs);
    const rows = await listLeadsForExport(toCurrentUser(ctx.user, ctx));
    const rowsWithCustom = rows.map(row => {
      const cd = (row as any).customDataParsed ?? {};
      for (const col of columns) {
        if (col.isPricing) {
          (row as any)[col.key] = cd[col.key] ?? (col.key.endsWith("_price") ? 
            customPricingLines.find(l => l.precioKey === col.key)?.precioDefault ?? 0 : 0);
        } else if (col.isCustom) {
          (row as any)[col.key] = cd[col.key];
        }
      }
      return row;
    });
    const allExportFields = columns.map(c => ({ key: c.key, label: c.label }));
    const workbook = buildLeadWorkbookBuffer(rowsWithCustom, allExportFields);
    const exportedAt = new Date();
    const stamp = exportedAt.toISOString().slice(0, 19).replace(/[T:]/g, "-");

    return {
      fileName: `crm-leads-${stamp}.xlsx`,
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      rowCount: rows.length,
      exportedAt: exportedAt.toISOString(),
      base64: workbook.toString("base64"),
    };
  }),

  /**
   * Valida un archivo Excel de importación. No toca la BD.
   * Devuelve el mapeo de columnas, faltantes, desconocidas y filas con su estado.
   */
  validateExcelImport: protectedProcedure
    .input(
      z.object({
        base64: z.string(),
        manualMapping: z.record(z.string(), z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.activeOrganizationId ?? 1;
      const customFields = await getLeadFieldDefs(orgId);
      const pricingConfig = await getPricingFieldsConfig(orgId);
      const pricingLines = getPricingLines(pricingConfig);
      const customPricingLines = pricingLines.filter(l => !l.isStandard && l.visible);
      const pricingFieldDefs: FieldColumn[] = customPricingLines.flatMap(l => [
        { key: l.cantidadKey, label: `${l.label} (cantidad)`, type: "number" },
        { key: l.precioKey, label: `${l.label} (precio)`, type: "number" },
      ]);
      const columns = buildTemplateFieldOrder(customFields, pricingFieldDefs);
      const allCustomFields = columns
        .filter(c => c.isCustom || c.isPricing)
        .map(c => ({ key: c.key, label: c.label, type: c.type, synonyms: [c.key, c.label.toLowerCase()] }));
      const buffer = Buffer.from(input.base64, "base64");
      const result: ValidationResult = validateLeadImport(
        buffer,
        input.manualMapping,
        allCustomFields
      );
      const mergedAvailable = columns.map(c => ({
        key: c.key,
        label: c.label,
        type: c.type,
      }));
      return {
        ...result,
        availableFields: mergedAvailable,
      };
    }),

  /**
   * Ejecuta la importación real de un archivo Excel validado.
   * Crea leads nuevos y, opcionalmente, actualiza duplicados.
   */
  executeExcelImport: protectedProcedure
    .input(
      z.object({
        base64: z.string(),
        manualMapping: z.record(z.string(), z.string()).optional(),
        duplicateAction: z.enum(["update", "create", "skip"]).default("skip"),
        perRowAction: z
          .record(
            z.string().regex(/^\d+$/),
            z.enum(["skip", "update", "create"])
          )
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.activeOrganizationId ?? 1;
      const customFields = await getLeadFieldDefs(orgId);
      const pricingConfig = await getPricingFieldsConfig(orgId);
      const pricingLines = getPricingLines(pricingConfig);
      const customPricingLines = pricingLines.filter(l => !l.isStandard && l.visible);
      const pricingFieldDefs: FieldColumn[] = customPricingLines.flatMap(l => [
        { key: l.cantidadKey, label: `${l.label} (cantidad)`, type: "number" },
        { key: l.precioKey, label: `${l.label} (precio)`, type: "number" },
      ]);
      const columns = buildTemplateFieldOrder(customFields, pricingFieldDefs);
      const customFieldKeys = new Set(
        columns.filter(c => c.isCustom || c.isPricing).map(c => c.key)
      );
      const allCustomFields = columns
        .filter(c => c.isCustom || c.isPricing)
        .map(c => ({ key: c.key, label: c.label, type: c.type, synonyms: [c.key, c.label.toLowerCase()] }));
      const buffer = Buffer.from(input.base64, "base64");
      const validation = validateLeadImport(buffer, input.manualMapping, allCustomFields);

      const currentUser = toCurrentUser(ctx.user, ctx);
      const numericUserId =
        typeof ctx.user.id === "string"
          ? parseInt(ctx.user.id, 10)
          : ctx.user.id;

      let created = 0;
      let updated = 0;
      let skipped = 0;
      const errors: Array<{ rowIndex: number; reason: string }> = [];
      const rows: Array<{
        rowIndex: number;
        action: "created" | "updated" | "skipped" | "error";
        publicId?: string;
        error?: string;
      }> = [];

      for (const row of validation.rows) {
        if (row.status === "error") {
          skipped++;
          rows.push({
            rowIndex: row.index,
            action: "error",
            error: row.errors.join("; "),
          });
          continue;
        }

        const rowAction =
          input.perRowAction?.[String(row.index)] ?? input.duplicateAction;

        const leadData: Record<string, any> = {};
        const customValues: Record<string, any> = {};
        for (const [field, cell] of Object.entries(row.data)) {
          if (customFieldKeys.has(field)) {
            customValues[field] = cell.raw;
          } else {
            leadData[field] = cell.raw;
          }
        }
        if (Object.keys(customValues).length > 0) {
          leadData.customData = customValues;
        }

        const existingLead = await db.findLeadByPhoneOrEmail(
          leadData.telefono ? String(leadData.telefono) : null,
          leadData.correo ? String(leadData.correo) : null
        );

        if (existingLead) {
          if (rowAction === "skip") {
            skipped++;
            rows.push({
              rowIndex: row.index,
              action: "skipped",
              publicId: existingLead.publicId,
            });
            continue;
          }
          if (rowAction === "update") {
            try {
              await db.updateLead(
                {
                  publicId: existingLead.publicId,
                  ...leadData,
                } as any,
                currentUser
              );
              updated++;
              rows.push({
                rowIndex: row.index,
                action: "updated",
                publicId: existingLead.publicId,
              });
            } catch (e: any) {
              errors.push({ rowIndex: row.index, reason: e.message });
              rows.push({
                rowIndex: row.index,
                action: "error",
                error: e.message,
              });
            }
            continue;
          }
        }

        try {
          const newLead = await createLead(leadData as any, currentUser);
          created++;
          rows.push({
            rowIndex: row.index,
            action: "created",
            publicId: newLead?.publicId,
          });
        } catch (e: any) {
          errors.push({ rowIndex: row.index, reason: e.message });
          rows.push({ rowIndex: row.index, action: "error", error: e.message });
        }
      }

      return {
        created,
        updated,
        skipped,
        errors,
        rows,
        total: validation.rows.length,
        duplicateAction: input.duplicateAction,
      };
    }),

  byId: protectedProcedure.input(leadIdSchema).query(async ({ ctx, input }) => {
    return loadLeadOrThrow(input.publicId, toCurrentUser(ctx.user, ctx));
  }),

  create: protectedProcedure
    .input(
      leadCreateSchema.safeExtend({
        forceCreate: z.boolean().optional(),
        pipelineAssignments: z
          .array(
            z.object({
              pipelineId: z.number(),
              stageId: z.number(),
            })
          )
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const currentUser = toCurrentUser(ctx.user, ctx);
      const orgId = ctx.activeOrganizationId ?? 1;

      if (!input.forceCreate) {
        const duplicates = await findDuplicateLeads(
          input.telefono?.trim() || null,
          input.correo?.trim().toLowerCase() || null,
          orgId
        );
        if (duplicates.length > 0) {
          return { duplicate: true, matches: duplicates };
        }
      }

      const lead = await createLead(input, currentUser);

      if (!lead) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "No fue posible crear el lead.",
        });
      }

      const numericLeadId =
        typeof lead.id === "string" ? parseInt(lead.id, 10) : lead.id;

      if (input.pipelineAssignments && input.pipelineAssignments.length > 0) {
        // Asignar a los pipelines seleccionados por el usuario
        for (const assignment of input.pipelineAssignments) {
          let stageId = assignment.stageId;
          // Si el stageId es 0 (no resuelto aún), buscar la primera fase del pipeline
          if (!stageId || stageId === 0) {
            const stages = await listPipelineStages(
              ctx.activeOrganizationId ?? 1,
              assignment.pipelineId
            );
            const firstStage = stages?.[0];
            if (firstStage) stageId = firstStage.id;
            else continue; // skip pipelines sin fases
          }
          await setLeadStageInPipeline(
            numericLeadId,
            assignment.pipelineId,
            stageId,
            ctx.user.id
          );
        }
      } else {
        // Si no seleccionó pipelines, asignar al Principal por defecto
        const defaultPipeline = await getDefaultPipeline(
          ctx.activeOrganizationId ?? 1
        );
        if (defaultPipeline) {
          const firstStage = await getPipelineStageByName(
            defaultPipeline.id,
            lead.estadoLead ?? "nuevo"
          );
          if (firstStage) {
            await setLeadStageInPipeline(
              numericLeadId,
              defaultPipeline.id,
              firstStage.id,
              ctx.user.id
            );
          }
        }
      }

      const automation = await runLeadAutomation(
        lead,
        ctx.user.id,
        ctx.activeOrganizationId,
        "lead_created"
      );
      const refreshedLead = await loadLeadOrThrow(lead.publicId, currentUser);

      return {
        success: true,
        lead: refreshedLead,
        automation,
      };
    }),

  /**
   * Quita un lead de un pipeline (lo deja en el Principal, o sin pipeline
   * si era el principal). El estado del lead no se modifica a nivel
   * del campo `estadoLead`; solo se actualiza la tabla lead_pipeline_stages.
   * Se registra la actividad correspondiente para agrupación visual
   * en el panel de embudo.
   */
  listByPipeline: protectedProcedure
    .input(z.object({ pipelineId: z.number() }))
    .query(async ({ ctx, input }) => {
      const currentUser = toCurrentUser(ctx.user, ctx);
      return listLeadsByPipeline(input.pipelineId, currentUser);
    }),

  update: protectedProcedure
    .input(leadUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      const currentUser = toCurrentUser(ctx.user, ctx);
      const lead = await updateLead(input, currentUser);

      if (!lead) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Lead no encontrado o sin permisos para editarlo.",
        });
      }

      const automation = await runLeadAutomation(
        lead,
        ctx.user.id,
        ctx.activeOrganizationId,
        "lead_updated"
      );
      const refreshedLead = await loadLeadOrThrow(lead.publicId, currentUser);

      return {
        lead: refreshedLead,
        automation,
      };
    }),

  updateStatus: protectedProcedure
    .input(leadStatusUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      const currentUser = toCurrentUser(ctx.user, ctx);
      const lead = await updateLeadStatus(input, currentUser);

      if (!lead) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Lead no encontrado o sin permisos para actualizarlo.",
        });
      }

      // Sincronizar lead_pipeline_stages para que el embudo refleje el cambio visualmente
      const numericLeadId =
        typeof lead.id === "string" ? parseInt(lead.id, 10) : lead.id;
      if (Number.isFinite(numericLeadId)) {
        const assignments = await listLeadPipelineAssignmentsWithDetails(
          numericLeadId,
          currentUser
        );
        for (const a of assignments) {
          const stage = await getPipelineStageByName(
            a.pipelineId,
            lead.estadoLead ?? ""
          );
          if (stage) {
            await setLeadStageInPipeline(
              numericLeadId,
              a.pipelineId,
              stage.id,
              ctx.user.id
            );
          }
        }
      }

      const automation = await runLeadAutomation(
        lead,
        ctx.user.id,
        ctx.activeOrganizationId,
        "status_changed"
      );
      const refreshedLead = await loadLeadOrThrow(lead.publicId, currentUser);

      return {
        lead: refreshedLead,
        automation,
      };
    }),

  /**
   * Mueve un lead a una fase dentro de un pipeline específico.
   * Si el pipeline es el "Principal" (por defecto), también actualiza
   * el `estadoLead` denormalizado del lead.
   */
  moveStageInPipeline: protectedProcedure
    .input(
      z.object({
        publicId: z.string(),
        pipelineId: z.number(),
        stageId: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const currentUser = toCurrentUser(ctx.user, ctx);
      const lead = await loadLeadOrThrow(input.publicId, currentUser);

      const stage = await getPipelineStage(input.stageId);
      if (!stage || stage.pipelineId !== input.pipelineId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "La fase no pertenece al pipeline indicado.",
        });
      }

      const numericLeadId =
        typeof lead.id === "string" ? parseInt(lead.id, 10) : lead.id;
      if (!Number.isFinite(numericLeadId)) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "ID de lead inválido.",
        });
      }

      await setLeadStageInPipeline(
        numericLeadId,
        input.pipelineId,
        input.stageId,
        ctx.user.id
      );

      // Actualizar estadoLead denormalizado para que las automatizaciones
      // (status_changed) funcionen en cualquier pipeline, no solo el Principal.
      await updateLeadStatusField(numericLeadId, stage.name, ctx.user.id);
      lead.estadoLead = stage.name as any;

      const automation = await runLeadAutomation(
        lead,
        ctx.user.id,
        ctx.activeOrganizationId,
        "status_changed"
      );
      const refreshedLead = await loadLeadOrThrow(input.publicId, currentUser);
      return { lead: refreshedLead, automation };
    }),

  /**
   * Lista las asignaciones del lead a pipelines con detalles (nombre de
   * pipeline y stage) para mostrar en el panel de la página del lead.
   */
  leadPipelineAssignments: protectedProcedure
    .input(z.object({ publicId: z.string() }))
    .query(async ({ ctx, input }) => {
      const currentUser = toCurrentUser(ctx.user, ctx);
      const lead = await loadLeadOrThrow(input.publicId, currentUser);
      const numericLeadId =
        typeof lead.id === "string" ? parseInt(lead.id, 10) : lead.id;
      if (!Number.isFinite(numericLeadId)) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "ID de lead inválido.",
        });
      }
      return listLeadPipelineAssignmentsWithDetails(numericLeadId);
    }),

  /**
   * Añade al lead a un pipeline nuevo (o cambia su fase dentro de uno existente).
   */
  addToPipeline: protectedProcedure
    .input(
      z.object({
        publicId: z.string(),
        pipelineId: z.number(),
        stageId: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const currentUser = toCurrentUser(ctx.user, ctx);
      const lead = await loadLeadOrThrow(input.publicId, currentUser);

      const stage = await getPipelineStage(input.stageId);
      if (!stage || stage.pipelineId !== input.pipelineId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "La fase no pertenece al pipeline indicado.",
        });
      }

      const numericLeadId =
        typeof lead.id === "string" ? parseInt(lead.id, 10) : lead.id;
      if (!Number.isFinite(numericLeadId)) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "ID de lead inválido.",
        });
      }

      await setLeadStageInPipeline(
        numericLeadId,
        input.pipelineId,
        input.stageId,
        ctx.user.id
      );

      // Actualizar estadoLead para que las automatizaciones funcionen en cualquier pipeline.
      await updateLeadStatusField(numericLeadId, stage.name, ctx.user.id);
      lead.estadoLead = stage.name as any;

      const automation = await runLeadAutomation(
        lead,
        ctx.user.id,
        ctx.activeOrganizationId,
        "status_changed"
      );
      return { success: true, automation };
    }),

  /**
   * Quita al lead de un pipeline. Se puede quitar de cualquier pipeline,
   * incluido el Principal. El `leads.estadoLead` se mantiene con su valor actual.
   */
  removeFromPipeline: protectedProcedure
    .input(
      z.object({
        publicId: z.string(),
        pipelineId: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const currentUser = toCurrentUser(ctx.user, ctx);
      const lead = await loadLeadOrThrow(input.publicId, currentUser);
      const numericLeadId =
        typeof lead.id === "string" ? parseInt(lead.id, 10) : lead.id;
      if (!Number.isFinite(numericLeadId)) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "ID de lead inválido.",
        });
      }
      await removeLeadFromPipeline(numericLeadId, input.pipelineId);
      return { success: true };
    }),

  /**
   * Elimina un lead (y todas sus filas asociadas) por su publicId.
   * Devuelve 404 si el lead no existe o el usuario no tiene visibilidad.
   */
  delete: protectedProcedure
    .input(z.object({ publicId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const currentUser = toCurrentUser(ctx.user, ctx);
      const lead = await loadLeadOrThrow(input.publicId, currentUser);
      const numericLeadId =
        typeof lead.id === "string" ? parseInt(lead.id, 10) : lead.id;
      if (!Number.isFinite(numericLeadId)) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "ID de lead inválido.",
        });
      }
      const ok = await db.deleteLeadById(numericLeadId, currentUser);
      if (!ok) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Lead no encontrado o sin permisos para eliminarlo.",
        });
      }
      return { success: true, publicId: input.publicId };
    }),

  addActivity: protectedProcedure
    .input(leadActivityCreateSchema)
    .mutation(async ({ ctx, input }) => {
      const currentUser = toCurrentUser(ctx.user, ctx);
      const lead = await addLeadActivity(input, currentUser);

      if (!lead) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message:
            "Lead no encontrado o sin permisos para registrar actividad.",
        });
      }

      return lead;
    }),

  runAutomation: protectedProcedure
    .input(leadIdSchema)
    .mutation(async ({ ctx, input }) => {
      const currentUser = toCurrentUser(ctx.user, ctx);
      const lead = await loadLeadOrThrow(input.publicId, currentUser);
      const automation = await runLeadAutomation(
        lead,
        ctx.user.id,
        ctx.activeOrganizationId,
        "manual_run"
      );
      const refreshedLead = await loadLeadOrThrow(input.publicId, currentUser);

      return {
        lead: refreshedLead,
        automation,
      };
    }),

  downloadTemplate: protectedProcedure.mutation(async ({ ctx }) => {
    const orgId = ctx.activeOrganizationId ?? 1;
    const customFields = await getLeadFieldDefs(orgId);
    const pricingConfig = await getPricingFieldsConfig(orgId);
    const pricingLines = getPricingLines(pricingConfig);
    const customPricingLines = pricingLines.filter(l => !l.isStandard && l.visible);
    const pricingFieldDefs: FieldColumn[] = customPricingLines.flatMap(l => [
      { key: l.cantidadKey, label: `${l.label} (cantidad)`, type: "number", isPricing: true },
      { key: l.precioKey, label: `${l.label} (precio)`, type: "number", isPricing: true },
    ]);
    const columns = buildTemplateFieldOrder(customFields, pricingFieldDefs);
    const headers = columns.map(c => c.label);
    const exampleRow = columns.map(c => {
      const examples: Record<string, string> = {
        nombreCliente: "Juan Pérez",
        telefono: "3001234567",
        correo: "juan.perez@ejemplo.com",
        nombreEmpresa: "Empresa XYZ",
        ciudad: "Bogotá",
        fechaVisita: "2025-03-15",
        motivoVisita: "Reunión de planificación y almuerzo ejecutivo",
        tipoEvento: "corporativo",
        objecionPrincipal: "Ninguna",
        cantidadMultiple: "10",
        cantidadJunior: "5",
        cantidadSenior: "2",
        cantidadParqueadero: "0",
        precioMultiple: "99000",
        precioJunior: "69000",
        precioSenior: "69000",
        precioParqueadero: "8000",
        estadoLead: "nuevo",
        canalOrigen: "whatsapp",
        agenteResponsable: "Equipo comercial",
        fechaIngresoLead: "2025-03-15",
        fechaLimiteGestion: "2025-03-22",
        motivoPerdido: "",
        motivoPausa: "",
        notasInternas:
          "Cliente interesado en el plan corporativo con parqueadero incluido.",
      };
      if (c.key in examples) return examples[c.key];
      if (c.isPricing) return c.key.endsWith("_qty") || c.key.endsWith("_price") && !c.key.includes("cantidad") ? String(
        customPricingLines.find(l => l.precioKey === c.key)?.precioDefault ?? 0
      ) : "0";
      if (c.isCustom) {
        const def = customFields.find(f => f.key === c.key);
        if (!def) return "";
        switch (def.type) {
          case "date": return "2025-01-01";
          case "number": return "0";
          default: return def.options?.[0] ?? "Ejemplo";
        }
      }
      return "0";
    });

    const sheetRows = [headers, exampleRow];
    const worksheet = XLSX.utils.aoa_to_sheet(sheetRows);
    worksheet["!cols"] = headers.map(() => ({ wch: 22 }));

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Plantilla Importación");

    const buffer = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "buffer",
      compression: true,
    });

    return {
      fileName: `plantilla-importacion-leads.xlsx`,
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      base64: buffer.toString("base64"),
    };
  }),

  getLeadFieldDefs: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.activeOrganizationId ?? 1;
    return getLeadFieldDefs(orgId);
  }),

  saveLeadFieldDefs: protectedProcedure
    .input(
      z.object({
        fields: z.array(
          z.object({
            key: z.string().min(1),
            label: z.string().min(1),
            type: z.enum(["text", "number", "select", "date"]),
            options: z.array(z.string()).optional(),
            required: z.boolean().optional(),
            order: z.number(),
            block: z.string().optional(),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.activeOrganizationId ?? 1;
      await setLeadFieldDefs(orgId, input.fields);
      return { success: true };
    }),

  getFormLayout: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.activeOrganizationId ?? 1;
    return getFormLayout(orgId);
  }),

  saveFormLayout: protectedProcedure
    .input(
      z.object({
        overrides: z.object({
          hiddenFields: z.array(z.string()).optional(),
          fieldLabels: z.record(z.string(), z.string()).optional(),
          fieldRequired: z.record(z.string(), z.boolean()).optional(),
          blockAssignments: z
            .record(
              z.string(),
              z.object({ block: z.string(), order: z.number() })
            )
            .optional(),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.activeOrganizationId ?? 1;
      await setFormLayout(orgId, input.overrides);
      return { success: true };
    }),

  getPricingFields: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.activeOrganizationId ?? 1;
    const config = await getPricingFieldsConfig(orgId);
    return { lines: getPricingLines(config) };
  }),

  savePricingFields: protectedProcedure
    .input(
      z.object({
        hiddenLines: z.array(z.string()).optional(),
        customLines: z
          .array(
            z.object({
              key: z.string().min(1),
              label: z.string().min(1),
              precioDefault: z.number().min(0),
              order: z.number(),
            })
          )
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.activeOrganizationId ?? 1;
      await setPricingFieldsConfig(orgId, {
        hiddenLines: input.hiddenLines,
        customLines: input.customLines,
      });
      return { success: true };
    }),

  detectDuplicates: protectedProcedure
    .input(
      z.object({
        rows: z.array(
          z.object({
            rowIndex: z.number(),
            telefono: z.string().nullable(),
            correo: z.string().nullable(),
          })
        ),
      })
    )
    .query(async ({ ctx, input }) => {
      const orgId = ctx.activeOrganizationId ?? 1;
      const duplicates: Array<{
        rowIndex: number;
        publicId: string;
        nombreCliente: string;
        telefono: string;
        correo: string;
        estadoLead: string;
      }> = [];

      const seenTelefonos = new Set<string>();
      const seenCorreos = new Set<string>();

      for (const row of input.rows) {
        const tel = row.telefono?.trim() || null;
        const email = row.correo?.trim().toLowerCase() || null;

        // Skip if no searchable fields or already processed same value
        const telKey = tel ?? "";
        const emailKey = email ?? "";
        if (!tel && !email) continue;
        if (tel && seenTelefonos.has(telKey)) {
          // Already found duplicates for this phone - mark same rowIndex
          for (const d of duplicates) {
            if (d.telefono === tel) {
              duplicates.push({ ...d, rowIndex: row.rowIndex });
              break;
            }
          }
          continue;
        }
        if (email && seenCorreos.has(emailKey)) {
          for (const d of duplicates) {
            if (d.correo === email) {
              duplicates.push({ ...d, rowIndex: row.rowIndex });
              break;
            }
          }
          continue;
        }

        const matches = await findDuplicateLeads(tel, email, orgId);
        for (const match of matches) {
          duplicates.push({ rowIndex: row.rowIndex, ...match });
          if (match.telefono) seenTelefonos.add(match.telefono);
          if (match.correo) seenCorreos.add(match.correo);
        }
      }

      return { duplicates };
    }),

  importSpreadsheet: protectedProcedure
    .input(z.object({ base64: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const buffer = Buffer.from(input.base64, "base64");
      const workbook = XLSX.read(buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

      let importedCount = 0;
      const currentUser = toCurrentUser(ctx.user, ctx);

      const parseExcelDate = (value: any): number => {
        if (!value) return Date.now() + 7 * 24 * 60 * 60 * 1000;
        if (typeof value === "number") {
          if (value > 100000) return value;
          const date = new Date((value - 25569) * 86400 * 1000);
          return date.getTime();
        }
        const str = String(value).trim();
        const parsed = Date.parse(str);
        if (!isNaN(parsed)) return parsed;

        const parts = str.split(/[-\/]/);
        if (parts.length === 3) {
          if (parts[2].length === 4) {
            const day = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1;
            const year = parseInt(parts[2], 10);
            const date = new Date(year, month, day);
            if (!isNaN(date.getTime())) return date.getTime();
          }
          if (parts[0].length === 4) {
            const year = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1;
            const day = parseInt(parts[2], 10);
            const date = new Date(year, month, day);
            if (!isNaN(date.getTime())) return date.getTime();
          }
        }
        return Date.now() + 7 * 24 * 60 * 60 * 1000;
      };

      for (const row of jsonData) {
        const findVal = (keys: string[]) => {
          for (const key of Object.keys(row)) {
            const normalizedKey = key
              .toLowerCase()
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "");
            if (keys.includes(normalizedKey)) return row[key];
          }
          return undefined;
        };

        const nombreCliente =
          findVal(["cliente", "nombre", "nombre cliente", "contacto"]) || "";
        const telefono =
          findVal(["telefono", "celular", "contacto telefono"]) || "";
        const correo =
          findVal(["correo", "email", "mail", "contacto correo"]) || "";

        // Saltar si faltan los campos requeridos mínimos
        if (
          !String(nombreCliente).trim() ||
          !String(telefono).trim() ||
          !String(correo).trim()
        ) {
          continue;
        }

        const ciudad = findVal(["ciudad", "empresa ciudad"]) || "";
        const nombreEmpresa = findVal(["empresa", "nombre empresa"]) || "";
        const motivoVisita =
          findVal(["motivo de visita", "motivo visita", "motivo"]) ||
          "Importado desde Excel";
        const objecionPrincipal =
          findVal(["objecion principal", "objecion"]) || "Ninguna";
        const tipoEventoRaw =
          findVal(["motivo de viaje", "tipo evento", "evento"]) || "otro";
        const fechaVisitaRaw = findVal(["fecha visita", "fecha"]);

        const cantidadMultiple = Number(
          findVal(["cantidad multiple", "multiple"]) || 0
        );
        const cantidadJunior = Number(
          findVal(["cantidad junior", "junior"]) || 0
        );
        const cantidadSenior = Number(
          findVal(["cantidad senior", "senior"]) || 0
        );
        const cantidadParqueadero = Number(
          findVal(["cantidad parqueadero", "parqueadero"]) || 0
        );

        const canalOrigen =
          findVal(["canal de origen", "canal", "canal origen"]) || "otro";
        const agenteResponsable =
          findVal(["agente responsable", "agente", "responsable"]) || "";
        const notasInternas = findVal(["notas internas", "notas"]) || "";

        const normalizeLeadSource = (
          value: string
        ):
          | "whatsapp"
          | "instagram"
          | "facebook"
          | "web"
          | "llamada"
          | "referido"
          | "otro" => {
          const v = value.toLowerCase().trim();
          const valid = [
            "whatsapp",
            "instagram",
            "facebook",
            "web",
            "llamada",
            "referido",
            "otro",
          ];
          return valid.includes(v) ? (v as any) : "otro";
        };

        const leadInput = {
          nombreCliente: String(nombreCliente).trim(),
          telefono: String(telefono).trim(),
          correo: String(correo).trim(),
          ciudad: String(ciudad).trim(),
          nombreEmpresa: String(nombreEmpresa).trim(),
          motivoVisita: String(motivoVisita).trim(),
          objecionPrincipal: String(objecionPrincipal).trim(),
          tipoEvento: normalizeLeadTravelReason(String(tipoEventoRaw).trim()),
          fechaVisita: parseExcelDate(fechaVisitaRaw),

          cantidadMultiple,
          cantidadJunior,
          cantidadSenior,
          cantidadParqueadero,

          precioMultiple: Number(
            findVal(["precio multiple", "precio unidad multiple"]) || 99000
          ),
          precioJunior: Number(
            findVal(["precio junior", "precio unidad junior"]) || 69000
          ),
          precioSenior: Number(
            findVal(["precio senior", "precio unidad senior"]) || 69000
          ),
          precioParqueadero: Number(
            findVal(["precio parqueadero", "precio unidad parqueadero"]) || 8000
          ),

          canalOrigen: normalizeLeadSource(String(canalOrigen)),
          agenteUserId: null,
          agenteResponsable: String(agenteResponsable).trim(),
          fechaLimiteGestion: null,
          proximaAccion: "",
          notasInternas: String(notasInternas).trim(),
          motivoPerdido: "",
          motivoPausa: "",
          leadPartyKind: String(nombreEmpresa).trim()
            ? ("empresa" as const)
            : ("persona" as const),
        };

        const lead = await createLead(leadInput, currentUser);
        if (lead) {
          await runLeadAutomation(
            lead,
            ctx.user.id,
            ctx.activeOrganizationId,
            "import"
          );
          importedCount++;
        }
      }

      return {
        success: true,
        importedCount,
      };
    }),
});
