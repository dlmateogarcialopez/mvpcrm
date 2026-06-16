import type { Lead, AutomationRule } from "../../drizzle/schema";
import * as db from "../db";
import { sendLeadOperationalAlert } from "./alerts";
import { syncLeadCalendarEvent } from "./calendar";
import {
  sendTelegramAlert,
  sendTelegramAlertToAgent,
} from "./telegram.service";
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
    const defaultPipeline = await db.getDefaultPipeline();
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
        const telegramContext = await buildTelegramContext(lead, userId, rule);
        await sendTelegramAlert(alertType, telegramContext);
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
        payload.subject ||
        (rule.trigger === "after_visit"
          ? `Seguimiento post-visita: ${lead.nombreCliente}`
          : `Alerta: gestión vencida — ${lead.nombreCliente}`);
      const body =
        payload.body ||
        (rule.trigger === "after_visit"
          ? buildDefaultPostVisitEmailBody(lead)
          : buildDefaultOverdueEmailBody(lead));
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

    case "send_telegram_to_user": {
      const recipient = await resolveRecipient(rule.actionData, lead);
      if (!recipient?.telegramChatId) {
        return {
          action: "send_telegram_to_user",
          status: "skipped",
          reason: recipient
            ? "El destinatario no tiene chatId de Telegram configurado."
            : "No fue posible resolver el destinatario.",
        };
      }
      const alertType = pickTelegramAlertType(lead);
      try {
        const telegramContext = await buildTelegramContext(lead, userId, rule);
        await sendTelegramAlertToAgent(
          recipient.telegramChatId,
          alertType,
          telegramContext
        );
        await db.recordAutomationEmail(
          lead.id,
          recipient.telegramChatId,
          `Telegram a ${recipient.name}`,
          true,
          userId
        );
        return {
          action: "send_telegram_to_user",
          status: "sent",
          recipientId: recipient.id,
          recipientName: recipient.name,
        };
      } catch (error) {
        console.error(
          `[Automation] Error Telegram a usuario ${recipient.telegramChatId}:`,
          error
        );
        return {
          action: "send_telegram_to_user",
          status: "error",
          recipientId: recipient.id,
          reason: error instanceof Error ? error.message : "unknown",
        };
      }
    }

    case "send_email_to_user": {
      const recipient = await resolveRecipient(rule.actionData, lead);
      if (!recipient?.email) {
        return {
          action: "send_email_to_user",
          status: "skipped",
          reason: recipient
            ? "El destinatario no tiene email configurado."
            : "No fue posible resolver el destinatario.",
        };
      }
      const subject = `Notificación: ${lead.nombreCliente} → ${lead.estadoLead.toUpperCase()}`;
      const body = buildStateChangeEmailBody(lead, recipient.name);
      const ok = await sendMail({
        to: recipient.email,
        subject,
        text: body,
        html: body.replace(/\n/g, "<br>"),
      });
      await db.recordAutomationEmail(
        lead.id,
        recipient.email,
        subject,
        ok,
        userId
      );
      return {
        action: "send_email_to_user",
        status: ok ? "sent" : "error",
        recipientId: recipient.id,
        recipientName: recipient.name,
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
): Promise<{
  id: number | null;
  name: string;
  telegramChatId: string | null;
  email: string | null;
} | null> {
  const raw = (actionData || "").trim();
  if (!raw) return null;

  // Formato JSON
  if (raw.startsWith("{")) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed.recipientId) {
        const r = await db.getAutomationRecipient(Number(parsed.recipientId));
        if (r && r.isActive) {
          return {
            id: r.id,
            name: r.name,
            telegramChatId: r.telegramChatId ?? null,
            email: r.email ?? null,
          };
        }
        return null;
      }
      if (parsed.name || parsed.telegramChatId || parsed.email) {
        return {
          id: null,
          name: String(parsed.name ?? "Destinatario inline"),
          telegramChatId: parsed.telegramChatId
            ? String(parsed.telegramChatId)
            : null,
          email: parsed.email ? String(parsed.email) : null,
        };
      }
    } catch {
      return null;
    }
  }

  // Formato simple "Nombre:chatId" o "Nombre:email"
  const idx = raw.indexOf(":");
  if (idx > 0) {
    const name = raw.slice(0, idx).trim() || "Destinatario";
    const value = raw.slice(idx + 1).trim();
    if (!value) return null;
    const looksLikeEmail = value.includes("@");
    return {
      id: null,
      name,
      telegramChatId: looksLikeEmail ? null : value,
      email: looksLikeEmail ? value : null,
    };
  }

  return null;
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
  const fechaLimite = lead.fechaLimiteGestion
    ? new Date(lead.fechaLimiteGestion).toLocaleString("es-CO")
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
  const fechaVisita = lead.fechaVisita
    ? new Date(
        typeof lead.fechaVisita === "number"
          ? lead.fechaVisita
          : (lead.fechaVisita as any)
      ).toLocaleString("es-CO")
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
