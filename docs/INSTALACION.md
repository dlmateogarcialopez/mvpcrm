# Guía de Instalación — Máquina de Ventas

> **Versión:** 2.0 (Dockerizada)

---

## Requisitos Previos

### Opción A: Instalación con Docker (Recomendada)
- [Docker Desktop](https://docs.docker.com/get-docker/) (v24+)
- Docker Compose v2 (incluido en Docker Desktop)
- Git

### Opción B: Instalación Local (Desarrollo)
- [Node.js](https://nodejs.org/) v20 LTS
- [pnpm](https://pnpm.io/) v10+
- [MySQL](https://dev.mysql.com/downloads/) 8.0
- Git

---

## Opción A: Instalación con Docker 🐳

Esta es la forma más rápida de tener el sistema completo funcionando.

### Paso 1: Clonar el repositorio
```bash
git clone <url-del-repositorio>
cd MVP
```

### Paso 2: Configurar variables de entorno
```bash
cp .env.example .env
```

Edita el archivo `.env` con tus credenciales. Las variables **obligatorias** son:

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `DB_NAME` | Nombre de la base de datos | `maquina_ventas` |
| `DB_USER` | Usuario de MySQL | `mv_user` |
| `DB_PASSWORD` | Contraseña del usuario | `mi_password_seguro` |
| `DB_ROOT_PASSWORD` | Contraseña root de MySQL | `root_seguro` |

Las variables **opcionales** (integraciones externas):

| Variable | Descripción |
|----------|-------------|
| `TELEGRAM_BOT_TOKEN` | Token del bot de Telegram para alertas |
| `TELEGRAM_CHAT_ID` | ID del chat/grupo de Telegram |
| `RESEND_API_KEY` | API Key de Resend (emails) |
| `GOOGLE_CLIENT_ID` | Client ID de OAuth (Google Calendar) |
| `GOOGLE_CLIENT_SECRET` | Client Secret de OAuth |

### Paso 3: Levantar los servicios
```bash
docker compose up --build
```

Esto levantará **3 contenedores**:
- `mv-app` → http://localhost:3000
- `mv-database` → localhost:3307 (mapeado a MySQL 3306)

### Paso 4: Aplicar el esquema de base de datos
En una terminal separada, ejecuta:
```bash
docker compose exec backend npx drizzle-kit generate
docker compose exec backend npx drizzle-kit migrate
```

### Paso 5: Acceder a la aplicación
Abre tu navegador en: **http://localhost:3000**

---

## Opción B: Instalación Local (Sin Docker)

### Paso 1: Clonar e instalar dependencias
```bash
git clone <url-del-repositorio>
cd MVP
pnpm install
```

### Paso 2: Configurar la base de datos MySQL
Accede a MySQL y crea la base de datos:
```sql
CREATE DATABASE maquina_ventas CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'mv_user'@'localhost' IDENTIFIED BY 'tu_password';
GRANT ALL PRIVILEGES ON maquina_ventas.* TO 'mv_user'@'localhost';
FLUSH PRIVILEGES;
```

### Paso 3: Configurar variables de entorno
```bash
cp .env.example .env
```

Actualiza `DATABASE_URL` con tus credenciales locales:
```env
DATABASE_URL=mysql://mv_user:tu_password@localhost:3306/maquina_ventas
```

### Paso 4: Aplicar migraciones
```bash
pnpm db:push
```

### Paso 5: Iniciar el servidor de desarrollo
```bash
pnpm dev
```

La aplicación estará disponible en: **http://localhost:5173** (Vite dev server con HMR)

---

## Verificación de la Instalación

### ✅ Checklist

| Verificación | Comando | Resultado Esperado |
|-------------|---------|-------------------|
| TypeScript compila | `pnpm check` | Sin errores |
| Tests pasan | `pnpm test` | All tests pass |
| Frontend accesible | Abrir http://localhost:3000 | Pantalla de login |
| Backend responde | `curl http://localhost/api/trpc` | Respuesta JSON |
| DB conectada | Crear una oportunidad | Se guarda correctamente |

### 🔍 Troubleshooting

**"Error: DATABASE_URL is not set"**
- Verifica que el archivo `.env` existe y tiene `DATABASE_URL` configurado.
- En Docker, verifica que `DB_USER` y `DB_PASSWORD` coinciden en el compose.

**"Cannot connect to database"**
- Docker: Espera ~15 segundos para que MySQL termine de inicializar (healthcheck).
- Local: Verifica que el servicio MySQL está corriendo (`mysqladmin ping`).

**"Module not found"**
- Ejecuta `pnpm install` para asegurar que todas las dependencias están instaladas.

**"Port 80 already in use"**
- Cambia `APP_PORT` en tu `.env`: `APP_PORT=8080`.
- Accede en http://localhost:8080.
