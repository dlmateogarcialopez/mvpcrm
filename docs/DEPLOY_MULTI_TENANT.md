# Deploy Multi-Tenant — Plan y Checklist

Esta guía describe cómo desplegar la rama `feature/multi-tenant` a producción.

## Pre-requisitos

- Docker Desktop corriendo
- Acceso SSH al servidor de producción (o ejecución local de `docker compose`)
- Variable de entorno `DATABASE_URL` apuntando a la DB de producción
- Backup reciente de la DB

## Pasos

### 1. Backup

```bash
docker exec mv-database bash -c \
  'mysqldump -u root -p"$MYSQL_ROOT_PASSWORD" cotizador_leads' \
  > backup_pre_multitenant_$(date +%Y%m%d_%H%M%S).sql
```

### 2. Merge y build

```bash
cd /path/to/prod
git fetch origin
git checkout master
git merge origin/feature/multi-tenant
npm install  # o pnpm install
npm run build
```

### 3. Aplicar migración 0014

```bash
# Copiar el SQL al contenedor de DB
docker cp drizzle/0014_multi_tenant.sql mv-database:/tmp/0014.sql

# Aplicar
docker exec -i mv-database bash -c \
  "mysql -u mv_user -p'mv_password' cotizador_leads < /tmp/0014.sql"
```

### 4. Verificar backfill

```bash
docker cp scripts/verify-backfill-0014.sql mv-database:/tmp/verify.sql
docker exec -i mv-database bash -c \
  "mysql -u mv_user -p'mv_password' cotizador_leads" < scripts/verify-backfill-0014.sql
```

Esperado:
- 4 tablas nuevas presentes
- 1 organización (default "Negocio Principal")
- Membresías para todos los usuarios existentes
- Settings de la org default poblados
- `SELECT COUNT(*) FROM leads WHERE organization_id = 1` debe coincidir con el conteo total pre-migración

### 5. Reiniciar app

```bash
docker compose build --no-cache app
docker compose up -d app
```

### 6. Smoke test manual

1. Abrir `https://tu-dominio.com/login`
2. Login con un usuario existente (debe tener membresía en la org default)
3. Verificar que el `OrgSwitcher` aparece en el sidebar mostrando "Negocio Principal"
4. Verificar que el H1 de Settings dice "Configuración de Negocio Principal"
5. Ir a Settings → Identidad de la organización → cambiar el color primario → guardar
6. Verificar que toda la UI (botones primarios, focus rings, charts) cambia al nuevo color
7. Verificar que el menú lateral y el dashboard siguen funcionando con el branding nuevo

### 7. E2E automatizado

```bash
# En el server de prod (o cualquier host con acceso a la API)
E2E_BASE_URL=https://tu-dominio.com \
E2E_EMAIL=tu-admin@correo.com \
E2E_PASSWORD=tu-password \
node scripts/e2e-multitenant.cjs
```

Esperado: `RESUMEN: 22 passed, 0 failed`.

### 8. Verificación de aislamiento cross-org

1. Login como superadmin
2. Ir a Settings → Organizaciones → Crear nueva org "Org Test 1"
3. Auto-entra a la nueva org (cookie setea active_org_id)
4. Crear un lead desde la UI o via `trpc.leads.create`
5. Verificar que el lead aparece en el dashboard de la org nueva
6. Cambiar a la org default (OrgSwitcher)
7. Verificar que el lead NO aparece en el dashboard de la org default
8. En Settings → Organizaciones, archivar "Org Test 1" como limpieza

## Rollback

Si algo sale mal, el rollback es:

```sql
-- 1. Eliminar las foreign keys agregadas
ALTER TABLE organization_invitations DROP FOREIGN KEY fk_organization_invitations_org;
ALTER TABLE organization_members DROP FOREIGN KEY fk_organization_members_org;
ALTER TABLE organization_members DROP FOREIGN KEY fk_organization_members_user;
ALTER TABLE organization_settings DROP FOREIGN KEY fk_organization_settings_org;
ALTER TABLE organizations DROP FOREIGN KEY organizations_createdByUserId_users_id_fk;

-- 2. Eliminar la columna organization_id de cada tabla
ALTER TABLE leads DROP COLUMN organization_id;
ALTER TABLE pipelines DROP COLUMN organization_id;
ALTER TABLE pipeline_stages DROP COLUMN organization_id;
ALTER TABLE lead_pipeline_stages DROP COLUMN organization_id;
ALTER TABLE automation_rules DROP COLUMN organization_id;
ALTER TABLE email_campaigns DROP COLUMN organization_id;
ALTER TABLE automation_recipients DROP COLUMN organization_id;
ALTER TABLE custom_labels DROP COLUMN organization_id;
ALTER TABLE custom_channels DROP COLUMN organization_id;
ALTER TABLE metric_views DROP COLUMN organization_id;
ALTER TABLE user_permissions DROP COLUMN organization_id;
ALTER TABLE leadActivities DROP COLUMN organization_id;
ALTER TABLE leadCalendarSyncs DROP COLUMN organization_id;
ALTER TABLE settingsChangeLogs DROP COLUMN organization_id;

-- 3. Eliminar las tablas nuevas
DROP TABLE organization_invitations;
DROP TABLE organization_settings;
DROP TABLE organization_members;
DROP TABLE organizations;
```

En el código, hacer `git revert` del merge y rebuild:

```bash
git revert <merge-commit-sha>
npm run build
docker compose build --no-cache app
docker compose up -d app
```

## Variables de entorno que cambian de impacto

- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`: ahora son **fallback**. La org puede override con su propio bot.
- `RESEND_API_KEY`, `SMTP_*`: ahora son **fallback**. Cada org puede tener su provider.
- `GOOGLE_SERVICE_ACCOUNT_*`: sigue siendo **global** (no se replica por org). El calendarId sí es per-org.

## Métricas a monitorear post-deploy

- Latencia de queries con `WHERE organization_id = ?` (debe ser < 50ms con índice)
- 401s por `orgProcedure` (usuarios con cookie stale que necesitan refresh)
- Errores de "No hay una organización activa" en logs (esperados durante el primer login)
- Tasa de creación de orgs nuevas (para capacity planning)
