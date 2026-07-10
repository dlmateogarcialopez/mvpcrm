import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { logAudit } from "../db";
import { renameInAutomationRules } from "../services/automationTriggers";

/**
 * Router de gestión de FASES dentro de un embudo (pipeline).
 * Las fases se crean/editan dentro de un `pipelineId` específico.
 * No hay gating por rol: todos los usuarios autenticados pueden gestionar.
 */
export const pipelineRouter = router({
  list: protectedProcedure
    .input(z.object({ pipelineId: z.number().optional() }).optional())
    .query(async ({ ctx, input }) => {
      // Sin pipelineId: devolver todos los pipelines de la org
      // Con pipelineId: devolver las fases de ese pipeline (compatible hacia atrás)
      if (!input?.pipelineId) {
        return db.listPipelines(ctx.activeOrganizationId ?? 1);
      }
      return db.listPipelineStages(
        ctx.activeOrganizationId ?? 1,
        input.pipelineId
      );
    }),

  /**
   * Devuelve todas las fases activas de TODOS los pipelines de la org.
   * Usado por el formulario de creación de leads para el selector de pipeline+fase.
   */
  listAllStages: protectedProcedure.query(async ({ ctx }) => {
    return db.listPipelineStages(ctx.activeOrganizationId ?? 1);
  }),

  listActive: protectedProcedure
    .input(z.object({ pipelineId: z.number().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const pipelineId = input?.pipelineId;
      if (!pipelineId) {
        return db.listActivePipelineStages(ctx.activeOrganizationId ?? 1);
      }
      return db.listActivePipelineStages(
        ctx.activeOrganizationId ?? 1,
        pipelineId
      );
    }),

  /**
   * Conteo de leads por stageId. Para bloqueo de borrado.
   */
  leadCounts: protectedProcedure
    .input(z.object({ pipelineId: z.number().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const stages = await db.listPipelineStages(
        ctx.activeOrganizationId ?? 1,
        input?.pipelineId
      );
      const counts: Record<number, number> = {};
      for (const s of stages) {
        counts[s.id] = await db.countLeadsByStageId(
          s.id,
          ctx.activeOrganizationId ?? 1
        );
      }
      return counts;
    }),

  create: protectedProcedure
    .input(
      z.object({
        pipelineId: z.number(),
        name: z.string().min(1).max(100),
        displayName: z.string().min(1).max(100),
        color: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/)
          .default("#3b82f6"),
        kind: z.enum(["open", "won", "lost", "paused"]).default("open"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const all = await db.listPipelineStages(
        ctx.activeOrganizationId ?? 1,
        input.pipelineId
      );
      const dup = all.find(
        s => s.name === input.name || s.displayName === input.displayName
      );
      if (dup) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Ya existe una fase con ese nombre interno o visible en este embudo.",
        });
      }
      const order = all.length + 1;
      const created = await db.createPipelineStage({
        pipelineId: input.pipelineId,
        name: input.name,
        displayName: input.displayName,
        color: input.color,
        order,
        isActive: true,
        kind: input.kind,
        organizationId: ctx.activeOrganizationId ?? 1,
      });

      const parentPipeline = await db.getPipeline(input.pipelineId);
      const pipelineName =
        parentPipeline?.name ?? "embudo #" + input.pipelineId;
      await logAudit({
        organizationId: ctx.activeOrganizationId ?? 1,
        actorUserId: ctx.user?.id ?? null,
        actorEmail: ctx.user?.email ?? null,
        actorName: ctx.user?.name ?? null,
        action: "create",
        entityType: "pipeline_stage",
        entityId: String(created.id),
        entityName: input.displayName,
        summary:
          'Creó la fase "' +
          input.displayName +
          '" en el embudo "' +
          pipelineName +
          '"',
        details: {
          pipelineId: input.pipelineId,
          name: input.name,
          displayName: input.displayName,
          kind: input.kind,
          color: input.color,
        },
      });

      return created;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1).max(100).optional(),
        displayName: z.string().min(1).max(100).optional(),
        color: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/)
          .optional(),
        isActive: z.boolean().optional(),
        kind: z.enum(["open", "won", "lost", "paused"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const current = await db.getPipelineStage(id);
      if (!current) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Fase no encontrada.",
        });
      }

      const orgId = ctx.activeOrganizationId ?? 1;

      // Validar unicidad dentro del mismo pipeline
      if (data.name && data.name !== current.name) {
        const all = await db.listPipelineStages(orgId, current.pipelineId);
        if (all.some(s => s.id !== id && s.name === data.name)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Ya existe otra fase con ese nombre interno en este embudo.",
          });
        }
      }
      if (data.displayName && data.displayName !== current.displayName) {
        const all = await db.listPipelineStages(orgId, current.pipelineId);
        if (all.some(s => s.id !== id && s.displayName === data.displayName)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Ya existe otra fase con ese nombre visible en este embudo.",
          });
        }
      }

      const updated = await db.updatePipelineStage(id, data);
      if (!updated) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "No fue posible actualizar la fase.",
        });
      }

      // Renombrado en cascada en reglas de automatización
      if (data.name && data.name !== current.name) {
        await renameInAutomationRules(
          current.name,
          data.name,
          current.organizationId
        );
      }
      if (data.displayName && data.displayName !== current.displayName) {
        await renameInAutomationRules(
          current.displayName,
          data.displayName,
          current.organizationId
        );
      }

      await logAudit({
        organizationId: ctx.activeOrganizationId ?? 1,
        actorUserId: ctx.user?.id ?? null,
        actorEmail: ctx.user?.email ?? null,
        actorName: ctx.user?.name ?? null,
        action: "update",
        entityType: "pipeline_stage",
        entityId: String(id),
        entityName: updated.displayName,
        summary: 'Actualizó la fase "' + updated.displayName + '"',
      });

      return updated;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const stage = await db.getPipelineStage(input.id);
      if (!stage) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Fase no encontrada.",
        });
      }
      const leadsCount = await db.countLeadsByStageId(
        input.id,
        ctx.activeOrganizationId ?? 1
      );
      if (leadsCount > 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `La fase "${stage.displayName}" tiene ${leadsCount} lead(s) asociado(s). Muévelos a otra fase antes de eliminarla.`,
        });
      }
      await db.deletePipelineStage(input.id);
      await logAudit({
        organizationId: ctx.activeOrganizationId ?? 1,
        actorUserId: ctx.user?.id ?? null,
        actorEmail: ctx.user?.email ?? null,
        actorName: ctx.user?.name ?? null,
        action: "delete",
        entityType: "pipeline_stage",
        entityId: String(input.id),
        entityName: stage.displayName,
        summary: 'Eliminó la fase "' + stage.displayName + '"',
      });
      return { success: true };
    }),

  reorder: protectedProcedure
    .input(z.object({ orderedIds: z.array(z.number()) }))
    .mutation(async ({ ctx, input }) => {
      if (input.orderedIds.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Debe enviar al menos un identificador.",
        });
      }
      await db.reorderPipelineStages(input.orderedIds);
      await logAudit({
        organizationId: ctx.activeOrganizationId ?? 1,
        actorUserId: ctx.user?.id ?? null,
        actorEmail: ctx.user?.email ?? null,
        actorName: ctx.user?.name ?? null,
        action: "update",
        entityType: "pipeline_stage",
        entityId: "0",
        entityName: "fases del pipeline",
        summary: "Reordenó las fases del pipeline",
        details: { count: input.orderedIds.length },
      });
      return { success: true };
    }),

  toggleActive: protectedProcedure
    .input(z.object({ id: z.number(), isActive: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const stage = await db.getPipelineStage(input.id);
      if (!stage) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Fase no encontrada.",
        });
      }
      if (input.isActive === false) {
        const leadsCount = await db.countLeadsByStageId(
          input.id,
          ctx.activeOrganizationId ?? 1
        );
        if (leadsCount > 0) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: `La fase "${stage.displayName}" tiene ${leadsCount} lead(s) asociado(s). Muévelos a otra fase antes de desactivarla.`,
          });
        }
      }
      const updated = await db.setPipelineStageActive(input.id, input.isActive);
      if (!updated) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "No fue posible actualizar la fase.",
        });
      }
      await logAudit({
        organizationId: ctx.activeOrganizationId ?? 1,
        actorUserId: ctx.user?.id ?? null,
        actorEmail: ctx.user?.email ?? null,
        actorName: ctx.user?.name ?? null,
        action: "update",
        entityType: "pipeline_stage",
        entityId: String(input.id),
        entityName: updated.displayName,
        summary:
          (input.isActive ? "Activó" : "Desactivó") +
          ' la fase "' +
          updated.displayName +
          '"',
      });
      return updated;
    }),
});
