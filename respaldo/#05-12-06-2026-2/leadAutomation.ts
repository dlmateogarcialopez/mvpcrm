import type { Lead, AutomationRule } from "../../drizzle/schema";
import * as db from "../db";
import { sendLeadOperationalAlert } from "./alerts";
import { syncLeadCalendarEvent } from "./calendar";
import { sendTelegramAlert } from "./telegram.service";
import { sendMail } from "./mailer";

/**
 * Motor de automatización principal.
 * Ejecuta tanto las automatizaciones fijas (Calendario, Alertas) como las reglas visuales personalizadas.
 */
export async function runLeadAutomation(lead: Lead, updatedByUserId: number) {
  const settings = await db.getAppSettings();

  // 1. Automatizaciones Fijas (Calendario y Alertas Operativas)
  const calendar = await syncLeadCalendarEvent(lead, settings);
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
    externalCalendarId: settings.googleCalendarId ?? null,
    externalEventId: calendar.eventId ?? lead.calendarEventId,
    syncAction: calendar.action,
    syncStatus: calendar.status === "error" ? "error" : "success",
    requestFingerprint: `${lead.publicId}:${lead.updatedAt.getTime()}`,
    message: calendar.message,
    triggeredByUserId: updatedByUserId,
  });

  const alert = await sendLeadOperationalAlert(lead, settings);
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
    updatedByUserId
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
async function processCustomAutomationRules(lead: Lead, userId: number) {
  try {
    const rules = await db.getActiveAutomationRules();
    const results = [];

    for (const rule of rules) {
      if (shouldTriggerRule(rule, lead)) {
        const result = await executeRuleAction(rule, lead, userId);
        results.push(result);
        await db.incrementRuleExecution(rule.id);
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
      if (
        !rule.triggerCondition ||
        rule.triggerCondition === "" ||
        rule.triggerCondition === "todos"
      ) {
        return true;
      }
      return lead.estadoLead === rule.triggerCondition;
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
 * Ejecuta la acción definida en la regla.
 */
export async function executeRuleAction(rule: any, lead: Lead, userId: number) {
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

    case "send_telegram": {
      let alertType: "new_lead" | "urgent_lead" | "lead_closed" | "lead_lost" =
        "urgent_lead";
      if (rule.trigger === "lead_created") {
        alertType = "new_lead";
      } else if (lead.estadoLead === "ganado") {
        alertType = "lead_closed";
      } else if (lead.estadoLead === "perdido") {
        alertType = "lead_lost";
      }

      try {
        await sendTelegramAlert({
          type: alertType,
          leadName: lead.nombreCliente,
          leadValue: lead.valorTotal,
          agentName: lead.agenteResponsable || "Sin asignar",
          city: lead.ciudad || "Sin ciudad",
          details: lead.motivoPerdido || undefined,
        });
        return { action: "send_telegram", status: "sent" };
      } catch (error) {
        console.error(
          `[Automation] Error Telegram para ${lead.publicId}:`,
          error
        );
        return {
          action: "send_telegram",
          status: "error",
          reason: error instanceof Error ? error.message : "unknown",
        };
      }
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
        payload.subject || `Alerta: gestión vencida — ${lead.nombreCliente}`;
      const body = payload.body || buildDefaultOverdueEmailBody(lead);
      const ok = await sendMail({
        to: recipient,
        subject,
        text: body,
        html: body.replace(/\n/g, "<br>"),
      });
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
  const fechaLimite = lead.fechaLimiteGestion
    ? new Date(lead.fechaLimiteGestion).toLocaleString("es-CO")
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
