# Despliegue Manual en Vercel - Guía Rápida para el Usuario

## Objetivo
Tener tu CRM funcionando en una URL permanente (ej: `mi-crm.vercel.app`) que funcione 24/7 sin depender de nadie.

---

## Paso 1: Preparar el Proyecto

1. **Descarga el archivo ZIP** que recibiste: `maquina-de-ventas.zip`
2. **Extrae la carpeta** en tu computadora
3. **Abre una terminal** en esa carpeta

---

## Paso 2: Crear una Cuenta en Vercel (Si no la tienes)

1. Ve a https://vercel.com
2. Haz clic en "Sign Up"
3. Regístrate con tu email o GitHub
4. Verifica tu email

---

## Paso 3: Instalar Vercel CLI

En la terminal, ejecuta:

```bash
npm install -g vercel
```

Luego verifica que se instaló:

```bash
vercel --version
```

---

## Paso 4: Conectar tu Proyecto a Vercel

En la terminal, dentro de la carpeta del proyecto, ejecuta:

```bash
vercel
```

Te hará preguntas:
- **"Set up and deploy?"** → Responde: `y` (sí)
- **"Which scope should we deploy to?"** → Selecciona tu cuenta personal
- **"Link to existing project?"** → Responde: `n` (no)
- **"What's your project's name?"** → Escribe: `cotizador-crm` (o el nombre que prefieras)
- **"In which directory is your code located?"** → Responde: `.` (punto)
- **"Want to modify vercel.json?"** → Responde: `n` (no)

---

## Paso 5: Configurar las Variables de Entorno (IMPORTANTE)

Después del despliegue inicial, necesitas configurar la base de datos.

### Opción A: Base de Datos Gratuita (Recomendado para empezar)

1. Ve a https://planetscale.com
2. Crea una cuenta gratuita
3. Crea una nueva base de datos llamada `cotizador-crm`
4. Copia la URL de conexión (connection string)
5. En Vercel, ve a tu proyecto → **Settings** → **Environment Variables**
6. Añade una nueva variable:
   - **Name:** `DATABASE_URL`
   - **Value:** (Pega la URL de PlanetScale)
7. Haz clic en **Save**

### Opción B: Base de Datos de DigitalOcean (Más robusta)

1. Ve a https://www.digitalocean.com
2. Crea una cuenta
3. Crea una base de datos MySQL Managed
4. Copia la connection string
5. Añádela en Vercel como variable de entorno (igual que arriba)

---

## Paso 6: Redeploy para Aplicar los Cambios

En la terminal, ejecuta:

```bash
vercel --prod
```

Esto hará que Vercel use la nueva variable de entorno.

---

## Paso 7: ¡Listo! Accede a tu CRM

Vercel te dará una URL como: `https://cotizador-crm.vercel.app`

**Esa es tu URL permanente.** Puedes compartirla con tu equipo y acceder desde cualquier lugar.

---

## Troubleshooting

### "Error: DATABASE_URL is not set"
- Verifica que la variable de entorno esté configurada en Vercel
- Espera 1-2 minutos después de guardarla
- Haz un nuevo despliegue: `vercel --prod`

### "Cannot connect to database"
- Verifica que la URL de conexión sea correcta
- Si usas PlanetScale, asegúrate de que la base de datos esté activa
- Prueba la conexión desde tu computadora primero

### "La página no carga"
- Espera 2-3 minutos (Vercel puede tardar en compilar)
- Abre la consola de Vercel y revisa los logs
- Intenta hacer un nuevo despliegue: `vercel --prod`

---

## Configuración Adicional (Opcional)

### Conectar tu Dominio Propio

Si tienes un dominio (ej: `crm.tuempresa.com`):

1. En Vercel, ve a tu proyecto → **Settings** → **Domains**
2. Añade tu dominio
3. Vercel te dará instrucciones para apuntar los DNS
4. Sigue las instrucciones en tu proveedor de dominios

### Configurar Telegram (Para alertas)

1. Crea un bot en Telegram (@BotFather)
2. Copia el token
3. En Vercel, añade una variable de entorno:
   - **Name:** `TELEGRAM_BOT_TOKEN`
   - **Value:** (Tu token)

---

## Resumen

Con estos pasos tendrás:
✅ Un CRM funcionando 24/7 en la nube
✅ Una URL permanente que no caduca
✅ Base de datos real donde se guardan todos los cambios
✅ Acceso desde cualquier dispositivo

**Tiempo total:** 15-20 minutos

¿Necesitas ayuda en algún paso? Contacta al equipo técnico.
