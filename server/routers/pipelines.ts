import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";

const orgIdOrFail = (ctx: any): number => {
  if (!ctx.activeOrganizationId) throw new TRPCError({ code: "FORBIDDEN", message: "No hay organización activa." });
  return ctx.activeOrganizationId;
};

/**
 * Router de gestión de embudos (pipelines).
 * Los listados y operaciones ahora están scopados por
 * `ctx.activeOrganizationId` para no mezclar datos entre orgs.
 */
export const pipelinesRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const orgId = orgIdOrFail(ctx);
    return db.listPipelines(orgId);
  }),

  listActive: protectedProcedure.query(async ({ ctx }) => {
    const orgId = orgIdOrFail(ctx);
    return db.listActivePipelines(orgId);
  }),

  /**
   * Lista de embudos con estadísticas: cantidad de fases activas
   * y cantidad de leads asignados.
   */
  listWithStats: protectedProcedure.query(async ({ ctx }) => {
    const orgId = orgIdOrFail(ctx);
    const all = await db.listPipelines(orgId);
    const result: Array<{
      id: number;
      name: string;
      description: string | null;
      color: string | null;
      order: number | null;
      isActive: boolean | null;
      createdAt: Date;
      updatedAt: Date;
      activeStageCount: number;
      totalStageCount: number;
      leadCount: number;
    }> = [];

    for (const p of all) {
      const stages = await db.listPipelineStages(orgId, p.id);
      const activeStages = stages.filter(s => s.isActive);
      const leadCount = await db.countLeadsInPipeline(p.id, orgId);
      result.push({
        id: p.id,
        name: p.name,
        description: p.description,
        color: p.color,
        order: p.order,
        isActive: p.isActive,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        activeStageCount: activeStages.length,
        totalStageCount: stages.length,
        leadCount,
      });
    }
    return result;
  }),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const pipeline = await db.getPipeline(input.id);
      if (!pipeline || pipeline.organizationId !== (ctx.activeOrganizationId ?? 1)) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Embudo no encontrado." });
      }
      return pipeline;
    }),

  getDefault: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.activeOrganizationId;
    if (!orgId) return null;
    return db.getDefaultPipeline(orgId);
  }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        description: z.string().max(500).optional().nullable(),
        color: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/)
          .default("#3b82f6"),
        copyFromPipelineId: z.number().optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = orgIdOrFail(ctx);
      // Unicidad del nombre solo dentro de la org activa (no global)
      const existing = await db.listPipelines(orgId);
      if (existing.some(p => p.name === input.name)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Ya existe un embudo con ese nombre en tu organización.",
        });
      }
      const order = existing.length + 1;
      const pipeline = await db.createPipeline({
        name: input.name,
        description: input.description ?? null,
        color: input.color,
        order,
        isActive: true,
        organizationId: orgId,
      });

      if (input.copyFromPipelineId) {
        // Validar que el pipeline fuente es de la misma org
        const source = await db.getPipeline(input.copyFromPipelineId);
        if (!source || source.organizationId !== orgId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "El embudo fuente no pertenece a tu organización.",
          });
        }
        const sourceStages = await db.listPipelineStages(
          orgId,
          input.copyFromPipelineId
        );
        for (let i = 0; i < sourceStages.length; i++) {
          const s = sourceStages[i];
          await db.createPipelineStage({
            pipelineId: pipeline.id,
            name: s.name,
            displayName: s.displayName,
            color: s.color ?? "#3b82f6",
            order: s.order ?? i + 1,
            isActive: true,
            kind: "open",
            organizationId: orgId,
          });
        }
      }

      return pipeline;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1).max(100).optional(),
        description: z.string().max(500).optional().nullable(),
        color: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/)
          .optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const current = await db.getPipeline(id);
      if (!current) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Embudo no encontrado.",
        });
      }
      // Validacion cross-tenant: el pipeline debe ser de la org activa
      const orgId = orgIdOrFail(ctx);
      if (current.organizationId !== orgId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "El embudo no pertenece a tu organización.",
        });
      }
      // Unicidad del nombre dentro de la org (si se esta renombrando)
      if (data.name && data.name !== current.name) {
        const all = await db.listPipelines(orgId);
        if (all.some(p => p.id !== id && p.name === data.name)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Ya existe un embudo con ese nombre en tu organización.",
          });
        }
      }
      // No permitir desactivar si tiene leads
      if (data.isActive === false) {
        const leadCount = await db.countLeadsInPipeline(id, orgId);
        if (leadCount > 0) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: `El embudo "${current.name}" tiene ${leadCount} lead(s). Muévelos o elimínalos antes de desactivarlo.`,
          });
        }
      }
      return db.updatePipeline(id, data);
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const pipeline = await db.getPipeline(input.id);
      if (!pipeline) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Embudo no encontrado.",
        });
      }
      // Validacion cross-tenant
      const orgId = orgIdOrFail(ctx);
      if (pipeline.organizationId !== orgId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "El embudo no pertenece a tu organización.",
        });
      }
      const leadCount = await db.countLeadsInPipeline(input.id, ctx.activeOrganizationId ?? 1);
      if (leadCount > 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `El embudo "${pipeline.name}" tiene ${leadCount} lead(s). Elimínalos o reasígnalos antes.`,
        });
      }
      await db.deletePipeline(input.id);
      return { success: true };
    }),

  reorder: protectedProcedure
    .input(z.object({ orderedIds: z.array(z.number()) }))
    .mutation(async ({ ctx, input }) => {
      const orgId = orgIdOrFail(ctx);
      // Validar que todos los ids pertenecen a la org activa
      const all = await db.listPipelines(orgId);
      const ownIds = new Set(all.map(p => p.id));
      for (const id of input.orderedIds) {
        if (!ownIds.has(id)) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Uno o más embudos no pertenecen a tu organización.",
          });
        }
      }
      await db.reorderPipelines(input.orderedIds);
      return { success: true };
    }),

  /**
   * PROCEDURE GENÉRICO DE MÉTRICAS.
   * Recibe un tipo de métrica y parámetros dinámicos, ejecuta el helper
   * correspondiente y devuelve el resultado.
   */
  metric: protectedProcedure
    .input(
      z.object({
        pipelineId: z.number(),
        metricType: z.enum([
          "funnel",
          "stage_transition",
          "by_segment",
          "avg_time",
          "velocity",
          "dropoff",
        ]),
        params: z
          .object({
            fromStageId: z.number().optional(),
            toStageId: z.number().optional(),
            segmentField: z.string().optional(),
          })
          .optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      const { pipelineId, metricType, params, startDate, endDate } = input;
      switch (metricType) {
        case "funnel":
          return db.getPipelineFunnel(pipelineId, startDate, endDate);
        case "stage_transition":
          if (!params?.fromStageId || !params?.toStageId) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message:
                "Se requieren fromStageId y toStageId para esta métrica.",
            });
          }
          return db.getStageTransition(
            pipelineId,
            params.fromStageId,
            params.toStageId,
            startDate,
            endDate
          );
        case "by_segment":
          return db.getConversionBySegment(
            pipelineId,
            params?.segmentField ?? "canalOrigen",
            startDate,
            endDate
          );
        case "avg_time":
          return db.getAverageTimeInStage(pipelineId, startDate, endDate);
        case "velocity":
          return db.getPipelineVelocity(pipelineId, startDate, endDate);
        case "dropoff":
          return db.getDropOff(pipelineId, startDate, endDate);
        default:
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Métrica no soportada.",
          });
      }
    }),

  /**
   * CRUD de vistas guardadas de métricas.
   */
  savedViews: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const orgId = ctx.activeOrganizationId;
      if (!orgId) return [];
      return db.listMetricViewsForUser(ctx.user.id, orgId);
    }),

    create: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1).max(100),
          config: z.any(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const orgId = ctx.activeOrganizationId;
        const saved = await db.createMetricView({
          userId: ctx.user.id,
          name: input.name,
          config: JSON.stringify(input.config),
          organizationId: orgId ?? 1,
        });
        return { ...saved, config: JSON.parse(saved.config as string) };
      }),

    delete: protectedProcedure.input(z.number()).mutation(async ({ input }) => {
      await db.deleteMetricView(input);
      return { success: true };
    }),
  }),
});
