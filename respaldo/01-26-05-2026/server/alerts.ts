import { Resend } from "resend";
import type { AppSettings, Lead } from "../../drizzle/schema";
import { notifyOwner } from "../_core/notification";

export type LeadAlertDispatchResult = {
  status: "disabled" | "sent" | "skipped" | "error";
  channel: "email" | "owner_notification" | "none";
  message: string;
};

function buildAlertTitle(lead: Lead) {
  return `Alerta lead ${lead.publicId} · ${lead.nombreCliente}`;
}

function buildAlertBody(lead: Lead) {
  const lines = [
    `Lead: ${lead.publicId}`,
    `Cliente: ${lead.nombreCliente}`,
    `Estado: ${lead.estadoLead}`,
    `Prioridad: ${lead.prioridad}`,
    `Valor estimado: $${lead.valorTotal.toLocaleString("es-CO")}`,
    `Fecha visita: ${new Date(lead.fechaVisita).toLocaleString("es-CO")}`,
    lead.fechaLimiteGestion ? `Fecha límite de gestión: ${new Date(lead.fechaLimiteGestion).toLocaleString("es-CO")}` : null,
    lead.proximaAccion ? `Próxima acción: ${lead.proximaAccion}` : null,
    lead.prioridadExplicacion ? `Explicación: ${lead.prioridadExplicacion}` : null,
    lead.notasInternas ? `Notas: ${lead.notasInternas}` : null,
  ];

  return lines.filter(Boolean).join("\n");
}

function buildAlertHtml(lead: Lead) {
  const safeBody = buildAlertBody(lead)
    .split("\n")
    .map(line => `<p style=\"margin:0 0 8px\">${line}</p>`)
    .join("");

  return `<div style="font-family:Arial,sans-serif;color:#111827">${safeBody}</div>`;
}

export async function sendLeadOperationalAlert(lead: Lead, settings: AppSettings): Promise<LeadAlertDispatchResult> {
  if (!lead.alertPending) {
    return {
      status: "skipped",
      channel: "none",
      message: "El lead no tiene alertas pendientes.",
    };
  }

  const title = buildAlertTitle(lead);
  const body = buildAlertBody(lead);
  const resendKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.ALERT_FROM_EMAIL;
  const toEmail = settings.alertEmailTo?.trim();

  if (settings.emailAlertsEnabled && resendKey && fromEmail && toEmail) {
    try {
      const resend = new Resend(resendKey);
      await resend.emails.send({
        from: fromEmail,
        to: [toEmail],
        subject: title,
        text: body,
        html: buildAlertHtml(lead),
      });

      return {
        status: "sent",
        channel: "email",
        message: `Alerta enviada por correo a ${toEmail}.`,
      };
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
        message: "Alerta enviada como notificación interna al propietario del proyecto.",
      };
    }

    return {
      status: "disabled",
      channel: "none",
      message: "No fue posible enviar email y la notificación interna no respondió.",
    };
  } catch (error) {
    console.error("[Alerts] Fallback notification error", error);
    return {
      status: "error",
      channel: "none",
      message: error instanceof Error ? error.message : "No fue posible despachar la alerta operativa.",
    };
  }
}
