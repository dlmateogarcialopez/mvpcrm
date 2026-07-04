import type { Lead, AutomationRule } from "../../drizzle/schema";
import * as db from "../db";
import {
  getOrgIntegrations,
  type OrgIntegrations,
} from "../_core/orgIntegrations";
import { sendLeadOperationalAlert } from "./alerts";
import { syncLeadCalendarEvent } from "./calendar";
import { sendTelegramAlertToAgent } from "./telegram.service";
import { sendMail } from "./mailer";

/**
 * Motor de automatización principal.
 * Ejecuta tanto las automatizaciones fijas (Calendario, Alertas) como las reglas visuales personalizadas.
 *
 * `organizationId` permite resolver las integraciones de la
 * org activa. Si no se pasa, se cae al legacy global
 * (appSettings) — backward compatible.
 */
export type LeadAutomationTriggerEvent =
  | "lead_created"
  | "lead_updated"
  | "status_changed"
  | "manual_run"
  | "import";

/**
 * Triggers que son dependientes de tiempo (proxima_a_vencer, gestion_vencida).
 * Solo deben dispararse en "manual_run" o cuando un cron los evalúa
 * explícitamente. NO en updates del lead (cambio de fase, edición, etc.)
 * porque el lead puede seguir cumpliendo la condición de tiempo aunque no haya
 * ocurrido ningún evento relevante para el usuario.
 */
const TIME_BASED_TRIGGERS = new Set(["proxima_a_vencer", "gestion_vencida"]);

/**
 * Triggers que solo deben dispararse cuando el estado del lead cambia
 * (status_changed), NO en cada edición (lead_updated).
 * Ej: "opportunity_won" dispara cada vez que se edita un lead ganado,
 * lo cual genera spam de notificaciones. Debe limitarse a transiciones
 * reales de estado.
 */
const STATE_CHANGE_TRIGGERS = new Set([
  "opportunity_won",
  "opportunity_lost",
  "opportunity_proposal_sent",
]);

export async function runLeadAutomation(
  lead: Lead,
  updatedByUserId: number,
  organizationId?: number | null,
  triggerEvent: LeadAutomationTriggerEvent = "lead_updated"
) {
  const orgIntegrations = organizationId
    ? await getOrgIntegrations(organizationId)
    : null;
  // Para campos legacy (ej. externalCalendarId del record), usamos
  // lo que tengamos disponible. Como ya no leemos appSettings,
  // usamos el calendarId resuelto de la org.
  const calendarIdForRecord =
    orgIntegrations?.googleCalendar.calendarId ?? null;

  // 1. Automatizaciones Fijas (Calendario y Alertas Operativas)
  const calendar = await syncLeadCalendarEvent(lead, orgIntegrations);
  await db.updateLeadCalendarState({
    leadId: lead.id,
    eventId: calendar.eventId ?? lead.calendarEventId,
    eventUrl: calendar.eventUrl ?? lead.calendarEventUrl,
    syncStatus:
      calendar.status === "synced"
        ? "synced"
        : calendar.status === "error"
          ? "error"
          : "disabled",
    syncMessage: calendar.message,
    updatedByUserId,
  });

  await db.recordCalendarSync({
    leadId: lead.id,
    externalCalendarId: calendarIdForRecord,
    externalEventId: calendar.eventId ?? lead.calendarEventId,
    syncAction: calendar.action,
    syncStatus: calendar.status === "error" ? "error" : "success",
    requestFingerprint: `${lead.publicId}:${lead.updatedAt.getTime()}`,
    message: calendar.message,
    triggeredByUserId: updatedByUserId,
  });

  const alert = await sendLeadOperationalAlert(lead, orgIntegrations);
  if (alert.status === "sent") {
    await db.recordLeadAlertDelivery({
      leadId: lead.id,
      channel: alert.channel,
      message: alert.message,
      updatedByUserId,
    });
  }

  // 2. Motor de Reglas Visuales Personalizadas
  const customAutomationResults = await processCustomAutomationRules(
    lead,
    updatedByUserId,
    orgIntegrations,
    triggerEvent
  );

  return {
    calendar,
    alert,
    customAutomations: customAutomationResults,
  };
}

/**
 * Procesa las reglas de automatización creadas visualmente por el usuario.
 */

async function processCustomAutomationRules(
  lead: Lead,
  userId: number,
  orgIntegrations: OrgIntegrations | null,
  triggerEvent: LeadAutomationTriggerEvent
) {
  try {
    // Solo reglas de la org activa (antes era global: reglas de la
    // org A se disparaban para leads de la org B).
    const rules = await db.getActiveAutomationRules(lead.organizationId ?? 1);
    const results = [];

    for (const rule of rules) {
      // Reglas basadas en tiempo solo se ejecutan en "manual_run" o en
      // un cron explícito. No se disparan en updates/edit/moveStage.
      if (
        TIME_BASED_TRIGGERS.has(rule.trigger) &&
        triggerEvent !== "manual_run" &&
        triggerEvent !== "import"
      ) {
        continue;
      }
      // Reglas de cambio de estado (opportunity_won, opportunity_lost,
      // opportunity_proposal_sent) solo se disparan en cambios reales de
      // estado, no en cada edición del lead.
      if (
        STATE_CHANGE_TRIGGERS.has(rule.trigger) &&
        triggerEvent !== "status_changed" &&
        triggerEvent !== "manual_run"
      ) {
        continue;
      }
      if (shouldTriggerRule(rule, lead)) {
        const result = await executeRuleAction(
          rule,
          lead,
          userId,
          orgIntegrations
        );
        results.push(result);
        await db.incrementRuleExecution(rule.id);
        if (rule.trigger === "after_visit") {
          await db.markLeadAfterVisitFired(lead.id);
          console.log(
            `[Automation] Marcado lead ${lead.publicId} como after_visit ejecutado.`
          );
        }
      }
    }

    return results;
  } catch (error) {
    console.error(
      "[Automation] Error procesando reglas personalizadas:",
      error
    );
    return [];
  }
}
/**
 * Determina si una regla debe dispararse para un lead específico.
 * El objeto `lead` puede ser un Lead crudo o un LeadListItem enriquecido
 * (con `isOverdue`, `isClosed`, etc.) — la rama `gestion_vencida` usa el campo
 * `isOverdue` cuando está presente, y como fallback lo recalcula en tiempo real.
 */
export function shouldTriggerRule(
  rule: any,
  lead: Lead & { isOverdue?: boolean; isClosed?: boolean }
): boolean {
  switch (rule.trigger) {
    case "lead_created": {
      const ageMs = Date.now() - lead.fechaIngresoLead;
      return ageMs < 30000;
    }
    case "status_changed": {
      const cond = rule.triggerCondition;
      // Empty / "todos" / undefined → fires on any state change
      if (!cond || cond === "" || cond === "todos") {
        return true;
      }
      // Backward compat: legacy string format = exact match against estadoLead
      if (typeof cond === "string" && !cond.trim().startsWith("{")) {
        return lead.estadoLead === cond;
      }
      // New format: JSON with pipelineId and stageNames
      try {
        const parsed = typeof cond === "string" ? JSON.parse(cond) : cond;
        if (
          parsed &&
          Array.isArray(parsed.stageNames) &&
          parsed.stageNames.length > 0
        ) {
          return parsed.stageNames.includes(lead.estadoLead);
        }
        return true;
      } catch {
        return lead.estadoLead === cond;
      }
    }
    case "label_added": {
      if (!rule.triggerCondition) return false;
      try {
        const labels = JSON.parse(lead.labels || "[]");
        return labels.includes(rule.triggerCondition);
      } catch {
        return false;
      }
    }
    case "gestion_vencida": {
      // Detección en tiempo real: si el lead está vencido AHORA, se dispara.
      // Usa el flag calculado por enrichLead si está disponible; si no, recalcula.
      const isOverdueNow = computeIsOverdueNow(lead);
      return isOverdueNow;
    }
    case "proxima_a_vencer": {
      // Detección configurable: el umbral vive en triggerCondition (días).
      // Formatos aceptados: "3", "3.5", "0,5" (coma o punto). Vacío → 3 días.
      const dias = parseDiasUmbral(rule.triggerCondition);
      return isProximaAVencer(lead, dias);
    }
    case "opportunity_won":
      return lead.estadoLead === "ganado";
    case "opportunity_lost":
      return lead.estadoLead === "perdido";
    case "opportunity_proposal_sent":
      return lead.estadoLead === "propuesta";
    case "after_visit":
      if (typeof lead.isClosed === "boolean" && lead.isClosed) return false;
      if (["ganado", "perdido"].includes(lead.estadoLead)) return false;
      if (!lead.fechaVisita) return false;
      if ((lead as any).firedAfterVisitAt) return false; // ya disparado antes
      return lead.fechaVisita < Date.now();
    default:
      return false;
  }
}

/**
 * Parsea el umbral de días desde triggerCondition.
 * Acepta "3", "3.5", "0,5". Si no parsea o está vacío, devuelve 3 por defecto.
 */
export function parseDiasUmbral(raw: string | null | undefined): number {
  if (!raw) return 3;
  const cleaned = String(raw).trim().replace(",", ".");
  if (!cleaned) return 3;
  const n = parseFloat(cleaned);
  return Number.isFinite(n) && n > 0 ? n : 3;
}

/**
 * Determina si el lead está próximo a vencer dentro de `dias` días.
 * El flag `isClosed` se respeta si viene del enrichLead; si no, recalcula.
 */
function isProximaAVencer(
  lead: Lead & { isClosed?: boolean },
  dias: number
): boolean {
  if (typeof lead.isClosed === "boolean" && lead.isClosed) return false;
  if (["ganado", "perdido"].includes(lead.estadoLead)) return false;
  if (!lead.fechaLimiteGestion) return false;
  const now = Date.now();
  const diff = lead.fechaLimiteGestion - now;
  const ms = dias * 24 * 60 * 60 * 1000;
  return diff > 0 && diff <= ms;
}

/**
 * Recalcula isOverdue contra la hora actual cuando el lead proviene como Lead crudo
 * (sin enrichLead). Si ya viene con el flag, lo respeta.
 */
function computeIsOverdueNow(
  lead: Lead & { isOverdue?: boolean; isClosed?: boolean }
): boolean {
  if (typeof lead.isOverdue === "boolean") {
    return lead.isOverdue;
  }
  if (typeof lead.isClosed === "boolean" && lead.isClosed) {
    return false;
  }
  const closedStatuses = ["ganado", "perdido"];
  if (closedStatuses.includes(lead.estadoLead)) {
    return false;
  }
  if (!lead.fechaLimiteGestion) {
    return false;
  }
  return lead.fechaLimiteGestion < Date.now();
}

/**
 * Resuelve el `kind` (open/won/lost/paused) del lead en el pipeline principal.
 * En el modelo de múltiples embudos, el `estadoLead` del lead corresponde al
 * `name` del stage del pipeline "Principal". Esta función consulta la BD
 * para resolver el `kind` real. Si no se encuentra, usa una inferencia
 * heurística basada en el `name` del estado para mantener retro-compatibilidad.
 */
export async function resolveLeadKind(
  lead: Lead
): Promise<"open" | "won" | "lost" | "paused"> {
  try {
    const defaultPipeline = await db.getDefaultPipeline(
      lead.organizationId ?? 1
    );
    if (defaultPipeline) {
      const stage = await db.getPipelineStageByName(
        defaultPipeline.id,
        lead.estadoLead
      );
      if (stage) return stage.kind;
    }
  } catch (e) {
    // silencioso
  }
  // Fallback heurístico (compatibilidad con stages sin migrar)
  if (lead.estadoLead === "ganado") return "won";
  if (lead.estadoLead === "perdido") return "lost";
  if (lead.estadoLead === "pausado") return "paused";
  return "open";
}

/**
 * Ejecuta la acción definida en la regla.
 */
export async function executeRuleAction(
  rule: any,
  lead: Lead,
  userId: number,
  orgIntegrations: OrgIntegrations | null
) {
  console.log(
    `[Automation] Ejecutando acción ${rule.action} para lead ${lead.publicId} (trigger=${rule.trigger})`
  );

  switch (rule.action) {
    case "assign_agent": {
      const agentResult = await resolveAgentTarget(rule.actionData, lead);
      if (!agentResult) {
        return {
          action: "assign_agent",
          status: "skipped",
          reason: "Agente no resuelto",
        };
      }
      const { agenteUserId, agenteResponsable } = agentResult;
      if (lead.agenteUserId === agenteUserId) {
        return { action: "assign_agent", status: "no_change" };
      }
      const updated = await db.assignLeadAgent(
        lead.id,
        agenteUserId,
        agenteResponsable,
        userId
      );
      if (!updated) {
        return {
          action: "assign_agent",
          status: "error",
          reason: "No se pudo actualizar el lead",
        };
      }
      return {
        action: "assign_agent",
        status: "success",
        agenteUserId,
        agenteResponsable,
      };
    }

    case "send_email": {
      const payload = parseEmailActionData(rule.actionData);
      const recipient = await resolveEmailRecipient(payload.recipient, lead);
      if (!recipient) {
        return {
          action: "send_email",
          status: "skipped",
          reason: "Destinatario no resuelto",
        };
      }
      const subject =
        payload.subject ||
        (rule.trigger === "after_visit"
          ? `Seguimiento post-visita: ${lead.nombreCliente}`
          : `Alerta: gestión vencida — ${lead.nombreCliente}`);
      const body =
        payload.body ||
        (rule.trigger === "after_visit"
          ? buildDefaultPostVisitEmailBody(lead)
          : buildDefaultOverdueEmailBody(lead));
      const ok = await sendMail(
        {
          to: recipient,
          subject,
          text: body,
          html: body.replace(/\n/g, "<br>"),
        },
        orgIntegrations
      );
      await db.recordAutomationEmail(lead.id, recipient, subject, ok, userId);
      return { action: "send_email", status: ok ? "sent" : "error" };
    }

    case "add_label": {
      const labelName = (rule.actionData || "").trim();
      if (!labelName) {
        return {
          action: "add_label",
          status: "skipped",
          reason: "Etiqueta vacía",
        };
      }
      const existing = parseLeadLabels(lead.labels);
      if (existing.includes(labelName)) {
        return { action: "add_label", status: "no_change", label: labelName };
      }
      const next = [...existing, labelName];
      const updated = await db.updateLeadLabels(lead.id, next, userId);
      if (!updated) {
        return {
          action: "add_label",
          status: "error",
          reason: "No se pudo actualizar el lead",
        };
      }
      return { action: "add_label", status: "success", label: labelName };
    }

    case "change_status": {
      const newStatus = (rule.actionData || "").trim();
      if (!newStatus) {
        return {
          action: "change_status",
          status: "skipped",
          reason: "Estado vacío",
        };
      }
      if (lead.estadoLead === newStatus) {
        return {
          action: "change_status",
          status: "no_change",
          estado: newStatus,
        };
      }
      const updated = await db.updateLeadStatusField(
        lead.id,
        newStatus,
        userId
      );
      if (!updated) {
        return {
          action: "change_status",
          status: "error",
          reason: "No se pudo actualizar el lead",
        };
      }
      return { action: "change_status", status: "success", estado: newStatus };
    }

    case "send_telegram_to_user": {
      const recipients = await resolveRecipient(rule.actionData, lead);
      if (recipients.length === 0) {
        return {
          action: "send_telegram_to_user",
          status: "skipped",
          reason: "No fue posible resolver los destinatarios.",
        };
      }
      const alertType = pickTelegramAlertType(lead);
      const telegramContext = await buildTelegramContext(lead, userId, rule);
      const sentTo: Array<{
        name: string;
        chatId: string;
        ok: boolean;
        error?: string;
      }> = [];

      for (const recipient of recipients) {
        if (!recipient.telegramChatId) {
          sentTo.push({
            name: recipient.name,
            chatId: "",
            ok: false,
            error: "sin chatId",
          });
          continue;
        }
        try {
          await sendTelegramAlertToAgent(
            recipient.telegramChatId,
            alertType,
            telegramContext,
            orgIntegrations
          );
          await db.recordAutomationEmail(
            lead.id,
            recipient.telegramChatId,
            `Telegram a ${recipient.name}`,
            true,
            userId
          );
          sentTo.push({
            name: recipient.name,
            chatId: recipient.telegramChatId,
            ok: true,
          });
        } catch (error) {
          console.error(
            `[Automation] Error Telegram a usuario ${recipient.telegramChatId}:`,
            error
          );
          await db.recordAutomationEmail(
            lead.id,
            recipient.telegramChatId,
            `Telegram a ${recipient.name}`,
            false,
            userId
          );
          sentTo.push({
            name: recipient.name,
            chatId: recipient.telegramChatId,
            ok: false,
            error: error instanceof Error ? error.message : "unknown",
          });
        }
      }

      const successCount = sentTo.filter(r => r.ok).length;
      const totalCount = sentTo.length;
      const allOk = successCount === totalCount;

      return {
        action: "send_telegram_to_user",
        status: allOk ? "sent" : successCount > 0 ? "partial" : "error",
        recipients: sentTo,
        summary: `${successCount}/${totalCount} enviados`,
      };
    }

    case "send_email_to_user": {
      const recipients = await resolveRecipient(rule.actionData, lead);
      if (recipients.length === 0) {
        return {
          action: "send_email_to_user",
          status: "skipped",
          reason: "No fue posible resolver los destinatarios.",
        };
      }
      const subject = `Notificación: ${lead.nombreCliente} → ${lead.estadoLead.toUpperCase()}`;
      const body = buildStateChangeEmailBody(
        lead,
        recipients.map(r => r.name).join(", ")
      );
      const sentTo: Array<{
        name: string;
        email: string;
        ok: boolean;
        error?: string;
      }> = [];

      for (const recipient of recipients) {
        if (!recipient.email) {
          sentTo.push({
            name: recipient.name,
            email: "",
            ok: false,
            error: "sin email",
          });
          continue;
        }
        const ok = await sendMail(
          {
            to: recipient.email,
            subject,
            text: body,
            html: body.replace(/\n/g, "<br>"),
          },
          orgIntegrations
        );
        await db.recordAutomationEmail(
          lead.id,
          recipient.email,
          subject,
          ok,
          userId
        );
        sentTo.push({
          name: recipient.name,
          email: recipient.email,
          ok,
          error: ok ? undefined : "envío falló",
        });
      }

      const successCount = sentTo.filter(r => r.ok).length;
      const totalCount = sentTo.length;
      const allOk = successCount === totalCount;

      return {
        action: "send_email_to_user",
        status: allOk ? "sent" : successCount > 0 ? "partial" : "error",
        recipients: sentTo,
        summary: `${successCount}/${totalCount} enviados`,
      };
    }

    default:
      return { action: rule.action, status: "ignored" };
  }
}

/* ---------------- helpers ---------------- */

function parseLeadLabels(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map(String);
    }
  } catch {
    // Si no es JSON, tratarlo como string separado por comas
    return raw
      .split(",")
      .map(s => s.trim())
      .filter(Boolean);
  }
  return [];
}

function parseEmailActionData(raw: string | null | undefined): {
  recipient?: "agent" | "lead" | string;
  subject?: string;
  body?: string;
} {
  if (!raw) return {};
  const trimmed = raw.trim();
  if (!trimmed) return {};
  // Soporta JSON
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed);
      return {
        recipient:
          typeof parsed.recipient === "string" ? parsed.recipient : undefined,
        subject:
          typeof parsed.subject === "string" ? parsed.subject : undefined,
        body: typeof parsed.body === "string" ? parsed.body : undefined,
      };
    } catch {
      return {};
    }
  }
  // Texto plano = subject corto
  return { subject: trimmed };
}

function buildDefaultOverdueEmailBody(lead: Lead): string {
  const tz = process.env.ORG_TIMEZONE || "America/Bogota";
  const fechaLimite = lead.fechaLimiteGestion
    ? new Date(lead.fechaLimiteGestion).toLocaleString("es-CO", {
        timeZone: tz,
      })
    : "Sin fecha límite";
  return [
    `Hola,`,
    ``,
    `El lead "${lead.nombreCliente}" (${lead.publicId}) tiene la gestión vencida desde ${fechaLimite}.`,
    `Valor total: $${(lead.valorTotal || 0).toLocaleString("es-CO")}.`,
    `Ciudad: ${lead.ciudad || "Sin ciudad"}.`,
    ``,
    `Por favor toma acción cuanto antes.`,
  ].join("\n");
}

async function resolveAgentTarget(
  raw: string | null | undefined,
  lead: Lead
): Promise<{ agenteUserId: number | null; agenteResponsable: string } | null> {
  const value = (raw || "").trim();
  // Formato JSON: {"userId": 12} o {"name": "Ana"}
  if (value.startsWith("{")) {
    try {
      const parsed = JSON.parse(value);
      if (parsed.userId) {
        const u = await db.getUserById(Number(parsed.userId));
        if (u) {
          return {
            agenteUserId: u.id,
            agenteResponsable: u.name || u.email || `Agente ${u.id}`,
          };
        }
      }
      if (parsed.name) {
        const found = await db.findUserByName(String(parsed.name));
        if (found) {
          return {
            agenteUserId: found.id,
            agenteResponsable:
              found.name || found.email || `Agente ${found.id}`,
          };
        }
      }
    } catch {
      // cae al fallback
    }
  }
  if (!value) {
    // Sin actionData: round-robin simple — no asignar; dejar como error para que el usuario corrija la regla.
    return null;
  }
  // Texto libre: intentar match por nombre
  const found = await db.findUserByName(value);
  if (found) {
    return {
      agenteUserId: found.id,
      agenteResponsable: found.name || found.email || `Agente ${found.id}`,
    };
  }
  // Si no se encuentra, no actualizamos agenteUserId pero sí el nombre libre (texto)
  return { agenteUserId: lead.agenteUserId ?? null, agenteResponsable: value };
}

async function resolveEmailRecipient(
  target: string | undefined,
  lead: Lead
): Promise<string | null> {
  const t = (target || "agent").toLowerCase();
  if (t === "lead" || t === "cliente") {
    return lead.correo || null;
  }
  // "agent" o default: intentar el correo del agente asignado
  if (lead.agenteUserId) {
    const u = await db.getUserById(lead.agenteUserId);
    if (u?.email) return u.email;
  }
  // Fallback: alertEmailTo de settings si el lead no tiene agente
  const settings = await db.getAppSettings();
  if (settings.alertEmailTo) return settings.alertEmailTo;
  return null;
}

/* ---------------- helpers para destinatarios (opportunity_*) ---------------- */

/**
 * Resuelve el destinatario a partir del actionData de una regla.
 * Formatos aceptidos:
 *   - JSON: { "recipientId": 5 }
 *   - JSON: { "name": "X", "telegramChatId": "...", "email": "..." }  (inline, no persiste)
 *   - Texto plano: "Nombre:chatId" o "Nombre:email"
 * Devuelve null si no puede resolverse.
 */
async function resolveRecipient(
  actionData: string | null | undefined,
  _lead: Lead
): Promise<
  Array<{
    id: number | null;
    name: string;
    telegramChatId: string | null;
    email: string | null;
  }>
> {
  const raw = (actionData || "").trim();
  if (!raw) return [];

  // Formato JSON
  if (raw.startsWith("{")) {
    try {
      const parsed = JSON.parse(raw);

      // Nuevo formato: array de userIds { userIds: [1, 2, 3] }
      if (Array.isArray(parsed?.userIds) && parsed.userIds.length > 0) {
        const results = [];
        for (const userId of parsed.userIds) {
          const user = await db.getUserById(Number(userId));
          if (user && user.telegramChatId) {
            results.push({
              id: user.id,
              name: user.name || user.email || "Usuario",
              telegramChatId: user.telegramChatId,
              email: user.email ?? null,
            });
          }
        }
        if (results.length > 0) return results;
      }

      // Nuevo formato: array de recipientIds { recipientIds: [1, 2] }
      if (
        Array.isArray(parsed?.recipientIds) &&
        parsed.recipientIds.length > 0
      ) {
        const results = [];
        for (const rId of parsed.recipientIds) {
          const r = await db.getAutomationRecipient(Number(rId));
          if (r && r.isActive) {
            results.push({
              id: r.id,
              name: r.name,
              telegramChatId: r.telegramChatId ?? null,
              email: r.email ?? null,
            });
          }
        }
        if (results.length > 0) return results;
      }

      // Formato legacy: userId único
      if (parsed.userId) {
        const user = await db.getUserById(Number(parsed.userId));
        if (user && user.telegramChatId) {
          return [
            {
              id: user.id,
              name: user.name || user.email || "Usuario",
              telegramChatId: user.telegramChatId,
              email: user.email ?? null,
            },
          ];
        }
        return [];
      }

      // Formato legacy: recipientId único
      if (parsed.recipientId) {
        const r = await db.getAutomationRecipient(Number(parsed.recipientId));
        if (r && r.isActive) {
          return [
            {
              id: r.id,
              name: r.name,
              telegramChatId: r.telegramChatId ?? null,
              email: r.email ?? null,
            },
          ];
        }
        return [];
      }

      if (parsed.name || parsed.telegramChatId || parsed.email) {
        return [
          {
            id: null,
            name: String(parsed.name ?? "Destinatario inline"),
            telegramChatId: parsed.telegramChatId
              ? String(parsed.telegramChatId)
              : null,
            email: parsed.email ? String(parsed.email) : null,
          },
        ];
      }
    } catch {
      return [];
    }
  }

  // Formato simple "Nombre:chatId" o "Nombre:email"
  const idx = raw.indexOf(":");
  if (idx > 0) {
    const name = raw.slice(0, idx).trim() || "Destinatario";
    const value = raw.slice(idx + 1).trim();
    if (!value) return [];
    const looksLikeEmail = value.includes("@");
    return [
      {
        id: null,
        name,
        telegramChatId: looksLikeEmail ? null : value,
        email: looksLikeEmail ? value : null,
      },
    ];
  }

  return [];
}

/**
 * Mapea el estado del lead al tipo de alerta de Telegram más coherente.
 */
function pickTelegramAlertType(
  lead: Lead
): "new_lead" | "urgent_lead" | "lead_closed" | "lead_lost" {
  if (lead.estadoLead === "ganado") return "lead_closed";
  if (lead.estadoLead === "perdido") return "lead_lost";
  if (lead.estadoLead === "propuesta") return "urgent_lead";
  return "urgent_lead";
}

const TRIGGER_LABELS: Record<string, string> = {
  lead_created: "Nuevo lead",
  status_changed: "Cambio de estado",
  label_added: "Etiqueta añadida",
  gestion_vencida: "Gestión vencida",
  proxima_a_vencer: "Próximo a vencer",
  opportunity_won: "Oportunidad ganada",
  opportunity_lost: "Oportunidad perdida",
  opportunity_proposal_sent: "Propuesta enviada",
  after_visit: "Post-visita",
  daily_schedule: "Programación diaria",
};

/**
 * Construye el contexto enriquecido que se pasa al servicio de Telegram.
 * Carga el agente (de users) y el usuario que disparó la regla.
 */
async function buildTelegramContext(
  lead: Lead,
  triggeredByUserId: number,
  rule: any
): Promise<import("./telegram.service").TelegramAlertContext> {
  let agent: { name?: string | null; email?: string | null } | null = null;
  if (lead.agenteUserId) {
    try {
      const u = await db.getUserById(lead.agenteUserId);
      if (u) {
        agent = { name: u.name, email: u.email };
      }
    } catch (e) {
      // silencioso
    }
  }

  let triggeredByName: string | null = null;
  try {
    const u = await db.getUserById(triggeredByUserId);
    if (u) {
      triggeredByName = u.name || u.email || `Usuario #${triggeredByUserId}`;
    }
  } catch (e) {
    // silencioso
  }

  return {
    lead: {
      nombreCliente: lead.nombreCliente,
      publicId: lead.publicId,
      ciudad: lead.ciudad,
      valorTotal: lead.valorTotal,
      estadoLead: lead.estadoLead,
      motivoVisita: lead.motivoVisita,
      tipoEvento: lead.tipoEvento,
      canalOrigen: lead.canalOrigen,
      fechaIngresoLead: lead.fechaIngresoLead,
      fechaVisita: lead.fechaVisita,
      fechaLimiteGestion: lead.fechaLimiteGestion,
      labels: lead.labels,
      cantidadMultiple: lead.cantidadMultiple,
      cantidadJunior: lead.cantidadJunior,
      cantidadSenior: lead.cantidadSenior,
      cantidadParqueadero: lead.cantidadParqueadero,
      precioMultiple: lead.precioMultiple,
      precioJunior: lead.precioJunior,
      precioSenior: lead.precioSenior,
      precioParqueadero: lead.precioParqueadero,
      motivoPerdido: lead.motivoPerdido,
      agenteResponsable: lead.agenteResponsable,
    },
    agent,
    triggeredByUserName: triggeredByName,
    triggerLabel:
      (rule?.trigger && TRIGGER_LABELS[rule.trigger]) ||
      rule?.name ||
      rule?.trigger ||
      null,
  };
}

/**
 * Cuerpo de email estándar para notificaciones de cambio de estado del embudo.
 */
function buildStateChangeEmailBody(lead: Lead, recipientName: string): string {
  const tz = process.env.ORG_TIMEZONE || "America/Bogota";
  const fechaLimite = lead.fechaLimiteGestion
    ? new Date(lead.fechaLimiteGestion).toLocaleString("es-CO", {
        timeZone: tz,
      })
    : "Sin fecha límite";
  return [
    `Hola ${recipientName},`,
    ``,
    `El lead "${lead.nombreCliente}" (${lead.publicId}) cambió de estado a "${lead.estadoLead.toUpperCase()}".`,
    `Valor total: $${(lead.valorTotal || 0).toLocaleString("es-CO")}.`,
    `Ciudad: ${lead.ciudad || "Sin ciudad"}.`,
    `Fecha límite de gestión: ${fechaLimite}.`,
    `Agente responsable: ${lead.agenteResponsable || "Sin asignar"}.`,
    ``,
    `Este mensaje fue generado automáticamente por una regla de automatización.`,
  ].join("\n");
}

/**
 * Cuerpo de email por defecto para el trigger after_visit.
 * Se usa cuando el usuario no escribe un mensaje personalizado en actionData.
 */
function buildDefaultPostVisitEmailBody(lead: Lead): string {
  const tz = process.env.ORG_TIMEZONE || "America/Bogota";
  const fechaVisita = lead.fechaVisita
    ? new Date(
        typeof lead.fechaVisita === "number"
          ? lead.fechaVisita
          : (lead.fechaVisita as any)
      ).toLocaleString("es-CO", { timeZone: tz })
    : "Sin fecha";
  return [
    `Hola ${lead.nombreCliente},`,
    ``,
    `Esperamos que tu visita del ${fechaVisita} haya sido de tu agrado.`,
    ``,
    `Quedamos atentos a cualquier consulta o necesidad adicional.`,
    ``,
    `Saludos,`,
    `Equipo de Ventas`,
  ].join("\n");
}
