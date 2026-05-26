# Arquitectura del Sistema — Máquina de Ventas

> **Versión:** 2.0 (Dockerizada)

---

## 1. Visión General

La **Máquina de Ventas** es una aplicación fullstack desplegada en **2 contenedores Docker independientes**. La comunicación entre frontend y backend se realiza internamente en la aplicación unificada, exponiendo un único puerto para el usuario.

```
                           ┌─────────────────────────────────────────────┐
                           │              Docker Network                │
                           │              (mv-network)                  │
                           │                                            │
  Usuario ──▶ :3000        │        ┌──────────┐         ┌───────┐      │
  (Browser)                │        │   App    │────────▶│  DB   │      │
                           │        │ Unificada│         │ MySQL │      │
                           │        │          │         │  8.0  │      │
                           │        └──────────┘         └───────┘      │
                           │           :3000               :3306        │
                           └─────────────────────────────────────────────┘
                                                               │
                                                          :3307 (host)
```

---

## 2. Capas del Sistema

### 2.1 Aplicación Unificada (React 19 + Express + tRPC)

| Aspecto | Detalle |
|---------|---------|
| **Framework Frontend** | React 19 con TypeScript 5.9 |
| **Framework Backend** | Express 4 + Node.js 20 |
| **API Layer** | tRPC 11 (tipado end-to-end) |
| **Bundler** | Vite 7 |
| **Estilos** | TailwindCSS 4 + shadcn/ui |
| **Routing** | Wouter (SPA client-side) |
| **ORM** | Drizzle ORM |
| **Auth** | JWT via Jose + Cookie sessions |
| **Build** | esbuild (Backend) + Vite (Frontend) |

**Estructura de directorios:**
```
client/
├── src/
│   ├── App.tsx               # Router principal
│   ├── main.tsx              # Entry point
│   ├── index.css             # Estilos globales (TailwindCSS)
│   ├── components/           # Componentes reutilizables (shadcn/ui)
│   ├── pages/                # Vistas principales
│   ├── hooks/                # Custom hooks
│   ├── contexts/             # React Context providers
│   ├── lib/                  # Utilidades y helpers
│   └── _core/                # Configuración base (tRPC client)
├── public/                   # Activos estáticos
└── index.html                # HTML raíz
```

### 2.2 Backend (Express + tRPC 11)

| Aspecto | Detalle |
|---------|---------|
| **Runtime** | Node.js 20 LTS |
| **HTTP Server** | Express 4 |
| **API Layer** | tRPC 11 (tipado end-to-end) |
| **ORM** | Drizzle ORM |
| **Validación** | Zod 4 |
| **Auth** | JWT via Jose + Cookie sessions |
| **Build** | esbuild (compilación a ESM) |

**Estructura de directorios:**
```
server/
├── _core/
│   ├── index.ts              # Entry point del servidor
│   ├── context.ts            # Contexto de tRPC (auth)
│   ├── trpc.ts               # Inicialización de tRPC
│   ├── cookies.ts            # Manejo de sesiones
│   └── sdk.ts                # SDK de autenticación
├── routers/
│   ├── leads.ts              # Router de oportunidades
│   ├── settings.ts           # Router de configuración
│   └── automation.ts         # Router de automatizaciones
├── routers.ts                # Registro central de routers
├── services/
│   ├── alerts.ts             # Servicio de alertas (Email/SMS)
│   ├── calendar.ts           # Servicio de Google Calendar
│   ├── leadAutomation.ts     # Motor de automatización
│   ├── leadExport.ts         # Generador de Excel
│   └── telegram.service.ts   # Servicio de Telegram
├── webhooks/                 # Endpoints de webhooks externos
├── db.ts                     # Acceso a datos (Drizzle queries)
└── storage.ts                # Almacenamiento de archivos (S3)
```

### 2.3 Base de Datos (MySQL 8.0)

| Aspecto | Detalle |
|---------|---------|
| **Motor** | MySQL 8.0 |
| **ORM** | Drizzle ORM (schema-first) |
| **Migraciones** | Drizzle Kit (`pnpm db:push`) |
| **Persistencia** | Docker volume (`mysql_data`) |

**Esquema principal (10 tablas):**
```
users                 # Usuarios del sistema
appSettings           # Configuración global
settingsChangeLogs    # Auditoría de cambios de configuración
leads                 # Oportunidades (tabla principal)
leadActivities        # Historial de actividades por oportunidad
leadCalendarSyncs     # Sincronización con Google Calendar
pipeline_stages       # Etapas del embudo personalizables
custom_labels         # Etiquetas personalizadas
custom_channels       # Canales de captación personalizados
automation_rules      # Reglas de automatización
email_campaigns       # Campañas de email marketing
```

### 2.4 Capa Compartida (shared/)

Módulo compartido entre frontend y backend para garantizar type-safety end-to-end:

```
shared/
├── leads.ts              # Enums, constantes y lógica de negocio
├── leadSchemas.ts        # Schemas de validación (Zod)
├── const.ts              # Constantes compartidas
└── types.ts              # Tipos compartidos
```

---

## 3. Flujo de Datos

```
┌──────────┐   tRPC mutation    ┌──────────────┐   Drizzle query    ┌───────┐
│ Frontend │ ──────────────────▶│   Backend    │ ──────────────────▶│  DB   │
│ (React)  │◀────────────────── │ (tRPC Router)│◀────────────────── │(MySQL)│
└──────────┘   typed response   └──────────────┘     result set     └───────┘
                                       │
                                       │  Side effects:
                                       ├──▶ Telegram Alert
                                       ├──▶ Email (Resend)
                                       ├──▶ Calendar Sync
                                       └──▶ Automation Engine
```

**Ejemplo — Crear una oportunidad:**
1. El frontend llama a `trpc.leads.create.mutate(data)`
2. tRPC valida el input con el schema Zod (`leadCreateSchema`)
3. El router delega a `createLead()` en `db.ts`
4. Se ejecuta `runLeadAutomation()` para disparar reglas automáticas
5. Se recarga la oportunidad y se retorna al frontend tipada

---

## 4. Infraestructura Docker

### Servicios

| Servicio | Container | Imagen | Puerto |
|----------|-----------|--------|--------|
| App Unificada | `mv-app` | Node 20 Alpine | `:3000` (público) |
| Database | `mv-database` | MySQL 8.0 | `:3307` → `:3306` |

### Networking
- Todos los servicios comparten la red `mv-network` (bridge).
- El contenedor `mv-app` sirve tanto la interfaz como la API.
- El backend se conecta a la base de datos via `db:3306`.

### Persistencia
- `mysql_data`: Volume Docker para la data de MySQL.
- Los archivos de la aplicación son efímeros (rebuildeables).
