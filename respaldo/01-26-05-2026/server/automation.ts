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
    return db.listAutomationRules();
  }),

  createRule: protectedProcedure
    .input(z.any())
    .mutation(async ({ input }) => {
      return db.createAutomationRule(input);
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
