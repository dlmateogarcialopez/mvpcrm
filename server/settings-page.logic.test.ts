import { describe, expect, it } from "vitest";
import { getSettingsFieldLocks, getSettingsImpactCards } from "../client/src/lib/settings-page.logic";

describe("settings page logic", () => {
  it("bloquea o habilita campos sensibles según cada activación", () => {
    expect(
      getSettingsFieldLocks({
        calendarSyncEnabled: false,
        emailAlertsEnabled: false,
        smsAlertsEnabled: false,
      }),
    ).toEqual({
      calendarFieldLocked: true,
      emailFieldLocked: true,
      smsFieldLocked: true,
    });

    expect(
      getSettingsFieldLocks({
        calendarSyncEnabled: true,
        emailAlertsEnabled: true,
        smsAlertsEnabled: true,
      }),
    ).toEqual({
      calendarFieldLocked: false,
      emailFieldLocked: false,
      smsFieldLocked: false,
    });
  });

  it("resume el impacto operativo por tipo de cambio sensible", () => {
    const cards = getSettingsImpactCards([
      "Meta mensual actualizada",
      "Comisión comercial actualizada",
      "Regla de urgencia de visita modificada",
      "Cambio en la sincronización con Google Calendar",
      "Cambio en alertas por correo",
      "Cambio en alertas SMS",
    ]);

    expect(cards.map(card => card.title)).toEqual([
      "Impacto en ingresos y comisión",
      "Impacto en prioridades del embudo",
      "Impacto en agenda comercial",
      "Impacto en alertas y seguimiento",
    ]);
  });

  it("no genera tarjetas cuando no hay cambios pendientes", () => {
    expect(getSettingsImpactCards([])).toEqual([]);
  });
});
