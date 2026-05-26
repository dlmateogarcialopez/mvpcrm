# Guía de Webhooks y Alertas por Telegram — Máquina de Ventas

Esta guía explica cómo configurar la recepción de oportunidades desde Facebook/Instagram/ManyChat y las alertas automáticas por Telegram.

---

## 1. Configuración de Telegram para Alertas

### Paso 1: Crear un Bot de Telegram
1. Abre Telegram y busca a **@BotFather**.
2. Envía el comando `/newbot`.
3. Sigue las instrucciones y obtén tu **Token de Bot** (algo como `123456789:ABCDefGhIjKlMnOpQrStUvWxYz`).

### Paso 2: Obtener el ID del Chat/Grupo
1. Crea un grupo en Telegram o usa uno existente.
2. Añade el bot al grupo.
3. Envía un mensaje de prueba en el grupo.
4. Abre en tu navegador: `https://api.telegram.org/bot<TU_TOKEN>/getUpdates`
5. Busca el campo `"chat":{"id":` — ese número es tu **CHAT_ID**.

### Paso 3: Configurar Variables de Entorno
En tu archivo `.env`, añade:
```env
TELEGRAM_BOT_TOKEN=123456789:ABCDefGhIjKlMnOpQrStUvWxYz
TELEGRAM_CHAT_ID=-1001234567890
```

---

## 2. Recepción de Oportunidades desde Facebook/Instagram

El CRM tiene un **Webhook** listo para recibir oportunidades desde cualquier fuente externa.

### Endpoint del Webhook:
```
POST /api/webhooks/leads
```

### Formato del Payload Esperado:
```json
{
  "source": "facebook",
  "customerName": "Juan García",
  "customerEmail": "juan@example.com",
  "customerPhone": "3001234567",
  "companyName": "Empresa XYZ",
  "city": "Bogotá",
  "message": "Estoy interesado en vuestros servicios",
  "estimatedValue": 2500000,
  "assignedAgent": "Carlos López",
  "assignedAgentId": 2
}
```

### Integración con ManyChat:
1. En ManyChat, crea una acción de **Webhook**.
2. Configura la URL: `https://tu-dominio.com/api/webhooks/leads`
3. Selecciona el método **POST**.
4. Mapea los campos de ManyChat al formato esperado.

### Integración con Zapier:
1. Crea un Zap que dispare cuando recibas una oportunidad en Facebook.
2. Usa la acción **Webhook** de Zapier.
3. Configura la URL y el payload como se muestra arriba.

---

## 3. Webhook para Cambios de Estado

Si quieres que cambios de estado en herramientas externas se reflejen en el CRM:

### Endpoint:
```
POST /api/webhooks/leads/status
```

### Payload:
```json
{
  "leadId": "LEAD-ABC12345",
  "newStatus": "rojo",
  "agentName": "Ana Martínez"
}
```

---

## 4. Prueba Local (Desarrollo)

Para probar los webhooks en tu máquina local sin exponerla a internet, usa **ngrok**:

```bash
# Instala ngrok desde https://ngrok.com/
ngrok http 3000

# Verás una URL como: https://abc123.ngrok.io
# Usa esa URL en tus webhooks de prueba
```

---

## 5. Monitoreo de Alertas

Una vez configurado, cada vez que:
- Ingrese una nueva oportunidad → Recibirás un mensaje en Telegram.
- Una oportunidad pase a "Urgente" → Alerta roja en Telegram.
- Se cierre una oportunidad → Notificación de éxito en Telegram.

---
**Nota:** Las alertas de Telegram son instantáneas y no tienen costo. Úsalas para mantener a tu equipo sincronizado en tiempo real.
