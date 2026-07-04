export const ENV = {
  appId: process.env.VITE_APP_ID || "maquina-ventas",
  cookieSecret:
    process.env.JWT_SECRET || "maquina-de-ventas-fallback-secret-key-2026",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  // Twilio (VoIP + SMS)
  twilioAccountSid: process.env.TWILIO_ACCOUNT_SID ?? "",
  twilioAuthToken: process.env.TWILIO_AUTH_TOKEN ?? "",
  twilioApiKey: process.env.TWILIO_API_KEY ?? "",
  twilioApiSecret: process.env.TWILIO_API_SECRET ?? "",
  twilioTwimlAppSid: process.env.TWILIO_TWIML_APP_SID ?? "",
  twilioPhoneNumber: process.env.TWILIO_PHONE_NUMBER ?? "",
  advisorPhoneNumber: process.env.ADVISOR_PHONE_NUMBER ?? "",
  voipRecordingsDir:
    process.env.VOIP_RECORDINGS_DIR || "/var/lib/voip/recordings",
  // Zona horaria por defecto para formateo de fechas (IANA timezone identifier).
  // Si está vacía, los servicios de alertas usan "America/Bogota" como fallback.
  orgTimezone: process.env.ORG_TIMEZONE ?? "",
};
