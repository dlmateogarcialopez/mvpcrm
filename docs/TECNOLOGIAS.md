# Stack Tecnológico — Máquina de Ventas

> **Versión:** 2.0 (Dockerizada)

---

## 1. Frontend

| Tecnología | Versión | Propósito |
|------------|---------|-----------|
| **React** | 19.2 | Librería de UI con Hooks y Server Actions |
| **TypeScript** | 5.9 | Tipado estático end-to-end |
| **Vite** | 7.1 | Bundler ultrarrápido (HMR en desarrollo, build optimizado) |
| **TailwindCSS** | 4.1 | Sistema de utilidades CSS (JIT compiler) |
| **shadcn/ui** | Latest | Componentes Radix UI pre-estilizados y accesibles |
| **Wouter** | 3.3 | Router ligero para SPA (~1.5KB) |
| **TanStack React Query** | 5.90 | Cache y sincronización de datos del servidor |
| **tRPC Client** | 11.6 | Llamadas tipadas al backend sin REST |
| **Framer Motion** | 12.23 | Animaciones declarativas y transiciones |
| **Recharts** | 2.15 | Gráficos y visualizaciones del resumen comercial |
| **Lucide React** | 0.453 | Iconografía consistente |
| **React Hook Form** | 7.64 | Formularios performantes con validación |

---

## 2. Backend

| Tecnología | Versión | Propósito |
|------------|---------|-----------|
| **Node.js** | 20 LTS | Runtime de JavaScript del lado servidor |
| **Express** | 4.21 | Framework HTTP minimalista |
| **tRPC Server** | 11.6 | Capa de API con tipado automático al frontend |
| **Drizzle ORM** | 0.44 | ORM type-safe con enfoque schema-first |
| **Drizzle Kit** | 0.31 | CLI para generar y aplicar migraciones SQL |
| **Zod** | 4.1 | Validación y parsing de schemas en runtime |
| **Jose** | 6.1 | Manejo de JWT para autenticación |
| **esbuild** | 0.25 | Compilador rápido de TypeScript a JS (producción) |
| **tsx** | 4.19 | Ejecución directa de TypeScript (desarrollo) |

---

## 3. Base de Datos

| Tecnología | Versión | Propósito |
|------------|---------|-----------|
| **MySQL** | 8.0 | Motor relacional principal |
| **mysql2** | 3.15 | Driver nativo de Node.js para MySQL |

---

## 4. Integraciones Externas

| Servicio | Paquete | Propósito |
|----------|---------|-----------|
| **Telegram** | API nativa (axios) | Alertas en tiempo real al equipo |
| **Google Calendar** | `googleapis` 171 | Sincronización de visitas de oportunidades |
| **Resend** | `resend` 6.10 | Envío de emails transaccionales |
| **AWS S3** | `@aws-sdk/client-s3` 3.693 | Almacenamiento de archivos adjuntos |
| **Excel** | `xlsx` 0.18 | Exportación de oportunidades a .xlsx |

---

## 5. Infraestructura y DevOps

| Tecnología | Versión | Propósito |
|------------|---------|-----------|
| **Docker** | Latest | Contenedorización de los 3 servicios |
| **Docker Compose** | v2 | Orquestación local de servicios |
| **Nginx** | Alpine | Servidor web para frontend + proxy reverso |
| **pnpm** | 10.4 | Gestor de paquetes (rápido, eficiente en disco) |

---

## 6. Testing y Calidad

| Tecnología | Versión | Propósito |
|------------|---------|-----------|
| **Vitest** | 2.1 | Framework de testing rápido (compatible con Vite) |
| **Prettier** | 3.6 | Formateo automático de código |
| **TypeScript** | 5.9 | Verificación de tipos (`pnpm check`) |

### Tests Existentes

| Archivo | Tipo | Cobertura |
|---------|------|-----------|
| `server/leads.business.test.ts` | Lógica de negocio | Cálculos de puntaje y prioridad |
| `server/ui-visible-copy.audit.test.ts` | Auditoría de UI | Verifica terminología comercial |
| `server/settings-threshold-validation.test.ts` | Validación | Umbrales de configuración |
| `server/lead-export.test.ts` | Integración | Exportación a Excel |
| `shared/leadSchemas.test.ts` | Validación | Schemas Zod |
| `shared/leads.test.ts` | Lógica compartida | Enums y constantes |

---

## 7. Aliases de Importación

| Alias | Ruta Real | Uso |
|-------|-----------|-----|
| `@/` | `client/src/` | Componentes, hooks, y páginas del frontend |
| `@shared/` | `shared/` | Tipos, schemas y lógica compartida |
| `@assets/` | `attached_assets/` | Activos adjuntos |
