import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { executeEmailCampaign } from "../services/emailCampaign";
import {
  shouldTriggerRule,
  executeRuleAction,
  parseDiasUmbral,
} from "../services/leadAutomation";

const RESTRICTED_TRIGGERS = new Set([
  "opportunity_won",
  "opportunity_lost",
  "opportunity_proposal_sent",
]);

const RESTRICTED_ACTIONS = new Set([
  "send_telegram_to_user",
  "send_email_to_user",
]);

function requireSuperadmin(ctx: { user: { role: string } }) {
  if (ctx.user.role !== "superadmin") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message:
        "Solo el superadministrador puede gestionar automatizaciones a destinatarios específicos.",
    });
  }
}

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
      await db.createAutomationRule({
        name: "Notificar oportunidad ganada",
        trigger: "opportunity_won",
        triggerCondition: "",
        action: "send_email_to_user",
        actionData: "",
        isActive: true,
        executionCount: 0,
      });
      await db.createAutomationRule({
        name: "Notificar oportunidad perdida",
        trigger: "opportunity_lost",
        triggerCondition: "",
        action: "send_email_to_user",
        actionData: "",
        isActive: true,
        executionCount: 0,
      });
      await db.createAutomationRule({
        name: "Notificar propuesta enviada",
        trigger: "opportunity_proposal_sent",
        triggerCondition: "",
        action: "send_email_to_user",
        actionData: "",
        isActive: true,
        executionCount: 0,
      });
      return db.listAutomationRules();
    }
    return rules;
  }),

  createRule: protectedProcedure
    .input(z.any())
    .mutation(async ({ ctx, input }) => {
      if (
        input &&
        (RESTRICTED_TRIGGERS.has(input.trigger) ||
          RESTRICTED_ACTIONS.has(input.action))
      ) {
        requireSuperadmin(ctx);
      }
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
    .mutation(async ({ ctx, input }) => {
      if (
        (input.trigger && RESTRICTED_TRIGGERS.has(input.trigger)) ||
        (input.action && RESTRICTED_ACTIONS.has(input.action))
      ) {
        requireSuperadmin(ctx);
      }
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

    // Pool base: leads visibles que están en estados de "oportunidad" ganada/perdida/propuesta.
    // Sirve para los triggers opportunity_* cuando el operador pulsa "Ejecutar ahora".
    const allVisible = await db.listLeadsForExport(currentUser);
    const opportunityLeads = allVisible.filter(l =>
      ["ganado", "perdido", "propuesta"].includes(l.estadoLead)
    );

    const results: Array<{
      ruleId: number;
      ruleName: string;
      trigger: string;
      action: string;
      leadId: number;
      leadPublicId: string;
      pool: "overdue" | "proxima_a_vencer" | "opportunity" | "mixed";
      outcome: any;
    }> = [];

    for (const rule of rules) {
      // Pool combinado por regla: vencidos + (si aplica) próximos a vencer + (si aplica) estados oportunidad.
      const pool = new Map<number, db.LeadListItem>();
      for (const l of overdueLeads) pool.set(l.id, l);

      let poolTag: "overdue" | "proxima_a_vencer" | "opportunity" | "mixed" =
        "overdue";

      if (rule.trigger === "proxima_a_vencer") {
        const dias = parseDiasUmbral(rule.triggerCondition);
        const proximos = await db.listProximosAVencerLeadsForUser(
          currentUser,
          dias
        );
        for (const l of proximos) {
          if (!pool.has(l.id)) pool.set(l.id, l);
        }
        if (pool.size > overdueLeads.length) {
          poolTag = overdueLeads.length > 0 ? "mixed" : "proxima_a_vencer";
        }
      }

      const isOpportunityTrigger =
        rule.trigger === "opportunity_won" ||
        rule.trigger === "opportunity_lost" ||
        rule.trigger === "opportunity_proposal_sent";
      if (isOpportunityTrigger) {
        for (const l of opportunityLeads) {
          if (!pool.has(l.id)) pool.set(l.id, l);
        }
        const baseSize = isOpportunityTrigger ? 0 : overdueLeads.length;
        if (pool.size > baseSize) {
          poolTag = baseSize > 0 ? "mixed" : "opportunity";
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

  // ============================================================
  // Sub-router: destinatarios de automatizaciones (solo superadmin)
  // ============================================================
  recipients: router({
    list: protectedProcedure
      .use(async ({ ctx, next }) => {
        requireSuperadmin(ctx);
        return next();
      })
      .query(async () => {
        return db.listAutomationRecipients();
      }),

    create: protectedProcedure
      .use(async ({ ctx, next }) => {
        requireSuperadmin(ctx);
        return next();
      })
      .input(
        z.object({
          name: z.string().min(1).max(160),
          telegramChatId: z.string().max(64).optional().nullable(),
          email: z
            .string()
            .email()
            .max(320)
            .optional()
            .nullable()
            .or(z.literal("")),
          notes: z.string().optional().nullable(),
          isActive: z.boolean().optional().default(true),
        })
      )
      .mutation(async ({ input }) => {
        const telegramChatId = (input.telegramChatId || "").trim() || null;
        const email = (input.email || "").trim() || null;
        if (!telegramChatId && !email) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "El destinatario debe tener al menos un canal: chatId de Telegram o email.",
          });
        }
        return db.createAutomationRecipient({
          name: input.name.trim(),
          telegramChatId,
          email,
          notes: input.notes ?? null,
          isActive: input.isActive ?? true,
        });
      }),

    update: protectedProcedure
      .use(async ({ ctx, next }) => {
        requireSuperadmin(ctx);
        return next();
      })
      .input(
        z.object({
          id: z.number(),
          name: z.string().min(1).max(160).optional(),
          telegramChatId: z.string().max(64).optional().nullable(),
          email: z
            .string()
            .email()
            .max(320)
            .optional()
            .nullable()
            .or(z.literal("")),
          notes: z.string().optional().nullable(),
          isActive: z.boolean().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        const patch: Record<string, unknown> = { ...data };
        if ("telegramChatId" in patch) {
          patch.telegramChatId =
            (patch.telegramChatId as string | null | undefined)?.trim() || null;
        }
        if ("email" in patch) {
          patch.email =
            (patch.email as string | null | undefined)?.trim() || null;
        }
        if ("name" in patch && typeof patch.name === "string") {
          patch.name = patch.name.trim();
        }
        return db.updateAutomationRecipient(id, patch);
      }),

    delete: protectedProcedure
      .use(async ({ ctx, next }) => {
        requireSuperadmin(ctx);
        return next();
      })
      .input(z.number())
      .mutation(async ({ input }) => {
        await db.deleteAutomationRecipient(input);
        return { success: true };
      }),
  }),
});
