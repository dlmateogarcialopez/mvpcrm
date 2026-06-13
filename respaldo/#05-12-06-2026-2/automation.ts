import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { executeEmailCampaign } from "../services/emailCampaign";
import {
  shouldTriggerRule,
  executeRuleAction,
  parseDiasUmbral,
} from "../services/leadAutomation";

export const automationRouter = router({
  // Pipeline Stages
  listStages: protectedProcedure.query(async () => {
    const stages = await db.listPipelineStages();
    if (stages.length === 0) {
      await db.createPipelineStage({
        name: "nuevo",
        displayName: "Nuevo",
        color: "#3b82f6",
        order: 1,
        isActive: true,
      });
      await db.createPipelineStage({
        name: "contactado",
        displayName: "Contactado",
        color: "#a855f7",
        order: 2,
        isActive: true,
      });
      await db.createPipelineStage({
        name: "calificado",
        displayName: "Calificado",
        color: "#6366f1",
        order: 3,
        isActive: true,
      });
      await db.createPipelineStage({
        name: "propuesta",
        displayName: "Propuesta Enviada",
        color: "#eab308",
        order: 4,
        isActive: true,
      });
      await db.createPipelineStage({
        name: "negociacion",
        displayName: "Negociación",
        color: "#f97316",
        order: 5,
        isActive: true,
      });
      await db.createPipelineStage({
        name: "ganado",
        displayName: "Ganado",
        color: "#22c55e",
        order: 6,
        isActive: true,
      });
      await db.createPipelineStage({
        name: "perdido",
        displayName: "Perdido",
        color: "#ef4444",
        order: 7,
        isActive: true,
      });
      await db.createPipelineStage({
        name: "pausado",
        displayName: "Pausado",
        color: "#6b7280",
        order: 8,
        isActive: true,
      });
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
      await db.createCustomLabel({
        name: "VIP",
        color: "#d97706",
        description: "Clientes muy importantes",
      });
      await db.createCustomLabel({
        name: "Frecuente",
        color: "#2563eb",
        description: "Clientes recurrentes",
      });
      await db.createCustomLabel({
        name: "Nuevo Evento",
        color: "#16a34a",
        description: "Oportunidad reciente",
      });
      return db.listCustomLabels();
    }
    return labels;
  }),

  createLabel: protectedProcedure.input(z.any()).mutation(async ({ input }) => {
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
      await db.createAutomationRule({
        name: "Alerta Telegram por gestión vencida",
        trigger: "gestion_vencida",
        triggerCondition: "",
        action: "send_telegram",
        actionData: "",
        isActive: true,
        executionCount: 0,
      });
      await db.createAutomationRule({
        name: "Etiquetar leads con gestión vencida",
        trigger: "gestion_vencida",
        triggerCondition: "",
        action: "add_label",
        actionData: "gestion vencida",
        isActive: true,
        executionCount: 0,
      });
      await db.createAutomationRule({
        name: "Alerta Telegram: próximo a vencer",
        trigger: "proxima_a_vencer",
        triggerCondition: "3",
        action: "send_telegram",
        actionData: "",
        isActive: true,
        executionCount: 0,
      });
      await db.createAutomationRule({
        name: "Etiquetar leads próximos a vencer",
        trigger: "proxima_a_vencer",
        triggerCondition: "3",
        action: "add_label",
        actionData: "Próximo a vencer",
        isActive: true,
        executionCount: 0,
      });
      return db.listAutomationRules();
    }
    return rules;
  }),

  createRule: protectedProcedure.input(z.any()).mutation(async ({ input }) => {
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

  // Ejecuta manualmente TODAS las reglas activas contra los leads vencidos
  // y los próximos a vencer. Pensado para que el operador dispare la lógica
  // de los triggers gestion_vencida y proxima_a_vencer (y de cualquier otro
  // trigger compatible) desde el panel con un solo clic.
  runActiveRulesManually: protectedProcedure.mutation(async ({ ctx }) => {
    const currentUser = {
      id: ctx.user.id,
      role: ctx.user.role,
      name: ctx.user.name,
      email: ctx.user.email,
    } as db.CurrentUser;

    const rules = await db.getActiveAutomationRules();
    const overdueLeads = await db.listOverdueLeadsForUser(currentUser);

    const results: Array<{
      ruleId: number;
      ruleName: string;
      trigger: string;
      action: string;
      leadId: number;
      leadPublicId: string;
      pool: "overdue" | "proxima_a_vencer" | "mixed";
      outcome: any;
    }> = [];

    for (const rule of rules) {
      // Pool combinado por regla: vencidos + (si aplica) próximos a vencer.
      const pool = new Map<number, db.LeadListItem>();
      for (const l of overdueLeads) pool.set(l.id, l);

      let poolTag: "overdue" | "proxima_a_vencer" | "mixed" = "overdue";

      if (rule.trigger === "proxima_a_vencer") {
        const dias = parseDiasUmbral(rule.triggerCondition);
        const proximos = await db.listProximosAVencerLeadsForUser(
          currentUser,
          dias
        );
        for (const l of proximos) {
          if (!pool.has(l.id)) pool.set(l.id, l);
        }
        poolTag =
          pool.size > overdueLeads.length ? "proxima_a_vencer" : "overdue";
        if (pool.size > overdueLeads.length && overdueLeads.length > 0) {
          poolTag = "mixed";
        }
      }

      for (const lead of Array.from(pool.values())) {
        try {
          if (shouldTriggerRule(rule, lead)) {
            const outcome = await executeRuleAction(rule, lead, ctx.user.id);
            await db.incrementRuleExecution(rule.id);
            results.push({
              ruleId: rule.id,
              ruleName: rule.name,
              trigger: rule.trigger,
              action: rule.action,
              leadId: lead.id,
              leadPublicId: lead.publicId,
              pool: poolTag,
              outcome,
            });
          }
        } catch (error) {
          console.error(
            `[Automation] Error ejecutando regla ${rule.id} sobre lead ${lead.id}:`,
            error
          );
          results.push({
            ruleId: rule.id,
            ruleName: rule.name,
            trigger: rule.trigger,
            action: rule.action,
            leadId: lead.id,
            leadPublicId: lead.publicId,
            pool: poolTag,
            outcome: {
              status: "error",
              reason: error instanceof Error ? error.message : "unknown",
            },
          });
        }
      }
    }

    return {
      rulesEvaluated: rules.length,
      leadsVencidos: overdueLeads.length,
      executed: results.length,
      results,
    };
  }),
});
