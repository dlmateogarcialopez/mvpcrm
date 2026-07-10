import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { logAudit } from "../db";
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
  // Las fases de pipeline ahora se gestionan en el router `pipeline`.
  // Las semillas se aplican vía migración 0010_multiple_pipelines.sql.

  // Labels
  listLabels: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.activeOrganizationId;
    if (!orgId) return []; // sin org activa: nada que mostrar
    const labels = await db.listCustomLabels(orgId);
    if (labels.length === 0) {
      // Sembrar defaults de la org (no globales)
      await db.createCustomLabel({
        organizationId: orgId,
        name: "VIP",
        color: "#d97706",
        description: "Clientes muy importantes",
      });
      await db.createCustomLabel({
        organizationId: orgId,
        name: "Frecuente",
        color: "#2563eb",
        description: "Clientes recurrentes",
      });
      await db.createCustomLabel({
        organizationId: orgId,
        name: "Nuevo Evento",
        color: "#16a34a",
        description: "Oportunidad reciente",
      });
      return db.listCustomLabels(orgId);
    }
    return labels;
  }),

  createLabel: protectedProcedure
    .input(z.any())
    .mutation(async ({ ctx, input }) => {
      // Forzar organizationId al de la org activa (no aceptar el del cliente)
      return db.createCustomLabel({
        ...input,
        organizationId: ctx.activeOrganizationId ?? 1,
      });
    }),

  // Channels
  listChannels: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.activeOrganizationId;
    if (!orgId) return [];
    return db.listCustomChannels(orgId);
  }),

  // Automation Rules
  listRules: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.activeOrganizationId;
    if (!orgId) return []; // sin org activa
    return db.listAutomationRules(orgId);
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
      const created = await db.createAutomationRule({
        ...input,
        organizationId: ctx.activeOrganizationId ?? 1,
      });
      await logAudit({
        organizationId: ctx.activeOrganizationId ?? 1,
        actorUserId: ctx.user?.id ?? null,
        actorEmail: ctx.user?.email ?? null,
        actorName: ctx.user?.name ?? null,
        action: "create",
        entityType: "automation_rule",
        entityId: String(created.id),
        entityName: created.name,
        summary: 'Creó la regla de automatización "' + created.name + '"',
      });
      return created;
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
      const updated = await db.updateAutomationRule(id, data);
      await logAudit({
        organizationId: ctx.activeOrganizationId ?? 1,
        actorUserId: ctx.user?.id ?? null,
        actorEmail: ctx.user?.email ?? null,
        actorName: ctx.user?.name ?? null,
        action: "update",
        entityType: "automation_rule",
        entityId: String(id),
        entityName: updated.name,
        summary: 'Actualizó la regla de automatización "' + updated.name + '"',
      });
      return updated;
    }),

  deleteRule: protectedProcedure
    .input(z.number())
    .mutation(async ({ ctx, input }) => {
      const existing = await db.getAutomationRule(input);
      const ruleName = existing?.name ?? "regla #" + input;
      await db.deleteAutomationRule(input);
      await logAudit({
        organizationId: ctx.activeOrganizationId ?? 1,
        actorUserId: ctx.user?.id ?? null,
        actorEmail: ctx.user?.email ?? null,
        actorName: ctx.user?.name ?? null,
        action: "delete",
        entityType: "automation_rule",
        entityId: String(input),
        entityName: ruleName,
        summary: 'Eliminó la regla "' + ruleName + '"',
      });
      return { success: true };
    }),

  // Email Campaigns
  listCampaigns: protectedProcedure.query(async ({ ctx }) => {
    const orgId = ctx.activeOrganizationId;
    if (!orgId) return [];
    return db.listEmailCampaigns(orgId);
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
    .mutation(async ({ ctx, input }) => {
      const created = await db.createEmailCampaign({
        ...input,
        organizationId: ctx.activeOrganizationId ?? 1,
      });
      await logAudit({
        organizationId: ctx.activeOrganizationId ?? 1,
        actorUserId: ctx.user?.id ?? null,
        actorEmail: ctx.user?.email ?? null,
        actorName: ctx.user?.name ?? null,
        action: "create",
        entityType: "email_campaign",
        entityId: String(created.id),
        entityName: created.name,
        summary: 'Creó la campaña de email "' + created.name + '"',
      });
      return created;
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
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const updated = await db.updateEmailCampaign(id, data);
      await logAudit({
        organizationId: ctx.activeOrganizationId ?? 1,
        actorUserId: ctx.user?.id ?? null,
        actorEmail: ctx.user?.email ?? null,
        actorName: ctx.user?.name ?? null,
        action: "update",
        entityType: "email_campaign",
        entityId: String(id),
        entityName: updated.name,
        summary: 'Actualizó la campaña de email "' + updated.name + '"',
      });
      return updated;
    }),

  deleteCampaign: protectedProcedure
    .input(z.number())
    .mutation(async ({ ctx, input }) => {
      const existing = await db.getEmailCampaign(input);
      const campaignName = existing?.name ?? "campaña #" + input;
      await db.deleteEmailCampaign(input);
      await logAudit({
        organizationId: ctx.activeOrganizationId ?? 1,
        actorUserId: ctx.user?.id ?? null,
        actorEmail: ctx.user?.email ?? null,
        actorName: ctx.user?.name ?? null,
        action: "delete",
        entityType: "email_campaign",
        entityId: String(input),
        entityName: campaignName,
        summary: 'Eliminó la campaña "' + campaignName + '"',
      });
      return { success: true };
    }),

  sendCampaign: protectedProcedure
    .input(z.number())
    .mutation(async ({ input, ctx }) => {
      return executeEmailCampaign(
        input,
        ctx.user.id,
        ctx.activeOrganizationId ?? 1
      );
    }),

  // Ejecuta manualmente TODAS las reglas activas contra los leads vencidos
  // y los próximos a vencer. Pensado para que el operador dispare la lógica
  // de los triggers gestion_vencida y proxima_a_vencer (y de cualquier otro
  // trigger compatible) desde el panel con un solo clic.
  runActiveRulesManually: protectedProcedure.mutation(async ({ ctx }) => {
    const orgId = ctx.activeOrganizationId ?? 1;
    const currentUser = {
      id: ctx.user.id,
      role: ctx.user.role,
      name: ctx.user.name,
      email: ctx.user.email,
      activeOrgId: orgId,
    } as db.CurrentUser;

    const rules = await db.getActiveAutomationRules(orgId);
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
            const outcome = await executeRuleAction(
              rule,
              lead,
              ctx.user.id,
              null
            );
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
      .mutation(async ({ ctx, input }) => {
        const telegramChatId = (input.telegramChatId || "").trim() || null;
        const email = (input.email || "").trim() || null;
        if (!telegramChatId && !email) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "El destinatario debe tener al menos un canal: chatId de Telegram o email.",
          });
        }
        const created = await db.createAutomationRecipient({
          name: input.name.trim(),
          telegramChatId,
          email,
          notes: input.notes ?? null,
          isActive: input.isActive ?? true,
        });
        await logAudit({
          organizationId: ctx.activeOrganizationId ?? 1,
          actorUserId: ctx.user?.id ?? null,
          actorEmail: ctx.user?.email ?? null,
          actorName: ctx.user?.name ?? null,
          action: "create",
          entityType: "automation_recipient",
          entityId: String(created.id),
          entityName: created.name,
          summary: 'Creó el destinatario de automatización "' + created.name + '"',
        });
        return created;
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
      .mutation(async ({ ctx, input }) => {
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
        const updated = await db.updateAutomationRecipient(id, patch);
        await logAudit({
          organizationId: ctx.activeOrganizationId ?? 1,
          actorUserId: ctx.user?.id ?? null,
          actorEmail: ctx.user?.email ?? null,
          actorName: ctx.user?.name ?? null,
          action: "update",
          entityType: "automation_recipient",
          entityId: String(id),
          entityName: updated.name,
          summary: 'Actualizó el destinatario de automatización "' + updated.name + '"',
        });
        return updated;
      }),

    delete: protectedProcedure
      .use(async ({ ctx, next }) => {
        requireSuperadmin(ctx);
        return next();
      })
      .input(z.number())
      .mutation(async ({ ctx, input }) => {
        const existing = await db.getAutomationRecipient(input);
        const recipientName = existing?.name ?? "destinatario #" + input;
        await db.deleteAutomationRecipient(input);
        await logAudit({
          organizationId: ctx.activeOrganizationId ?? 1,
          actorUserId: ctx.user?.id ?? null,
          actorEmail: ctx.user?.email ?? null,
          actorName: ctx.user?.name ?? null,
          action: "delete",
          entityType: "automation_recipient",
          entityId: String(input),
          entityName: recipientName,
          summary: 'Eliminó el destinatario de automatización "' + recipientName + '"',
        });
        return { success: true };
      }),
  }),
});
