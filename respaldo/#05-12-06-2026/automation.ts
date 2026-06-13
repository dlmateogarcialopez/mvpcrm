import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { executeEmailCampaign } from "../services/emailCampaign";

export const automationRouter = router({
  // Pipeline Stages
  listStages: protectedProcedure.query(async () => {
    const stages = await db.listPipelineStages();
    if (stages.length === 0) {
      await db.createPipelineStage({ name: "nuevo", displayName: "Nuevo", color: "#3b82f6", order: 1, isActive: true });
      await db.createPipelineStage({ name: "contactado", displayName: "Contactado", color: "#a855f7", order: 2, isActive: true });
      await db.createPipelineStage({ name: "calificado", displayName: "Calificado", color: "#6366f1", order: 3, isActive: true });
      await db.createPipelineStage({ name: "propuesta", displayName: "Propuesta Enviada", color: "#eab308", order: 4, isActive: true });
      await db.createPipelineStage({ name: "negociacion", displayName: "Negociación", color: "#f97316", order: 5, isActive: true });
      await db.createPipelineStage({ name: "ganado", displayName: "Ganado", color: "#22c55e", order: 6, isActive: true });
      await db.createPipelineStage({ name: "perdido", displayName: "Perdido", color: "#ef4444", order: 7, isActive: true });
      await db.createPipelineStage({ name: "pausado", displayName: "Pausado", color: "#6b7280", order: 8, isActive: true });
      return db.listPipelineStages();
    }
    return stages;
  }),
  
  updateStages: protectedProcedure
    .input(z.array(z.any()))
    .mutation(async ({ input }) => {
      return db.updatePipelineStages(input);
    }),

  // Labels
  listLabels: protectedProcedure.query(async () => {
    const labels = await db.listCustomLabels();
    if (labels.length === 0) {
      await db.createCustomLabel({ name: "VIP", color: "#d97706", description: "Clientes muy importantes" });
      await db.createCustomLabel({ name: "Frecuente", color: "#2563eb", description: "Clientes recurrentes" });
      await db.createCustomLabel({ name: "Nuevo Evento", color: "#16a34a", description: "Oportunidad reciente" });
      return db.listCustomLabels();
    }
    return labels;
  }),

  createLabel: protectedProcedure
    .input(z.any())
    .mutation(async ({ input }) => {
      return db.createCustomLabel(input);
    }),

  // Channels
  listChannels: protectedProcedure.query(async () => {
    return db.listCustomChannels();
  }),

  // Automation Rules
  listRules: protectedProcedure.query(async () => {
    const rules = await db.listAutomationRules();
    if (rules.length === 0) {
      await db.createAutomationRule({
        name: "Asignar leads nuevos",
        trigger: "lead_created",
        triggerCondition: "",
        action: "assign_agent",
        actionData: "",
        isActive: true,
        executionCount: 45,
      });
      await db.createAutomationRule({
        name: "Alerta para leads urgentes",
        trigger: "status_changed",
        triggerCondition: "",
        action: "send_telegram",
        actionData: "",
        isActive: true,
        executionCount: 12,
      });
      return db.listAutomationRules();
    }
    return rules;
  }),

  createRule: protectedProcedure
    .input(z.any())
    .mutation(async ({ input }) => {
      return db.createAutomationRule(input);
    }),

  updateRule: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().optional(),
        description: z.string().optional().nullable(),
        trigger: z.string().optional(),
        triggerCondition: z.string().optional().nullable(),
        action: z.string().optional(),
        actionData: z.string().optional().nullable(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      return db.updateAutomationRule(id, data);
    }),

  deleteRule: protectedProcedure
    .input(z.number())
    .mutation(async ({ input }) => {
      return db.deleteAutomationRule(input);
    }),

  // Email Campaigns
  listCampaigns: protectedProcedure.query(async () => {
    return db.listEmailCampaigns();
  }),

  createCampaign: protectedProcedure
    .input(
      z.object({
        name: z.string(),
        subject: z.string(),
        content: z.string().optional().nullable(),
        targetSegment: z.string(),
        targetSegmentData: z.string().optional().nullable(),
      })
    )
    .mutation(async ({ input }) => {
      return db.createEmailCampaign(input);
    }),

  updateCampaign: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().optional(),
        subject: z.string().optional(),
        content: z.string().optional().nullable(),
        targetSegment: z.string().optional(),
        targetSegmentData: z.string().optional().nullable(),
        status: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      return db.updateEmailCampaign(id, data);
    }),

  deleteCampaign: protectedProcedure
    .input(z.number())
    .mutation(async ({ input }) => {
      return db.deleteEmailCampaign(input);
    }),

  sendCampaign: protectedProcedure
    .input(z.number())
    .mutation(async ({ input, ctx }) => {
      return executeEmailCampaign(input, ctx.user.id);
    }),
});
