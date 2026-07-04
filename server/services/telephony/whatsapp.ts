import { ENV } from "../_core/env";

const META_API_VERSION = "v25.0";

export interface WhatsAppTemplateVar {
  [key: string]: string;
}

export async function sendWhatsAppTemplate(
  templateName: string,
  toPhone: string,
  language: string = "es",
  variables?: WhatsAppTemplateVar
) {
  const token = process.env.META_WHATSAPP_TOKEN || "";
  const phoneId = process.env.META_WHATSAPP_PHONE_ID || "";

  if (!token || !phoneId) {
    throw new Error(
      "META_WHATSAPP_TOKEN y META_WHATSAPP_PHONE_ID deben estar configuradas para enviar WhatsApp."
    );
  }

  // Limpiar número: quitar +, espacios, guiones
  const cleanPhone = toPhone.replace(/[\s\-\+]/g, "");

  const body: any = {
    messaging_product: "whatsapp",
    to: cleanPhone,
    type: "template",
    template: {
      name: templateName,
      language: { code: language },
    },
  };

  if (variables && Object.keys(variables).length > 0) {
    body.template.components = [
      {
        type: "body",
        parameters: Object.entries(variables).map(([_, value]) => ({
          type: "text",
          text: value,
        })),
      },
    ];
  }

  const url = `https://graph.facebook.com/${META_API_VERSION}/${phoneId}/messages`;

  console.log(`[WhatsApp] Enviando template "${templateName}" a ${cleanPhone}...`);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const result = await response.json();

  if (!response.ok) {
    const error = (result as any)?.error?.message || "Error desconocido";
    console.error(`[WhatsApp] Error al enviar: ${error}`);
    throw new Error(`WhatsApp API error: ${error}`);
  }

  console.log(`[WhatsApp] Template enviado con éxito: ${(result as any)?.messages?.[0]?.id}`);

  return {
    messageId: (result as any)?.messages?.[0]?.id as string,
    status: "sent",
  };
}

export async function listWhatsAppTemplates() {
  const token = process.env.META_WHATSAPP_TOKEN || "";
  const wabaId = process.env.META_WHATSAPP_WABA_ID || "";

  if (!token || !wabaId) {
    return [];
  }

  const url = `https://graph.facebook.com/${META_API_VERSION}/${wabaId}/message_templates`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    console.warn("[WhatsApp] No se pudieron listar templates:", response.status);
    return [];
  }

  const result = await response.json();
  return ((result as any)?.data || []).map((t: any) => ({
    name: t.name,
    language: t.language,
    status: t.status,
    category: t.category,
  }));
}

export async function sendWhatsAppDirect(
  toPhone: string,
  message: string
): Promise<{ messageId: string }> {
  const token = process.env.META_WHATSAPP_TOKEN || "";
  const phoneId = process.env.META_WHATSAPP_PHONE_ID || "";

  if (!token || !phoneId) {
    throw new Error("Faltan META_WHATSAPP_TOKEN o META_WHATSAPP_PHONE_ID");
  }

  const cleanPhone = toPhone.replace(/[\s\-\+]/g, "");
  const url = `https://graph.facebook.com/${META_API_VERSION}/${phoneId}/messages`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: cleanPhone,
      type: "text",
      text: { body: message },
    }),
  });

  const data = (await response.json()) as any;

  if (!response.ok) {
    const err = data?.error;
    console.warn(
      `[WhatsApp Direct] Error (${err?.code}): ${err?.message || "unknown"}`
    );
    throw new Error(`WhatsApp API error (${err?.code}): ${err?.message || "unknown"}`);
  }

  const messageId = data.messages?.[0]?.id;
  console.log(
    `[WhatsApp Direct] OK a ${cleanPhone}: ${messageId} | response: ${JSON.stringify(data).substring(0, 200)}`
  );
  return { messageId };
}
