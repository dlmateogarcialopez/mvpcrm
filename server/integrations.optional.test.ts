import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppSettings, Lead } from "../drizzle/schema";

const {
  updateMock,
  insertMock,
  notifyOwnerMock,
  resendSendMock,
  jwtMock,
} = vi.hoisted(() => ({
  updateMock: vi.fn(),
  insertMock: vi.fn(),
  notifyOwnerMock: vi.fn(),
  resendSendMock: vi.fn(),
  jwtMock: vi.fn(),
}));

vi.mock("googleapis", () => ({
  google: {
    auth: {
      JWT: jwtMock,
    },
    calendar: vi.fn(() => ({
      events: {
        update: updateMock,
        insert: insertMock,
      },
    })),
  },
}));

vi.mock("../server/_core/notification", () => ({
  notifyOwner: notifyOwnerMock,
}));

vi.mock("resend", () => ({
  Resend: vi.fn(() => ({
    emails: {
      send: resendSendMock,
    },
  })),
}));

import { sendLeadOperationalAlert } from "./services/alerts";
import { syncLeadCalendarEvent } from "./services/calendar";

function createSettings(overrides: Partial<AppSettings> = {}): AppSettings {
  const now = new Date("2026-04-10T15:00:00.000Z");

  return {
    id: 1,
    pricingVersion: "v1",
    precioMultipleBase: 99000,
    precioJuniorBase: 69000,
    precioSeniorBase: 69000,
    precioParqueaderoBase: 8000,
    recargoUrgenciaPct: 0,
    recargoFinDeSemanaPct: 0,
    thresholdPrioridadRojaPersonas: 200,
    thresholdPrioridadRojaValor: 15000000,
    thresholdPrioridadAmarillaPersonas: 80,
    thresholdPrioridadAmarillaValor: 5000000,
    horasMaxSinGestion: 24,
    horasAlertaVisitaProxima: 48,
    calendarSyncEnabled: false,
    googleCalendarId: null,
    emailAlertsEnabled: false,
    alertEmailTo: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function createLead(overrides: Partial<Lead> = {}): Lead {
  const now = new Date("2026-04-10T15:00:00.000Z").getTime();

  return {
    id: 1,
    publicId: "LD-0001",
    nombreCliente: "Clínica Central",
    telefono: "3001234567",
    correo: "operaciones@clinicacentral.com",
    fechaIngresoLead: now,
    fechaVisita: new Date("2026-04-15T15:00:00.000Z").getTime(),
    fechaLimiteGestion: now + 24 * 60 * 60 * 1000,
    ultimaGestion: now,
    proximaAccion: "Confirmar visita",
    motivoVisita: "Cotización institucional",
    objecionPrincipal: "Comparación de precio",
    cantidadMultiple: 10,
    cantidadJunior: 2,
    cantidadSenior: 1,
    cantidadParqueadero: 1,
    totalPersonas: 14,
    precioMultiple: 99000,
    precioJunior: 69000,
    precioSenior: 69000,
    precioParqueadero: 8000,
    ticketPromedio: 93285,
    valorTotal: 1306000,
    estadoLead: "nuevo",
    canalOrigen: "referido",
    prioridad: "amarillo",
    prioridadBase: "verde",
    prioridadScore: 72,
    prioridadExplicacion: "Visita próxima y ticket atractivo.",
    reglasAplicadas: JSON.stringify(["Visita próxima"]),
    alertFlags: JSON.stringify({ vencido: false, sinGestion: false }),
    alertPending: true,
    calendarEventId: null,
    calendarEventUrl: null,
    calendarLastSyncedAt: null,
    calendarSyncStatus: "pending",
    calendarSyncMessage: null,
    emailAlertSentAt: null,
    emailAlertStatus: "pending",
    emailAlertMessage: null,
    agenteResponsable: "Equipo comercial",
    notasInternas: "Seguimiento prioritario.",
    createdByUserId: 1,
    updatedByUserId: 1,
    createdAt: new Date(now),
    updatedAt: new Date(now),
    ...overrides,
  };
}

describe("optional integrations", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("actualiza el evento existente y evita crear duplicados cuando el lead ya tiene calendarEventId", async () => {
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = "bot@example.com";
    process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY = "-----BEGIN KEY-----\\nabc\\n-----END KEY-----";

    updateMock.mockResolvedValueOnce({
      data: {
        id: "event-updated",
        htmlLink: "https://calendar.google.com/event?updated",
      },
    });

    const result = await syncLeadCalendarEvent(
      createLead({ calendarEventId: "existing-event-id" }),
      createSettings({ calendarSyncEnabled: true, googleCalendarId: "team@example.com" }),
    );

    expect(result.status).toBe("synced");
    expect(result.action).toBe("update");
    expect(result.eventId).toBe("event-updated");
    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("crea un evento nuevo cuando la sincronización está activa y el lead aún no tiene calendarEventId", async () => {
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = "bot@example.com";
    process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY = "-----BEGIN KEY-----\\nabc\\n-----END KEY-----";

    insertMock.mockResolvedValueOnce({
      data: {
        id: "event-created",
        htmlLink: "https://calendar.google.com/event?created",
      },
    });

    const result = await syncLeadCalendarEvent(
      createLead({ calendarEventId: null }),
      createSettings({ calendarSyncEnabled: true, googleCalendarId: "team@example.com" }),
    );

    expect(result.status).toBe("synced");
    expect(result.action).toBe("create");
    expect(result.eventId).toBe("event-created");
    expect(insertMock).toHaveBeenCalledTimes(1);
  });

  it("usa notificación interna como fallback cuando no hay credenciales de correo disponibles", async () => {
    notifyOwnerMock.mockResolvedValueOnce(true);

    const result = await sendLeadOperationalAlert(
      createLead({ alertPending: true }),
      createSettings({ emailAlertsEnabled: true, alertEmailTo: "operaciones@example.com" }),
    );

    expect(result.status).toBe("sent");
    expect(result.channel).toBe("owner_notification");
    expect(resendSendMock).not.toHaveBeenCalled();
    expect(notifyOwnerMock).toHaveBeenCalledTimes(1);
  });

  it("envía email cuando la alerta está activa y existen credenciales completas", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.ALERT_FROM_EMAIL = "alerts@example.com";
    resendSendMock.mockResolvedValueOnce({ id: "mail-1" });

    const result = await sendLeadOperationalAlert(
      createLead({ alertPending: true }),
      createSettings({ emailAlertsEnabled: true, alertEmailTo: "operaciones@example.com" }),
    );

    expect(result.status).toBe("sent");
    expect(result.channel).toBe("email");
    expect(resendSendMock).toHaveBeenCalledTimes(1);
    expect(notifyOwnerMock).not.toHaveBeenCalled();
  });
});
