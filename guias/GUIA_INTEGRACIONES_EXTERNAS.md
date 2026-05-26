# Guía de Integraciones Externas — Máquina de Ventas

Este documento detalla los pasos técnicos para activar las funcionalidades de sincronización de calendario y alertas automáticas (Email/SMS).

---

## 1. Google Calendar (Sincronización de Visitas)

El sistema permite sincronizar las fechas de visita de las oportunidades con un calendario de Google.

### Requisitos en Google Cloud Console:
1. Cree un proyecto en [Google Cloud Console](https://console.cloud.google.com/).
2. Habilite la **Google Calendar API**.
3. Configure la **Pantalla de Consentimiento OAuth** (External).
4. Cree **Credenciales de ID de cliente OAuth 2.0** (Tipo: Aplicación Web).
   - **Authorized Redirect URIs:** `https://tu-dominio.com/api/oauth/callback`

### Variables de Entorno (.env):
```env
GOOGLE_CLIENT_ID=tu_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=tu_client_secret
```

---

## 2. Alertas por Email (Resend)

El sistema utiliza **Resend** por su facilidad de integración y alta entregabilidad.

### Pasos:
1. Regístrese en [Resend.com](https://resend.com/).
2. Cree una **API Key**.
3. Verifique su dominio en la plataforma de Resend para evitar que los correos caigan en SPAM.

### Variables de Entorno (.env):
```env
RESEND_API_KEY=re_tu_api_key_a1b2c3d4
EMAIL_FROM=notificaciones@tu-dominio.com
```

---

## 3. Alertas por SMS (Twilio)

Para las alertas críticas al celular del agente, se recomienda **Twilio**.

### Pasos:
1. Cree una cuenta en [Twilio.com](https://www.twilio.com/).
2. Obtenga su **Account SID** y **Auth Token**.
3. Compre o verifique un número de teléfono remitente.

### Variables de Entorno (.env):
```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890
```

---

## 4. Implementación en el Código

El desarrollador debe revisar los siguientes servicios para conectar las APIs:

- **Calendario:** `server/services/calendar.service.ts`
  - Implementa la lógica de `upsertEvent` y `deleteEvent`.
- **Alertas:** `server/services/alert.service.ts`
  - Contiene las funciones `sendEmailAlert` y `sendSmsAlert`.
- **Lógica de Disparo:** `server/routers/leads.ts`
  - Busque el procedimiento `update` o `create` donde se llaman a estos servicios tras un cambio de estado.

---

## 5. Pruebas de Integración

Para validar que las integraciones funcionan sin afectar datos reales, el proyecto incluye un archivo de test específico:
**Archivo:** `server/integrations.optional.test.ts`

Ejecute:
```bash
pnpm test server/integrations.optional.test.ts
```

---
**Nota de Seguridad:** Nunca suba el archivo `.env` al repositorio de Git. Use secretos de entorno en su plataforma de despliegue (ej. GitHub Secrets, Vercel Env Vars, o PM2 Ecosystem file).
