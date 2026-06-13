import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { renameInAutomationRules } from "../services/automationTriggers";

/**
 * Router de gestión del pipeline (fases personalizables del embudo).
 * Todas las acciones requieren autenticación. No hay restricción de rol
 * (todos los usuarios pueden gestionar el pipeline).
 */
export const pipelineRouter = router({
  list: protectedProcedure.query(async () => {
    return db.listPipelineStages();
  }),

  listActive: protectedProcedure.query(async () => {
    const existing = await db.listPipelineStages();
    if (existing.length === 0) {
      // Siembra inicial: crea las fases por defecto del sistema.
      await seedDefaultPipelineStages();
    }
    return db.listActivePipelineStages();
  }),

  /**
   * Devuelve el conteo de leads por nombre de fase.
   * Útil para mostrar en la UI "X leads en esta fase" y para bloquear borrados.
   */
  leadCounts: protectedProcedure.query(async () => {
    const stages = await db.listPipelineStages();
    const counts: Record<string, number> = {};
    for (const s of stages) {
      counts[s.name] = await db.countLeadsByStageName(s.name);
    }
    return counts;
  }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        displayName: z.string().min(1).max(100),
        color: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/)
          .default("#3b82f6"),
      })
    )
    .mutation(async ({ input }) => {
      const existing = await db.listPipelineStages();
      const dup = existing.find(
        s => s.name === input.name || s.displayName === input.displayName
      );
      if (dup) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Ya existe una fase con ese nombre interno o visible.",
        });
      }
      const order = existing.length + 1;
      return db.createPipelineStage({
        name: input.name,
        displayName: input.displayName,
        color: input.color,
        order,
        isActive: true,
      });
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
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      const current = await db.getPipelineStage(id);
      if (!current) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Fase no encontrada.",
        });
      }

      // Validar unicidad si cambia name o displayName
      if (data.name && data.name !== current.name) {
        const all = await db.listPipelineStages();
        if (all.some(s => s.id !== id && s.name === data.name)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Ya existe otra fase con ese nombre interno.",
          });
        }
      }
      if (data.displayName && data.displayName !== current.displayName) {
        const all = await db.listPipelineStages();
        if (all.some(s => s.id !== id && s.displayName === data.displayName)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Ya existe otra fase con ese nombre visible.",
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

      // Renombrado en cascada: si cambió name o displayName, actualizar
      // las reglas de automatización que lo referencien.
      if (data.name && data.name !== current.name) {
        await renameInAutomationRules(current.name, data.name);
      }
      if (data.displayName && data.displayName !== current.displayName) {
        await renameInAutomationRules(current.displayName, data.displayName);
      }

      return updated;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const stage = await db.getPipelineStage(input.id);
      if (!stage) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Fase no encontrada.",
        });
      }
      const leadsCount = await db.countLeadsByStageName(stage.name);
      if (leadsCount > 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `La fase "${stage.displayName}" tiene ${leadsCount} lead(s) asociado(s). Muévelos a otra fase antes de eliminarla.`,
        });
      }
      await db.deletePipelineStage(input.id);
      return { success: true };
    }),

  reorder: protectedProcedure
    .input(z.object({ orderedIds: z.array(z.number()) }))
    .mutation(async ({ input }) => {
      if (input.orderedIds.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Debe enviar al menos un identificador.",
        });
      }
      await db.reorderPipelineStages(input.orderedIds);
      return { success: true };
    }),

  toggleActive: protectedProcedure
    .input(z.object({ id: z.number(), isActive: z.boolean() }))
    .mutation(async ({ input }) => {
      const stage = await db.getPipelineStage(input.id);
      if (!stage) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Fase no encontrada.",
        });
      }
      // Si se va a desactivar, bloquear si la fase tiene leads.
      if (input.isActive === false) {
        const leadsCount = await db.countLeadsByStageName(stage.name);
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
      return updated;
    }),
});

/**
 * Crea las fases por defecto del sistema si la tabla está vacía.
 * Las fases se insertan en el orden tradicional del embudo.
 */
async function seedDefaultPipelineStages(): Promise<void> {
  const defaults = [
    { name: "nuevo", displayName: "Nuevo", color: "#3b82f6", order: 1 },
    {
      name: "contactado",
      displayName: "Contactado",
      color: "#8b5cf6",
      order: 2,
    },
    {
      name: "calificado",
      displayName: "Calificado",
      color: "#6366f1",
      order: 3,
    },
    {
      name: "propuesta",
      displayName: "Propuesta Enviada",
      color: "#f59e0b",
      order: 4,
    },
    {
      name: "negociacion",
      displayName: "Negociación",
      color: "#f97316",
      order: 5,
    },
    { name: "ganado", displayName: "Ganado", color: "#10b981", order: 6 },
    { name: "perdido", displayName: "Perdido", color: "#ef4444", order: 7 },
    { name: "pausado", displayName: "Pausado", color: "#6b7280", order: 8 },
  ];
  for (const s of defaults) {
    try {
      await db.createPipelineStage({ ...s, isActive: true });
    } catch (e) {
      // Si una fase ya existe, ignorar.
      console.warn(`[Pipeline] No se pudo sembrar fase ${s.name}:`, e);
    }
  }
  console.log("[Pipeline] Fases por defecto sembradas.");
}
