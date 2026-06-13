import type { Lead, AutomationRule } from "../../drizzle/schema";
import * as db from "../db";
import { sendLeadOperationalAlert } from "./alerts";
import { syncLeadCalendarEvent } from "./calendar";
import { sendTelegramAlert } from "./telegram.service";

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
  const customAutomationResults = await processCustomAutomationRules(lead, updatedByUserId);

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
        // Actualizar contador de ejecución en la BD
        await db.incrementRuleExecution(rule.id);
      }
    }

    return results;
  } catch (error) {
    console.error("[Automation] Error procesando reglas personalizadas:", error);
    return [];
  }
}

/**
 * Determina si una regla debe dispararse para un lead específico.
 */
function shouldTriggerRule(rule: any, lead: Lead): boolean {
  switch (rule.trigger) {
    case "lead_created":
      // Si fue creado en los últimos 30 segundos, se considera nuevo
      const ageMs = Date.now() - lead.fechaIngresoLead;
      return ageMs < 30000; 
    case "status_changed":
      // Si la condición coincide con el estado actual, o si no se especificó condición (aplica a todos)
      if (!rule.triggerCondition || rule.triggerCondition === "" || rule.triggerCondition === "todos") {
        return true;
      }
      return lead.estadoLead === rule.triggerCondition;
    case "label_added":
      // Verificar si tiene la etiqueta específica
      if (!rule.triggerCondition) return false;
      try {
        const labels = JSON.parse(lead.labels || "[]");
        return labels.includes(rule.triggerCondition);
      } catch {
        return false;
      }
    default:
      return false;
  }
}

/**
 * Ejecuta la acción definida en la regla.
 */
async function executeRuleAction(rule: any, lead: Lead, userId: number) {
  console.log(`[Automation] Ejecutando acción ${rule.action} para lead ${lead.publicId}`);
  
  switch (rule.action) {
    case "assign_agent":
      // Lógica de asignación automática (se deja como éxito/simulación en esta fase)
      return { action: "assign_agent", status: "success" };
    
    case "send_telegram":
      let alertType: "new_lead" | "urgent_lead" | "lead_closed" | "lead_lost" = "urgent_lead";
      if (rule.trigger === "lead_created") {
        alertType = "new_lead";
      } else if (lead.estadoLead === "ganado") {
        alertType = "lead_closed";
      } else if (lead.estadoLead === "perdido") {
        alertType = "lead_lost";
      }

      await sendTelegramAlert({
        type: alertType,
        leadName: lead.nombreCliente,
        leadValue: lead.valorTotal,
        agentName: lead.agenteResponsable || "Sin asignar",
        city: lead.ciudad || "Sin ciudad",
        details: lead.motivoPerdido || undefined,
      });
      return { action: "send_telegram", status: "sent" };

    case "send_email":
      // Integración con Resend (se deja preparado el resultado para extensiones futuras)
      return { action: "send_email", status: "queued" };

    case "add_label":
      return { action: "add_label", status: "success" };

    default:
      return { action: rule.action, status: "ignored" };
  }
}
