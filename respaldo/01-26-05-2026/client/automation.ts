import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";

export const automationRouter = router({
  // Pipeline Stages
  listStages: protectedProcedure.query(async () => {
    return db.listPipelineStages();
  }),
  
  updateStages: protectedProcedure
    .input(z.array(z.any()))
    .mutation(async ({ input }) => {
      return db.updatePipelineStages(input);
    }),

  // Labels
  listLabels: protectedProcedure.query(async () => {
    return db.listCustomLabels();
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
    .input(z.any())
    .mutation(async ({ input }) => {
      return db.createEmailCampaign(input);
    }),
});
