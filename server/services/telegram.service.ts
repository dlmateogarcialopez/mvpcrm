import axios from "axios";
import type { Lead } from "../../drizzle/schema";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || "";

const telegramAPI = axios.create({
  baseURL: `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`,
  timeout: 10000,
});

export type TelegramAlertType =
  | "new_lead"
  | "urgent_lead"
  | "lead_closed"
  | "lead_lost";

/**
 * Contexto enriquecido para construir un mensaje de Telegram completo.
 * Todos los campos son opcionales: el helper omite los vacíos.
 */
export interface TelegramAlertContext {
  lead: Pick<
    Lead,
    | "nombreCliente"
    | "publicId"
    | "ciudad"
    | "valorTotal"
    | "estadoLead"
    | "motivoVisita"
    | "tipoEvento"
    | "canalOrigen"
    | "fechaIngresoLead"
    | "fechaVisita"
    | "fechaLimiteGestion"
    | "labels"
    | "cantidadMultiple"
    | "cantidadJunior"
    | "cantidadSenior"
    | "cantidadParqueadero"
    | "precioMultiple"
    | "precioJunior"
    | "precioSenior"
    | "precioParqueadero"
    | "motivoPerdido"
    | "agenteResponsable"
  >;
  agent?: { name?: string | null; email?: string | null } | null;
  triggeredByUserName?: string | null;
  /**
   * Etiqueta corta del trigger que disparó la alerta (ej. "Oportunidad ganada").
   * Si no se indica, se infiere del tipo de alerta.
   */
  triggerLabel?: string | null;
}

/**
 * Backwards-compat: el antiguo payload sigue siendo aceptado por sendTelegramAlert,
 * pero los callers deben migrar a la nueva firma con contexto.
 */
export interface TelegramAlertPayload {
  type: TelegramAlertType;
  leadName: string;
  leadValue?: number;
  agentName?: string;
  city?: string;
  details?: string;
}

const TELEGRAM_MAX_LENGTH = 4000; // margen bajo el límite real (4096)

/**
 * Construye el mensaje enriquecido en formato Markdown.
 * Omite líneas con valor vacío / 0 / "sin dato" para mantenerlo conciso.
 */
export function formatTelegramMessage(
  alertType: TelegramAlertType,
  ctx: TelegramAlertContext
): string {
  const { lead, agent, triggeredByUserName, triggerLabel } = ctx;

  const titleByType: Record<TelegramAlertType, string> = {
    new_lead: "🆕 Nuevo lead ingresado",
    urgent_lead: "🔴 URGENTE: lead requiere atención",
    lead_closed: "✅ Lead cerrado (ganado)",
    lead_lost: "❌ Lead perdido",
  };

  const fmtDate = (ts: number | Date | null | undefined): string => {
    if (!ts) return "Sin fecha";
    const d = typeof ts === "number" ? new Date(ts) : ts;
    if (Number.isNaN(d.getTime())) return "Sin fecha";
    return d.toLocaleString("es-CO", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const fmtMoney = (n: number | null | undefined): string => {
    if (n === null || n === undefined || Number.isNaN(n)) return "Sin valor";
    return `$${n.toLocaleString("es-CO")}`;
  };

  const safeText = (
    s: string | null | undefined,
    fallback = "Sin dato"
  ): string => {
    if (!s) return fallback;
    return s;
  };

  const parseLabels = (raw: string | null | undefined): string[] => {
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      // fallthrough
    }
    return raw
      .split(",")
      .map(s => s.trim())
      .filter(Boolean);
  };

  const lines: string[] = [];
  lines.push(`*${titleByType[alertType]}*`);
  lines.push("");
  lines.push(`👤 *${safeText(lead.nombreCliente, "Sin nombre")}*`);
  lines.push(`📌 ID: \`${safeText(lead.publicId, "?")}\``);

  const estadoLabel = safeText(lead.estadoLead, "Sin estado");
  lines.push(`🏷️ Estado: ${estadoLabel.toUpperCase()}`);

  if (lead.motivoVisita) {
    lines.push(`🎯 Motivo: ${lead.motivoVisita}`);
  }
  if (lead.tipoEvento) {
    lines.push(`📒 Tipo evento: ${lead.tipoEvento}`);
  }
  if (lead.canalOrigen) {
    lines.push(`🌐 Canal: ${lead.canalOrigen}`);
  }
  if (lead.ciudad) {
    lines.push(`📍 Ciudad: ${lead.ciudad}`);
  }

  // Etiquetas
  const labels = parseLabels(lead.labels);
  if (labels.length > 0) {
    lines.push(`🏷️ Etiquetas: ${labels.join(", ")}`);
  }

  // Fechas relevantes
  if (lead.fechaIngresoLead) {
    lines.push(`📅 Ingreso: ${fmtDate(lead.fechaIngresoLead)}`);
  }
  if (lead.fechaVisita) {
    lines.push(`📆 Visita: ${fmtDate(lead.fechaVisita)}`);
  }
  if (lead.fechaLimiteGestion) {
    lines.push(`⏰ Fecha límite: ${fmtDate(lead.fechaLimiteGestion)}`);
  }

  // Valor y desglose
  lines.push("");
  lines.push(`💰 *Valor total: ${fmtMoney(lead.valorTotal)}*`);

  const breakdown: string[] = [];
  if ((lead.cantidadMultiple ?? 0) > 0 || (lead.precioMultiple ?? 0) > 0) {
    breakdown.push(
      `   · ${lead.cantidadMultiple ?? 0} × ${fmtMoney(lead.precioMultiple)} (múltiple)`
    );
  }
  if ((lead.cantidadJunior ?? 0) > 0 || (lead.precioJunior ?? 0) > 0) {
    breakdown.push(
      `   · ${lead.cantidadJunior ?? 0} × ${fmtMoney(lead.precioJunior)} (junior)`
    );
  }
  if ((lead.cantidadSenior ?? 0) > 0 || (lead.precioSenior ?? 0) > 0) {
    breakdown.push(
      `   · ${lead.cantidadSenior ?? 0} × ${fmtMoney(lead.precioSenior)} (senior)`
    );
  }
  if (
    (lead.cantidadParqueadero ?? 0) > 0 ||
    (lead.precioParqueadero ?? 0) > 0
  ) {
    breakdown.push(
      `   · ${lead.cantidadParqueadero ?? 0} × ${fmtMoney(
        lead.precioParqueadero
      )} (parqueadero)`
    );
  }
  if (breakdown.length > 0) {
    lines.push(...breakdown);
  }

  // Detalles de pérdida (si aplica)
  if (alertType === "lead_lost" && lead.motivoPerdido) {
    lines.push("");
    lines.push(`📌 Razón: ${lead.motivoPerdido}`);
  }

  // Agente
  const agentName =
    agent?.name || (lead as any).agenteResponsable || "Sin asignar";
  const agentEmail = agent?.email;
  lines.push("");
  lines.push(`👤 Agente: ${agentName}${agentEmail ? ` (${agentEmail})` : ""}`);

  // Disparo
  if (triggeredByUserName) {
    lines.push(`⚙️ Disparado por: ${triggeredByUserName}`);
  }
  if (triggerLabel) {
    lines.push(`📨 Regla: ${triggerLabel}`);
  }

  // Timestamp del envío
  lines.push("");
  lines.push(`🕒 ${fmtDate(Date.now())}`);

  let message = lines.join("\n");
  if (message.length > TELEGRAM_MAX_LENGTH) {
    message = `${message.slice(0, TELEGRAM_MAX_LENGTH - 60)}\n\n… (mensaje truncado)`;
  }
  return message;
}

/**
 * Construye un contexto a partir del payload antiguo (back-compat).
 */
function contextFromLegacyPayload(
  payload: TelegramAlertPayload
): TelegramAlertContext {
  return {
    lead: {
      nombreCliente: payload.leadName,
      publicId: "",
      ciudad: payload.city ?? null,
      valorTotal: payload.leadValue ?? null,
      estadoLead: null,
      motivoVisita: null,
      tipoEvento: null,
      canalOrigen: null,
      fechaIngresoLead: null,
      fechaVisita: null,
      fechaLimiteGestion: null,
      labels: null,
      cantidadMultiple: null,
      cantidadJunior: null,
      cantidadSenior: null,
      cantidadParqueadero: null,
      precioMultiple: null,
      precioJunior: null,
      precioSenior: null,
      precioParqueadero: null,
      motivoPerdido: payload.details ?? null,
      agenteResponsable: payload.agentName ?? null,
    } as any,
    agent: payload.agentName ? { name: payload.agentName } : null,
  };
}

/**
 * Envía una alerta por Telegram al chat global (TELEGRAM_CHAT_ID).
 * Acepta tanto el payload antiguo como el nuevo contexto enriquecido.
 */
export async function sendTelegramAlert(
  payloadOrType: TelegramAlertPayload | TelegramAlertType,
  contextArg?: TelegramAlertContext
): Promise<void> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.warn(
      "[Telegram] Bot token o chat ID no configurados. Alerta no enviada."
    );
    return;
  }

  let alertType: TelegramAlertType;
  let ctx: TelegramAlertContext;

  // Detección de firma: si el primer arg es un string, es el nuevo formato
  if (typeof payloadOrType === "string") {
    alertType = payloadOrType;
    ctx = contextArg ?? { lead: emptyLead() };
  } else {
    alertType = payloadOrType.type;
    ctx = contextFromLegacyPayload(payloadOrType);
  }

  const message = formatTelegramMessage(alertType, ctx);

  try {
    await telegramAPI.post("/sendMessage", {
      chat_id: TELEGRAM_CHAT_ID,
      text: message,
      parse_mode: "Markdown",
    });
    console.log(`[Telegram] Alerta enviada (tipo=${alertType})`);
  } catch (error) {
    console.error("[Telegram] Error al enviar alerta:", error);
  }
}

/**
 * Envía una alerta a un agente o destinatario específico (chatId propio).
 * Acepta tanto el payload antiguo como el nuevo contexto enriquecido.
 */
export async function sendTelegramAlertToAgent(
  agentChatId: string,
  payloadOrType: TelegramAlertPayload | TelegramAlertType,
  contextArg?: TelegramAlertContext
): Promise<void> {
  if (!TELEGRAM_BOT_TOKEN) {
    console.warn("[Telegram] Bot token no configurado.");
    return;
  }
  if (!agentChatId) {
    console.warn(
      "[Telegram] sendTelegramAlertToAgent sin chatId. Alerta omitida."
    );
    return;
  }

  let alertType: TelegramAlertType;
  let ctx: TelegramAlertContext;

  if (typeof payloadOrType === "string") {
    alertType = payloadOrType;
    ctx = contextArg ?? { lead: emptyLead() };
  } else {
    alertType = payloadOrType.type;
    ctx = contextFromLegacyPayload(payloadOrType);
  }

  const message = formatTelegramMessage(alertType, ctx);

  try {
    await telegramAPI.post("/sendMessage", {
      chat_id: agentChatId,
      text: message,
      parse_mode: "Markdown",
    });
    console.log(
      `[Telegram] Alerta enviada al chat ${agentChatId} (tipo=${alertType})`
    );
  } catch (error) {
    console.error("[Telegram] Error al enviar alerta al agente:", error);
  }
}

function emptyLead(): TelegramAlertContext["lead"] {
  return {
    nombreCliente: "Sin nombre",
    publicId: "",
    ciudad: null,
    valorTotal: null,
    estadoLead: null,
    motivoVisita: null,
    tipoEvento: null,
    canalOrigen: null,
    fechaIngresoLead: null,
    fechaVisita: null,
    fechaLimiteGestion: null,
    labels: null,
    cantidadMultiple: null,
    cantidadJunior: null,
    cantidadSenior: null,
    cantidadParqueadero: null,
    precioMultiple: null,
    precioJunior: null,
    precioSenior: null,
    precioParqueadero: null,
    motivoPerdido: null,
    agenteResponsable: null,
  } as any;
}
