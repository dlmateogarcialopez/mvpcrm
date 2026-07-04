import { getOrganizationSettings } from "../db";

/**
 * Configuración de integraciones de una organización.
 * Cada org puede tener su propio:
 *  - Bot de Telegram (botToken + chatId)
 *  - Email provider (Resend API key + from address, o SMTP
 *    host/port/user/pass)
 *  - Google Calendar ID
 *  - SMS (Twilio: account SID + auth token + from number)
 *  - Cada canal puede estar enabled/disabled independientemente.
 *
 * Si la org no tiene fila en organization_settings o el
 * campo integrations está vacío, se devuelven defaults con
 * `enabled: false`. Los callers deben consultar `envFallback`
 * para usar variables de entorno cuando la org no tiene
 * config propia.
 */
export type OrgIntegrations = {
  googleCalendar: {
    enabled: boolean;
    calendarId: string | null;
  };
  email: {
    enabled: boolean;
    /** Provider preferido: "resend" o "smtp" */
    provider: "resend" | "smtp" | null;
    resendApiKey: string | null;
    from: string | null;
    fromName: string | null;
    smtp: {
      host: string | null;
      port: number | null;
      user: string | null;
      pass: string | null;
    };
    /** Destinatario de alertas operativas (si difiere del from) */
    alertTo: string | null;
  };
  telegram: {
    enabled: boolean;
    botToken: string | null;
    chatId: string | null;
  };
  sms: {
    enabled: boolean;
    twilioAccountSid: string | null;
    twilioAuthToken: string | null;
    twilioFromNumber: string | null;
    /** Destinatario de alertas SMS */
    alertTo: string | null;
  };
};

export const EMPTY_INTEGRATIONS: OrgIntegrations = {
  googleCalendar: { enabled: false, calendarId: null },
  email: {
    enabled: false,
    provider: null,
    resendApiKey: null,
    from: null,
    fromName: null,
    smtp: { host: null, port: null, user: null, pass: null },
    alertTo: null,
  },
  telegram: { enabled: false, botToken: null, chatId: null },
  sms: {
    enabled: false,
    twilioAccountSid: null,
    twilioAuthToken: null,
    twilioFromNumber: null,
    alertTo: null,
  },
};

/**
 * Lee la config de integraciones de una organización desde
 * organization_settings.integrations (JSON).
 *
 * Si la fila no existe, devuelve EMPTY_INTEGRATIONS (todos
 * los canales disabled). NO hace fallback a env vars; el
 * caller decide si usar env vars como fallback explícitamente.
 */
export async function getOrgIntegrations(
  organizationId: number
): Promise<OrgIntegrations> {
  const settings = await getOrganizationSettings(organizationId);
  if (!settings?.integrations) return EMPTY_INTEGRATIONS;
  return parseIntegrations(settings.integrations);
}

function parseIntegrations(raw: string | null | undefined): OrgIntegrations {
  if (!raw) return EMPTY_INTEGRATIONS;
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return EMPTY_INTEGRATIONS;
  }
  if (!parsed || typeof parsed !== "object") return EMPTY_INTEGRATIONS;

  const calendar = parsed.googleCalendar ?? {};
  const email = parsed.email ?? {};
  const smtp = email.smtp ?? {};
  const telegram = parsed.telegram ?? {};
  const sms = parsed.sms ?? {};

  return {
    googleCalendar: {
      enabled: Boolean(calendar.enabled),
      calendarId:
        typeof calendar.calendarId === "string" && calendar.calendarId
          ? calendar.calendarId
          : null,
    },
    email: {
      enabled: Boolean(email.enabled),
      provider:
        email.provider === "resend" || email.provider === "smtp"
          ? email.provider
          : null,
      resendApiKey:
        typeof email.resendApiKey === "string" && email.resendApiKey
          ? email.resendApiKey
          : null,
      from:
        typeof email.from === "string" && email.from ? email.from : null,
      fromName:
        typeof email.fromName === "string" && email.fromName
          ? email.fromName
          : null,
      smtp: {
        host:
          typeof smtp.host === "string" && smtp.host ? smtp.host : null,
        port:
          typeof smtp.port === "number" && Number.isFinite(smtp.port)
            ? smtp.port
            : null,
        user:
          typeof smtp.user === "string" && smtp.user ? smtp.user : null,
        pass:
          typeof smtp.pass === "string" && smtp.pass ? smtp.pass : null,
      },
      alertTo:
        typeof email.alertTo === "string" && email.alertTo
          ? email.alertTo
          : null,
    },
    telegram: {
      enabled: Boolean(telegram.enabled),
      botToken:
        typeof telegram.botToken === "string" && telegram.botToken
          ? telegram.botToken
          : null,
      chatId:
        typeof telegram.chatId === "string" && telegram.chatId
          ? telegram.chatId
          : null,
    },
    sms: {
      enabled: Boolean(sms.enabled),
      twilioAccountSid:
        typeof sms.twilioAccountSid === "string" && sms.twilioAccountSid
          ? sms.twilioAccountSid
          : null,
      twilioAuthToken:
        typeof sms.twilioAuthToken === "string" && sms.twilioAuthToken
          ? sms.twilioAuthToken
          : null,
      twilioFromNumber:
        typeof sms.twilioFromNumber === "string" && sms.twilioFromNumber
          ? sms.twilioFromNumber
          : null,
      alertTo:
        typeof sms.alertTo === "string" && sms.alertTo ? sms.alertTo : null,
    },
  };
}

/**
 * Resuelve la config de Telegram para una org con fallback
 * a env vars (caso de la org default con valores heredados).
 */
export function resolveTelegramConfig(
  orgIntegrations: OrgIntegrations
): { botToken: string; chatId: string; enabled: boolean } {
  return {
    botToken:
      orgIntegrations.telegram.botToken ??
      process.env.TELEGRAM_BOT_TOKEN ??
      "",
    chatId:
      orgIntegrations.telegram.chatId ??
      process.env.TELEGRAM_CHAT_ID ??
      "",
    enabled:
      orgIntegrations.telegram.enabled ||
      Boolean(
        (orgIntegrations.telegram.botToken ?? process.env.TELEGRAM_BOT_TOKEN) &&
          (orgIntegrations.telegram.chatId ?? process.env.TELEGRAM_CHAT_ID)
      ),
  };
}

/**
 * Resuelve la config de Email para una org con fallback a
 * env vars. Devuelve el `from` final a usar (resuelve
 * fromName <email> si está seteado).
 */
export function resolveEmailConfig(orgIntegrations: OrgIntegrations): {
  from: string;
  resendApiKey: string | null;
  smtp: {
    host: string;
    port: number;
    user: string;
    pass: string;
  } | null;
  enabled: boolean;
  provider: "resend" | "smtp";
} {
  const fallbackFrom =
    process.env.EMAIL_FROM || process.env.SMTP_USER || "onboarding@resend.dev";
  const from = orgIntegrations.email.from || fallbackFrom;
  const fromName = orgIntegrations.email.fromName;
  const finalFrom = fromName ? `"${fromName}" <${from}>` : from;

  const provider: "resend" | "smtp" =
    orgIntegrations.email.provider ??
    (process.env.EMAIL_PROVIDER === "smtp" ? "smtp" : "resend");

  return {
    from: finalFrom,
    resendApiKey:
      orgIntegrations.email.resendApiKey ??
      process.env.RESEND_API_KEY ??
      null,
    smtp: provider === "smtp"
      ? {
          host:
            orgIntegrations.email.smtp.host ??
            process.env.SMTP_HOST ??
            "smtp.gmail.com",
          port:
            orgIntegrations.email.smtp.port ??
            parseInt(process.env.SMTP_PORT ?? "465", 10),
          user:
            orgIntegrations.email.smtp.user ??
            process.env.SMTP_USER ??
            "",
          pass:
            orgIntegrations.email.smtp.pass ??
            process.env.SMTP_PASS ??
            "",
        }
      : null,
    enabled:
      orgIntegrations.email.enabled ||
      Boolean(orgIntegrations.email.resendApiKey ?? process.env.RESEND_API_KEY),
    provider,
  };
}

/**
 * Resuelve la config de Google Calendar para una org.
 * El service account (clientEmail + privateKey) es GLOBAL
 * (no se replica por org); solo el calendarId es per-org.
 */
export function resolveCalendarConfig(orgIntegrations: OrgIntegrations): {
  enabled: boolean;
  calendarId: string | null;
  hasServiceAccount: boolean;
} {
  const hasServiceAccount = Boolean(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
      process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
  );
  return {
    enabled:
      orgIntegrations.googleCalendar.enabled && hasServiceAccount,
    calendarId: orgIntegrations.googleCalendar.calendarId,
    hasServiceAccount,
  };
}
