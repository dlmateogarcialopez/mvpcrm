import type { AppSettingsInput } from "../../../shared/leadSchemas";

export type SettingsImpactCard = {
  title: string;
  description: string;
};

export function getSettingsFieldLocks(form: Pick<AppSettingsInput, "calendarSyncEnabled" | "emailAlertsEnabled" | "smsAlertsEnabled">) {
  return {
    calendarFieldLocked: !form.calendarSyncEnabled,
    emailFieldLocked: !form.emailAlertsEnabled,
    smsFieldLocked: !form.smsAlertsEnabled,
  };
}

export function getSettingsImpactCards(pendingChanges: string[]): SettingsImpactCard[] {
  if (pendingChanges.length === 0) return [];

  const cards: SettingsImpactCard[] = [];

  if (pendingChanges.some(change => ["Meta mensual", "Comisión"].some(keyword => change.toLowerCase().includes(keyword.toLowerCase())))) {
    cards.push({
      title: "Impacto en ingresos y comisión",
      description:
        "Este guardado cambia la lectura de meta, comisión o ambas. El resumen comercial y las conversaciones de cierre se verán afectadas desde la siguiente actualización.",
    });
  }

  if (pendingChanges.some(change => ["Puntaje", "urgencia"].some(keyword => change.toLowerCase().includes(keyword.toLowerCase())))) {
    cards.push({
      title: "Impacto en prioridades del embudo",
      description:
        "Las reglas de puntaje y urgencia se recalculan sobre nuevas y futuras oportunidades, por lo que pueden cambiar el orden de seguimiento visible para el equipo.",
    });
  }

  if (pendingChanges.some(change => ["sincronización", "calendario"].some(keyword => change.toLowerCase().includes(keyword.toLowerCase())))) {
    cards.push({
      title: "Impacto en agenda comercial",
      description:
        "Si activas la sincronización, el equipo dependerá de un ID de calendario válido para reflejar visitas y seguimiento sin fricción operativa.",
    });
  }

  if (pendingChanges.some(change => ["alertas", "correo", "sms"].some(keyword => change.toLowerCase().includes(keyword.toLowerCase())))) {
    cards.push({
      title: "Impacto en alertas y seguimiento",
      description:
        "Las alertas opcionales pueden cambiar quién recibe avisos y qué canal acompaña la operación diaria cuando haya vencimientos o prioridades altas.",
    });
  }

  return cards;
}
