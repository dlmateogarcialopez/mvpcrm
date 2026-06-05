# Guía de Configuración e Integración de Google Calendar

Este documento detalla la arquitectura, configuración, solución de problemas y buenas prácticas implementadas para la sincronización automática de visitas comerciales entre el CRM ("Máquina de Ventas") y **Google Calendar**.

---

## 1. Arquitectura de la Integración

A diferencia del flujo clásico de OAuth2 (donde cada usuario inicia sesión individualmente con su cuenta de Google), este sistema utiliza una **Cuenta de Servicio (Service Account)**. 
*   **¿Qué es?** Es una cuenta especial de Google administrada por el servidor (un "bot") que realiza operaciones en segundo plano de manera autónoma.
*   **Beneficio:** Evita que los agentes tengan que iniciar sesión y conceder permisos constantemente. La sincronización se ejecuta de forma transparente en la base de datos cada vez que un lead se crea o actualiza.

---

## 2. Variables de Entorno del Sistema (`.env`)

Para que el servidor web pueda autenticarse con la API de Google Cloud, debes configurar las siguientes variables en el archivo `.env` tanto local como en producción (VPS):

| Variable | Descripción | Ejemplo / Formato |
| :--- | :--- | :--- |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Correo electrónico de la cuenta de servicio generada en GCP. | `crm-calendar-bot@celtic-parser-498503-v8.iam.gserviceaccount.com` |
| `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | Clave privada RSA en formato string con comillas dobles y saltos de línea (`\n`). | `"-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQ...-----END PRIVATE KEY-----\n"` |

> [!CAUTION]
> **Seguridad de las Claves:** La clave privada del `.env` contiene accesos críticos. Asegúrate de que los archivos de credenciales `.json` descargados **nunca se suban a GitHub**. Hemos actualizado el archivo `.gitignore` del proyecto para prevenir la subida de estos archivos accidentales de forma automática.

---

## 3. Configuración en Google Cloud Platform (GCP)

Sigue estos pasos detallados para configurar tu proyecto en la consola de Google Cloud:

### Paso A: Habilitar la API
1. Entra a [Google Cloud Console](https://console.cloud.google.com/).
2. Selecciona tu proyecto en la barra superior.
3. Habilita la **Google Calendar API** visitando el siguiente enlace directo:  
   👉 [Activar Google Calendar API](https://console.developers.google.com/apis/api/calendar-json.googleapis.com/overview)

### Paso B: Desactivar la restricción de creación de claves (Si aplica)
Si al intentar crear una clave para la cuenta de servicio obtienes el error *"Service account key creation is disabled"*, tu cuenta de Google tiene activado un bloqueo de seguridad heredado. Para quitarlo:
1. Ve a **IAM y administración** > **Políticas de la organización** (Organization Policies).
2. Busca la regla `iam.disableServiceAccountKeyCreation` (*Desactivar la creación de claves de cuentas de servicio*).
3. Haz clic en **Editar política** (Edit Policy).
4. Selecciona **Anular política primaria** (Override parent's policy) y cambia la directiva a **Desactivado** (Off).
5. Haz clic en **Establecer política** (Set policy).

### Paso C: Crear la cuenta de servicio y obtener la clave JSON
1. En el menú de GCP, ve a **IAM y administración** > **Cuentas de servicio**.
2. Haz clic en **+ Crear cuenta de servicio** y completa el nombre.
3. Entra en los detalles de la cuenta creada, ve a la pestaña **Claves** (Keys).
4. Selecciona **Agregar clave** > **Crear clave nueva** en formato **JSON**.
5. Descarga el archivo `.json` resultante y extrae los campos `client_email` y `private_key` para colocarlos en tu archivo `.env`.

---

## 4. Configuración en Google Calendar (Web)

Debes conceder permisos de acceso al bot sobre el calendario donde quieres que se registren los eventos:

1. Abre tu [Google Calendar](https://calendar.google.com/).
2. En la lista de la izquierda (*Mis calendarios*), pasa el cursor sobre tu calendario, haz clic en los **tres puntos verticales** y entra a **Configuración y uso compartido**.
3. Baja hasta **Compartir con personas específicas o grupos** y haz clic en **Agregar personas**.
4. Pega el correo de la cuenta de servicio (`GOOGLE_SERVICE_ACCOUNT_EMAIL`).
5. **Permiso crítico:** En la lista de permisos, selecciona **"Realizar cambios en eventos"** (Make changes to events).
6. Haz clic en **Enviar**.

---

## 5. Activación en el CRM (Plataforma Web)

Una vez configurado el servidor y compartido el calendario:
1. Entra a la web del CRM en producción y navega a **Configuración** (icono de engranaje).
2. En la tarjeta de **Google Calendar**:
   * Activa el interruptor/checkbox para habilitar la sincronización.
   * En **ID del calendario**, ingresa el identificador del calendario elegido (por ejemplo, tu dirección de correo `@gmail.com` si usas tu calendario principal).
3. Haz clic en **Guardar**.

---

## 6. Resolución de Problemas y Reglas del API (Gotchas)

Durante la implementación, incorporamos control de errores avanzado para gestionar las limitaciones técnicas de las APIs de Google:

### ❌ Error 404: Not Found
*   **Causa:** La cuenta de servicio no tiene permiso para interactuar con el ID del calendario provisto.
*   **Solución:** Google oculta los calendarios a los que no se tiene acceso devolviendo un error 404. Asegúrate de haber completado el **Paso 4** (Compartir el calendario con permisos de edición).

### ❌ Error 403: Service accounts cannot invite attendees without Domain-Wide Delegation
*   **Causa:** Las cuentas gratuitas de `@gmail.com` no disponen de "Delegación de Autoridad de Dominio". Por tanto, Google prohíbe que las cuentas de servicio envíen invitaciones de correo a participantes externos (los leads).
*   **Solución (Implementada):** El código en [**calendar.ts**](file:///e:/programacion/MVP/server/services/calendar.ts) gestiona esto de forma automática. Si Google responde con este error, el CRM **reintenta automáticamente registrar el evento omitiendo los destinatarios**, garantizando que la visita aparezca en tu agenda. El correo y detalles del cliente se guardan de forma segura en la descripción del evento.

### ❌ Error 429: Resource has been exhausted (Check quota)
*   **Causa:** Se ha superado el límite de velocidad por segundo de la API de Google (máximo 5 peticiones/segundo).
*   **Solución:** Este bloqueo es temporal. Espera de 1 a 2 minutos para que el límite se libere. Al hacer importaciones masivas de Excel, se recomienda desactivar la casilla de Google Calendar en Configuración antes de iniciar el proceso.
