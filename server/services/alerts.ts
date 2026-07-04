import { sendMail } from "./mailer";
import type { Lead } from "../../drizzle/schema";
import { notifyOwner } from "../_core/notification";
import type { OrgIntegrations } from "../_core/orgIntegrations";

export type LeadAlertDispatchResult = {
  status: "disabled" | "sent" | "skipped" | "error";
  channel: "email" | "owner_notification" | "none";
  message: string;
};

function buildAlertTitle(lead: Lead) {
  return `Alerta lead ${lead.publicId} · ${lead.nombreCliente}`;
}

function buildAlertBody(lead: Lead) {
  const tz = process.env.ORG_TIMEZONE || "America/Bogota";
  const lines = [
    `Lead: ${lead.publicId}`,
    `Cliente: ${lead.nombreCliente}`,
    `Estado: ${lead.estadoLead}`,
    `Prioridad: ${lead.prioridad}`,
    `Valor estimado: $${lead.valorTotal.toLocaleString("es-CO")}`,
    `Fecha visita: ${new Date(lead.fechaVisita).toLocaleString("es-CO", { timeZone: tz })}`,
    lead.fechaLimiteGestion
      ? `Fecha límite de gestión: ${new Date(lead.fechaLimiteGestion).toLocaleString("es-CO", { timeZone: tz })}`
      : null,
    lead.proximaAccion ? `Próxima acción: ${lead.proximaAccion}` : null,
    lead.prioridadExplicacion
      ? `Explicación: ${lead.prioridadExplicacion}`
      : null,
    lead.notasInternas ? `Notas: ${lead.notasInternas}` : null,
  ];

  return lines.filter(Boolean).join("\n");
}

function buildAlertHtml(lead: Lead) {
  const safeBody = buildAlertBody(lead)
    .split("\n")
    .map(line => `<p style="margin:0 0 8px">${line}</p>`)
    .join("");

  return `<div style="font-family:Arial,sans-serif;color:#111827">${safeBody}</div>`;
}

/**
 * Despacha una alerta operativa de un lead.
 *
 * Usa la config de integraciones de la org activa (pasada
 * como `orgIntegrations`). Si la org no tiene email
 * habilitado o no tiene destinatario, cae al `notifyOwner`
 * interno.
 */
export async function sendLeadOperationalAlert(
  lead: Lead,
  orgIntegrations: OrgIntegrations | null
): Promise<LeadAlertDispatchResult> {
  if (!lead.alertPending) {
    return {
      status: "skipped",
      channel: "none",
      message: "El lead no tiene alertas pendientes.",
    };
  }

  const title = buildAlertTitle(lead);
  const body = buildAlertBody(lead);
  const toEmail = orgIntegrations?.email.alertTo?.trim();

  if (orgIntegrations?.email.enabled && toEmail) {
    try {
      const sent = await sendMail(
        {
          to: toEmail,
          subject: title,
          text: body,
          html: buildAlertHtml(lead),
        },
        orgIntegrations
      );

      if (sent) {
        return {
          status: "sent",
          channel: "email",
          message: `Alerta enviada por correo a ${toEmail}.`,
        };
      }
    } catch (error) {
      console.error("[Alerts] Email delivery error", error);
    }
  }

  try {
    const sent = await notifyOwner({
      title,
      content: body,
    });

    if (sent) {
      return {
        status: "sent",
        channel: "owner_notification",
        message:
          "Alerta enviada como notificación interna al propietario del proyecto.",
      };
    }

    return {
      status: "disabled",
      channel: "none",
      message:
        "No fue posible enviar email y la notificación interna no respondió.",
    };
  } catch (error) {
    console.error("[Alerts] Fallback notification error", error);
    return {
      status: "error",
      channel: "none",
      message:
        error instanceof Error
          ? error.message
          : "No fue posible despachar la alerta operativa.",
    };
  }
}
