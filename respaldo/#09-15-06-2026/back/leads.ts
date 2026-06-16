import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as XLSX from "xlsx";
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
  removeLeadFromPipeline,
  setLeadStageInPipeline,
  updateLead,
  updateLeadStatus,
  updateLeadStatusField,
  type CurrentUser,
} from "../db";
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

function toCurrentUser(user: RouterUser): CurrentUser {
  return {
    id: user.id,
    role: user.role,
    name: user.name,
    email: user.email,
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
    return getDashboardSnapshot(toCurrentUser(ctx.user));
  }),

  list: protectedProcedure
    .input(leadFiltersSchema)
    .query(async ({ ctx, input }) => {
      return listLeads(input, toCurrentUser(ctx.user));
    }),

  exportSpreadsheet: protectedProcedure.mutation(async ({ ctx }) => {
    const rows = await listLeadsForExport(toCurrentUser(ctx.user));
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

  byId: protectedProcedure.input(leadIdSchema).query(async ({ ctx, input }) => {
    return loadLeadOrThrow(input.publicId, toCurrentUser(ctx.user));
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
      const currentUser = toCurrentUser(ctx.user);
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
          await setLeadStageInPipeline(
            numericLeadId,
            assignment.pipelineId,
            assignment.stageId,
            ctx.user.id
          );
        }
      } else {
        // Si no seleccionó pipelines, asignar al Principal por defecto
        const defaultPipeline = await getDefaultPipeline();
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

      const automation = await runLeadAutomation(lead, ctx.user.id);
      const refreshedLead = await loadLeadOrThrow(lead.publicId, currentUser);

      return {
        lead: refreshedLead,
        automation,
      };
    }),

  /**
   * Lista los leads asignados a un pipeline específico, con su stageId
   * correspondiente para agrupación visual en el panel de embudo.
   */
  listByPipeline: protectedProcedure
    .input(z.object({ pipelineId: z.number() }))
    .query(async ({ ctx, input }) => {
      const currentUser = toCurrentUser(ctx.user);
      return listLeadsByPipeline(input.pipelineId, currentUser);
    }),

  update: protectedProcedure
    .input(leadUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      const currentUser = toCurrentUser(ctx.user);
      const lead = await updateLead(input, currentUser);

      if (!lead) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Lead no encontrado o sin permisos para editarlo.",
        });
      }

      const automation = await runLeadAutomation(lead, ctx.user.id);
      const refreshedLead = await loadLeadOrThrow(lead.publicId, currentUser);

      return {
        lead: refreshedLead,
        automation,
      };
    }),

  updateStatus: protectedProcedure
    .input(leadStatusUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      const currentUser = toCurrentUser(ctx.user);
      const lead = await updateLeadStatus(input, currentUser);

      if (!lead) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Lead no encontrado o sin permisos para actualizarlo.",
        });
      }

      // Mantener sincronizado el lead_pipeline_stages del pipeline por defecto.
      const defaultPipeline = await getDefaultPipeline();
      if (defaultPipeline) {
        const stage = await getPipelineStageByName(
          defaultPipeline.id,
          lead.estadoLead ?? ""
        );
        if (stage) {
          const numericLeadId =
            typeof lead.id === "string" ? parseInt(lead.id, 10) : lead.id;
          if (Number.isFinite(numericLeadId)) {
            await setLeadStageInPipeline(
              numericLeadId,
              defaultPipeline.id,
              stage.id,
              ctx.user.id
            );
          }
        }
      }

      const automation = await runLeadAutomation(lead, ctx.user.id);
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
      const currentUser = toCurrentUser(ctx.user);
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
      const defaultPipeline = await getDefaultPipeline();
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
      const currentUser = toCurrentUser(ctx.user);
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
      const currentUser = toCurrentUser(ctx.user);
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
      const defaultPipeline = await getDefaultPipeline();
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
      const currentUser = toCurrentUser(ctx.user);
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

  addActivity: protectedProcedure
    .input(leadActivityCreateSchema)
    .mutation(async ({ ctx, input }) => {
      const currentUser = toCurrentUser(ctx.user);
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
      const currentUser = toCurrentUser(ctx.user);
      const lead = await loadLeadOrThrow(input.publicId, currentUser);
      const automation = await runLeadAutomation(lead, ctx.user.id);
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
      const currentUser = toCurrentUser(ctx.user);

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
          await runLeadAutomation(lead, ctx.user.id);
          importedCount++;
        }
      }

      return {
        success: true,
        importedCount,
      };
    }),
});
