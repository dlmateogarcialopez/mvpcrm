import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as XLSX from "xlsx";
import * as db from "../db";
import {
  addLeadActivity,
  createLead,
  getDashboardSnapshot,
  getDefaultPipeline,
  getLeadByPublicId,
  getPipelineStage,
  getPipelineStageByName,
  listLeadPipelineAssignmentsWithDetails,
  listLeads,
  listLeadsByPipeline,
  listLeadsForExport,
  listPipelineStages,
  removeLeadFromPipeline,
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
    const rows = await listLeadsForExport(toCurrentUser(ctx.user, ctx));
    const workbook = buildLeadWorkbookBuffer(rows);
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
    .mutation(async ({ input }) => {
      const buffer = Buffer.from(input.base64, "base64");
      const result: ValidationResult = validateLeadImport(
        buffer,
        input.manualMapping
      );
      return {
        ...result,
        availableFields: Object.entries(LEAD_IMPORT_FIELDS).map(
          ([key, def]) => ({
            key,
            label: def.label,
            type: def.type,
          })
        ),
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
      })
    )
    .mutation(async ({ ctx, input }) => {
      const buffer = Buffer.from(input.base64, "base64");
      const validation = validateLeadImport(buffer, input.manualMapping);

      const currentUser = toCurrentUser(ctx.user, ctx);
      const numericUserId =
        typeof ctx.user.id === "string"
          ? parseInt(ctx.user.id, 10)
          : ctx.user.id;

      let created = 0;
      let updated = 0;
      let skipped = 0;
      const errors: Array<{ rowIndex: number; reason: string }> = [];

      for (const row of validation.rows) {
        if (row.status === "error") {
          skipped++;
          continue;
        }

        // Convertir ParsedCell a objeto plano
        const leadData: Record<string, any> = {};
        for (const [field, cell] of Object.entries(row.data)) {
          leadData[field] = cell.raw;
        }

        // Verificar duplicado por teléfono o correo
        const existingLead = await db.findLeadByPhoneOrEmail(
          leadData.telefono ? String(leadData.telefono) : null,
          leadData.correo ? String(leadData.correo) : null
        );

        if (existingLead) {
          if (input.duplicateAction === "skip") {
            skipped++;
            continue;
          }
          if (input.duplicateAction === "update") {
            try {
              await db.updateLead(
                {
                  publicId: existingLead.publicId,
                  ...leadData,
                } as any,
                currentUser
              );
              updated++;
            } catch (e: any) {
              errors.push({ rowIndex: row.index, reason: e.message });
            }
            continue;
          }
        }

        try {
          await createLead(leadData as any, currentUser);
          created++;
        } catch (e: any) {
          errors.push({ rowIndex: row.index, reason: e.message });
        }
      }

      return {
        created,
        updated,
        skipped,
        errors,
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

      // Si el pipeline es el principal, actualizar estadoLead denormalizado.
      const defaultPipeline = await getDefaultPipeline(
        ctx.activeOrganizationId ?? 1
      );
      if (defaultPipeline && defaultPipeline.id === input.pipelineId) {
        // Llamamos a updateLeadStatus con el estadoLead del stage
        // (asumiendo que lead.estadoLead coincide con el name del stage).
        await updateLeadStatusField(numericLeadId, stage.name, ctx.user.id);
      }

      const refreshedLead = await loadLeadOrThrow(input.publicId, currentUser);
      return { lead: refreshedLead };
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

      // Si el pipeline es el principal, actualizar el estadoLead denormalizado.
      const defaultPipeline = await getDefaultPipeline(
        ctx.activeOrganizationId ?? 1
      );
      if (defaultPipeline && defaultPipeline.id === input.pipelineId) {
        await updateLeadStatusField(numericLeadId, stage.name, ctx.user.id);
      }

      return { success: true };
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

  downloadTemplate: protectedProcedure.query(async () => {
    const headers = [
      "Cliente",
      "Teléfono",
      "Correo",
      "Ciudad",
      "Empresa",
      "Motivo de viaje",
      "Motivo de visita",
      "Objeción principal",
      "Cantidad múltiple",
      "Cantidad junior",
      "Cantidad senior",
      "Cantidad parqueadero",
      "Canal de origen",
      "Agente responsable",
      "Notas internas",
    ];

    const exampleRow = [
      "Juan Pérez",
      "3001234567",
      "juan.perez@ejemplo.com",
      "Bogotá",
      "Empresa XYZ",
      "corporativo",
      "Reunión de planificación y almuerzo ejecutivo.",
      "Ninguna",
      "10",
      "5",
      "2",
      "0",
      "whatsapp",
      "Equipo comercial",
      "Cliente sumamente interesado en el plan corporativo con parqueadero incluido.",
    ];

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
