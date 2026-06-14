import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";

/**
 * Router de gestión de embudos (pipelines).
 * Todos los procedimientos usan `protectedProcedure` (cualquier usuario
 * autenticado puede crear/editar/eliminar). No hay gating por rol.
 */
export const pipelinesRouter = router({
  list: protectedProcedure.query(async () => {
    return db.listPipelines();
  }),

  listActive: protectedProcedure.query(async () => {
    return db.listActivePipelines();
  }),

  /**
   * Lista de embudos con estadísticas: cantidad de fases activas
   * y cantidad de leads asignados.
   */
  listWithStats: protectedProcedure.query(async () => {
    const all = await db.listPipelines();
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
      const stages = await db.listPipelineStages(p.id);
      const activeStages = stages.filter(s => s.isActive);
      const leadCount = await db.countLeadsInPipeline(p.id);
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
    .query(async ({ input }) => {
      return db.getPipeline(input.id);
    }),

  getDefault: protectedProcedure.query(async () => {
    return db.getDefaultPipeline();
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
    .mutation(async ({ input }) => {
      const existing = await db.listPipelines();
      if (existing.some(p => p.name === input.name)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Ya existe un embudo con ese nombre.",
        });
      }
      const order = existing.length + 1;
      const pipeline = await db.createPipeline({
        name: input.name,
        description: input.description ?? null,
        color: input.color,
        order,
        isActive: true,
      });

      // Si se solicita copiar fases de otro pipeline, copiarlas como "open".
      if (input.copyFromPipelineId) {
        const sourceStages = await db.listPipelineStages(
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
            kind: "open", // al copiar, todas inician como "open"; el usuario las cambia
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
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      const current = await db.getPipeline(id);
      if (!current) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Embudo no encontrado.",
        });
      }
      // No permitir desactivar si tiene leads
      if (data.isActive === false) {
        const leadCount = await db.countLeadsInPipeline(id);
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
    .mutation(async ({ input }) => {
      const pipeline = await db.getPipeline(input.id);
      if (!pipeline) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Embudo no encontrado.",
        });
      }
      const leadCount = await db.countLeadsInPipeline(input.id);
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
    .mutation(async ({ input }) => {
      await db.reorderPipelines(input.orderedIds);
      return { success: true };
    }),
});
