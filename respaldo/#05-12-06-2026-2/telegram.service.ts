import axios from "axios";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || "";

const telegramAPI = axios.create({
  baseURL: `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`,
  timeout: 10000,
});

export interface TelegramAlertPayload {
  type: "new_lead" | "urgent_lead" | "lead_closed" | "lead_lost";
  leadName: string;
  leadValue?: number;
  agentName?: string;
  city?: string;
  details?: string;
}

/**
 * Envía una alerta por Telegram a un grupo o canal específico.
 * Requiere que TELEGRAM_BOT_TOKEN y TELEGRAM_CHAT_ID estén configurados en .env
 */
export async function sendTelegramAlert(payload: TelegramAlertPayload): Promise<void> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.warn("[Telegram] Bot token o chat ID no configurados. Alerta no enviada.");
    return;
  }

  try {
    const messages: Record<string, string> = {
      new_lead: `🆕 **Nuevo Lead Ingresado**\n\n👤 ${payload.leadName}\n💰 ${payload.leadValue ? `$${payload.leadValue.toLocaleString("es-CO")}` : "Sin valor"}\n🏙️ ${payload.city || "Sin ciudad"}\n📍 ${payload.agentName || "Sin asignar"}`,
      urgent_lead: `🔴 **URGENTE: Lead Crítico**\n\n👤 ${payload.leadName}\n💰 ${payload.leadValue ? `$${payload.leadValue.toLocaleString("es-CO")}` : "Sin valor"}\n⏰ Requiere atención inmediata\n📍 Responsable: ${payload.agentName || "Sin asignar"}`,
      lead_closed: `✅ **Lead Cerrado**\n\n👤 ${payload.leadName}\n💰 ${payload.leadValue ? `$${payload.leadValue.toLocaleString("es-CO")}` : "Sin valor"}\n🎉 Ganado por: ${payload.agentName || "Desconocido"}`,
      lead_lost: `❌ **Lead Perdido**\n\n👤 ${payload.leadName}\n💰 ${payload.leadValue ? `$${payload.leadValue.toLocaleString("es-CO")}` : "Sin valor"}\n📌 Razón: ${payload.details || "No especificada"}`,
    };

    const message = messages[payload.type] || "Alerta del CRM";

    await telegramAPI.post("/sendMessage", {
      chat_id: TELEGRAM_CHAT_ID,
      text: message,
      parse_mode: "Markdown",
    });

    console.log(`[Telegram] Alerta enviada: ${payload.type}`);
  } catch (error) {
    console.error("[Telegram] Error al enviar alerta:", error);
    // No lanzar error para no bloquear el flujo principal
  }
}

/**
 * Envía una alerta a un agente específico (si tienes su chat ID individual)
 */
export async function sendTelegramAlertToAgent(agentChatId: string, payload: TelegramAlertPayload): Promise<void> {
  if (!TELEGRAM_BOT_TOKEN) {
    console.warn("[Telegram] Bot token no configurado.");
    return;
  }

  try {
    const messages: Record<string, string> = {
      new_lead: `🆕 Nuevo lead asignado: ${payload.leadName}`,
      urgent_lead: `🔴 URGENTE: ${payload.leadName} requiere atención inmediata`,
      lead_closed: `✅ Lead cerrado: ${payload.leadName}`,
      lead_lost: `❌ Lead perdido: ${payload.leadName}`,
    };

    const message = messages[payload.type] || "Notificación del CRM";

    await telegramAPI.post("/sendMessage", {
      chat_id: agentChatId,
      text: message,
    });

    console.log(`[Telegram] Alerta enviada al agente ${agentChatId}`);
  } catch (error) {
    console.error("[Telegram] Error al enviar alerta al agente:", error);
  }
}
