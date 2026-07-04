import { google } from "googleapis";
import type { Lead } from "../../drizzle/schema";
import { resolveCalendarConfig, type OrgIntegrations } from "../_core/orgIntegrations";

export type CalendarSyncResult = {
  status: "disabled" | "synced" | "error" | "skipped";
  action: "create" | "update" | "skip" | "error";
  eventId?: string | null;
  eventUrl?: string | null;
  message: string;
};

function getGooglePrivateKey() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  return raw ? raw.replace(/\\n/g, "\n") : null;
}

function buildEventDescription(lead: Lead) {
  const sections = [
    `Lead: ${lead.publicId}`,
    `Cliente: ${lead.nombreCliente}`,
    `Teléfono: ${lead.telefono}`,
    `Correo: ${lead.correo}`,
    `Estado: ${lead.estadoLead}`,
    `Prioridad: ${lead.prioridad}`,
    `Valor estimado: $${lead.valorTotal.toLocaleString("es-CO")}`,
    `Total personas: ${lead.totalPersonas}`,
    `Motivo de visita: ${lead.motivoVisita}`,
    `Objeción principal: ${lead.objecionPrincipal}`,
    lead.proximaAccion ? `Próxima acción: ${lead.proximaAccion}` : null,
    lead.notasInternas ? `Notas internas: ${lead.notasInternas}` : null,
  ];

  return sections.filter(Boolean).join("\n");
}

/**
 * Sincroniza un lead con Google Calendar usando la config de
 * integraciones de la org activa.
 *
 * - El service account (GOOGLE_SERVICE_ACCOUNT_EMAIL/PRIVATE_KEY)
 *   es GLOBAL (no se replica por org).
 * - El calendarId es PER-ORG, viene de orgIntegrations.
 */
export async function syncLeadCalendarEvent(
  lead: Lead,
  orgIntegrations: OrgIntegrations | null
): Promise<CalendarSyncResult> {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = getGooglePrivateKey();
  const cfg = orgIntegrations
    ? resolveCalendarConfig(orgIntegrations)
    : {
        enabled: false,
        calendarId: null,
        hasServiceAccount: Boolean(
          process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
            process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
        ),
      };
  const calendarId = cfg.calendarId?.trim();

  if (!cfg.enabled) {
    return {
      status: "disabled",
      action: "skip",
      message: "La sincronización con Google Calendar está desactivada en configuración.",
    };
  }

  if (!clientEmail || !privateKey || !calendarId) {
    return {
      status: "disabled",
      action: "skip",
      message: "Faltan credenciales o calendarId para sincronizar con Google Calendar.",
    };
  }

  try {
    const auth = new google.auth.JWT({
      email: clientEmail,
      key: privateKey,
      scopes: ["https://www.googleapis.com/auth/calendar"],
    });

    const calendar = google.calendar({ version: "v3", auth });
    const start = new Date(lead.fechaVisita);
    const end = new Date(lead.fechaVisita + 60 * 60 * 1000);

    const resource = {
      summary: `Visita comercial ${lead.nombreCliente} · ${lead.publicId}`,
      description: buildEventDescription(lead),
      start: {
        dateTime: start.toISOString(),
      },
      end: {
        dateTime: end.toISOString(),
      },
      attendees: lead.correo ? [{ email: lead.correo }] : undefined,
      status: lead.estadoLead === "perdido" ? "cancelled" : "confirmed",
    };

    let response;
    try {
      if (lead.calendarEventId) {
        response = await calendar.events.update({
          calendarId,
          eventId: lead.calendarEventId,
          requestBody: resource,
        });

        return {
          status: "synced",
          action: "update",
          eventId: response.data.id ?? lead.calendarEventId,
          eventUrl: response.data.htmlLink ?? lead.calendarEventUrl ?? null,
          message: "Evento de calendario actualizado correctamente.",
        };
      } else {
        response = await calendar.events.insert({
          calendarId,
          requestBody: resource,
        });

        return {
          status: "synced",
          action: "create",
          eventId: response.data.id ?? null,
          eventUrl: response.data.htmlLink ?? null,
          message: "Evento de calendario creado correctamente.",
        };
      }
    } catch (apiError: any) {
      if (
        apiError &&
        typeof apiError.message === "string" &&
        (apiError.message.includes("Domain-Wide Delegation") || apiError.message.includes("attendees"))
      ) {
        console.warn("[Calendar] Reintentando sincronización de evento sin invitar participantes debido a políticas de Google Cloud.");
        
        resource.attendees = undefined;
        
        if (lead.calendarEventId) {
          response = await calendar.events.update({
            calendarId,
            eventId: lead.calendarEventId,
            requestBody: resource,
          });

          return {
            status: "synced",
            action: "update",
            eventId: response.data.id ?? lead.calendarEventId,
            eventUrl: response.data.htmlLink ?? lead.calendarEventUrl ?? null,
            message: "Evento actualizado correctamente (sin participantes externos por restricción de cuota).",
          };
        } else {
          response = await calendar.events.insert({
            calendarId,
            requestBody: resource,
          });

          return {
            status: "synced",
            action: "create",
            eventId: response.data.id ?? null,
            eventUrl: response.data.htmlLink ?? null,
            message: "Evento creado correctamente (sin participantes externos por restricción de cuota).",
          };
        }
      }
      throw apiError;
    }
  } catch (error) {
    console.error("[Calendar] Sync error", error);
    return {
      status: "error",
      action: "error",
      message: error instanceof Error ? error.message : "Error desconocido al sincronizar el calendario.",
    };
  }
}
