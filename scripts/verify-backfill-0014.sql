-- ============================================================
-- Verificación de backfill — Migración 0014 multi-tenant
-- Ejecutar ANTES y DESPUÉS de aplicar la migración.
-- Esperado: los conteos en "pre" y "post" deben coincidir
-- exactamente para todas las tablas. Todos los registros
-- históricos deben quedar con organizationId = 1.
-- ============================================================

SELECT '===== ESTADO DE LA MIGRACIÓN 0014 =====' AS section;

-- 1. Verificar que las 4 tablas nuevas existen
SELECT 'Tablas nuevas' AS check_name;
SELECT
  CASE WHEN COUNT(*) = 4 THEN '✅ OK' ELSE CONCAT('❌ FALTAN: ', 4 - COUNT(*)) END AS result,
  GROUP_CONCAT(TABLE_NAME ORDER BY TABLE_NAME SEPARATOR ', ') AS tables_found
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME IN ('organizations', 'organization_members', 'organization_settings', 'organization_invitations');

-- 2. Verificar que la org default existe
SELECT 'Org default (id=1)' AS check_name;
SELECT
  CASE WHEN COUNT(*) = 1 THEN '✅ OK' ELSE '❌ NO EXISTE' END AS result,
  id, name, slug, status
FROM organizations
WHERE id = 1;

-- 3. Verificar membresías: todos los usuarios deben estar en alguna org
SELECT 'Membresías' AS check_name;
SELECT
  (SELECT COUNT(*) FROM users) AS total_users,
  (SELECT COUNT(*) FROM organization_members) AS total_memberships,
  (SELECT COUNT(*) FROM users u WHERE NOT EXISTS (SELECT 1 FROM organization_members om WHERE om.userId = u.id)) AS users_sin_org,
  CASE
    WHEN (SELECT COUNT(*) FROM users u WHERE NOT EXISTS (SELECT 1 FROM organization_members om WHERE om.userId = u.id)) = 0
    THEN '✅ TODOS LOS USUARIOS TIENEN ORG'
    ELSE '❌ HAY USUARIOS SIN ORG'
  END AS result;

-- 4. Verificar que organization_settings existe para la org default
SELECT 'Settings de org default' AS check_name;
SELECT
  CASE WHEN COUNT(*) = 1 THEN '✅ OK' ELSE '❌ FALTA' END AS result,
  organizationId, displayName, primaryColor
FROM organization_settings
WHERE organizationId = 1;

-- ============================================================
-- Conteo de registros por tabla con organizationId
-- ============================================================

SELECT '===== DISTRIBUCIÓN DE REGISTROS POR ORG =====' AS section;

SELECT 'leads' AS tabla, organizationId, COUNT(*) AS n FROM leads GROUP BY organizationId;
SELECT 'pipelines' AS tabla, organizationId, COUNT(*) AS n FROM pipelines GROUP BY organizationId;
SELECT 'pipeline_stages' AS tabla, organizationId, COUNT(*) AS n FROM pipeline_stages GROUP BY organizationId;
SELECT 'lead_pipeline_stages' AS tabla, organizationId, COUNT(*) AS n FROM lead_pipeline_stages GROUP BY organizationId;
SELECT 'user_permissions' AS tabla, organizationId, COUNT(*) AS n FROM user_permissions GROUP BY organizationId;
SELECT 'metric_views' AS tabla, organizationId, COUNT(*) AS n FROM metric_views GROUP BY organizationId;
SELECT 'custom_labels' AS tabla, organizationId, COUNT(*) AS n FROM custom_labels GROUP BY organizationId;
SELECT 'custom_channels' AS tabla, organizationId, COUNT(*) AS n FROM custom_channels GROUP BY organizationId;
SELECT 'automation_rules' AS tabla, organizationId, COUNT(*) AS n FROM automation_rules GROUP BY organizationId;
SELECT 'email_campaigns' AS tabla, organizationId, COUNT(*) AS n FROM email_campaigns GROUP BY organizationId;
SELECT 'automation_recipients' AS tabla, organizationId, COUNT(*) AS n FROM automation_recipients GROUP BY organizationId;
SELECT 'leadActivities' AS tabla, organizationId, COUNT(*) AS n FROM leadActivities GROUP BY organizationId;
SELECT 'leadCalendarSyncs' AS tabla, organizationId, COUNT(*) AS n FROM leadCalendarSyncs GROUP BY organizationId;
SELECT 'settingsChangeLogs' AS tabla, organizationId, COUNT(*) AS n FROM settingsChangeLogs GROUP BY organizationId;

-- ============================================================
-- Sanity check: no debe haber registros con organizationId NULL
-- ============================================================

SELECT '===== REGISTROS SIN ORG (debe ser 0) =====' AS section;

SELECT 'leads_sin_org' AS check_name,
  (SELECT COUNT(*) FROM leads WHERE organizationId IS NULL) AS nulos
UNION ALL
SELECT 'pipelines_sin_org',
  (SELECT COUNT(*) FROM pipelines WHERE organizationId IS NULL)
UNION ALL
SELECT 'pipeline_stages_sin_org',
  (SELECT COUNT(*) FROM pipeline_stages WHERE organizationId IS NULL)
UNION ALL
SELECT 'user_permissions_sin_org',
  (SELECT COUNT(*) FROM user_permissions WHERE organizationId IS NULL)
UNION ALL
SELECT 'metric_views_sin_org',
  (SELECT COUNT(*) FROM metric_views WHERE organizationId IS NULL)
UNION ALL
SELECT 'custom_labels_sin_org',
  (SELECT COUNT(*) FROM custom_labels WHERE organizationId IS NULL)
UNION ALL
SELECT 'custom_channels_sin_org',
  (SELECT COUNT(*) FROM custom_channels WHERE organizationId IS NULL)
UNION ALL
SELECT 'automation_rules_sin_org',
  (SELECT COUNT(*) FROM automation_rules WHERE organizationId IS NULL)
UNION ALL
SELECT 'email_campaigns_sin_org',
  (SELECT COUNT(*) FROM email_campaigns WHERE organizationId IS NULL)
UNION ALL
SELECT 'automation_recipients_sin_org',
  (SELECT COUNT(*) FROM automation_recipients WHERE organizationId IS NULL)
UNION ALL
SELECT 'lead_activities_sin_org',
  (SELECT COUNT(*) FROM leadActivities WHERE organizationId IS NULL)
UNION ALL
SELECT 'lead_calendar_syncs_sin_org',
  (SELECT COUNT(*) FROM leadCalendarSyncs WHERE organizationId IS NULL)
UNION ALL
SELECT 'settings_change_logs_sin_org',
  (SELECT COUNT(*) FROM settingsChangeLogs WHERE organizationId IS NULL);

-- ============================================================
-- Total general esperado: la suma de organizationId=1 en
-- cada tabla debe coincidir con el conteo total histórico.
-- ============================================================

SELECT '===== CONTEOS TOTALES (post-migración) =====' AS section;

SELECT
  (SELECT COUNT(*) FROM users) AS users,
  (SELECT COUNT(*) FROM leads) AS leads,
  (SELECT COUNT(*) FROM pipelines) AS pipelines,
  (SELECT COUNT(*) FROM pipeline_stages) AS pipeline_stages,
  (SELECT COUNT(*) FROM lead_pipeline_stages) AS lead_pipeline_stages,
  (SELECT COUNT(*) FROM user_permissions) AS user_permissions,
  (SELECT COUNT(*) FROM metric_views) AS metric_views,
  (SELECT COUNT(*) FROM custom_labels) AS custom_labels,
  (SELECT COUNT(*) FROM custom_channels) AS custom_channels,
  (SELECT COUNT(*) FROM automation_rules) AS automation_rules,
  (SELECT COUNT(*) FROM email_campaigns) AS email_campaigns,
  (SELECT COUNT(*) FROM automation_recipients) AS automation_recipients,
  (SELECT COUNT(*) FROM leadActivities) AS lead_activities,
  (SELECT COUNT(*) FROM leadCalendarSyncs) AS lead_calendar_syncs,
  (SELECT COUNT(*) FROM settingsChangeLogs) AS settings_change_logs,
  (SELECT COUNT(*) FROM organizations) AS organizations,
  (SELECT COUNT(*) FROM organization_members) AS organization_members,
  (SELECT COUNT(*) FROM organization_settings) AS organization_settings,
  (SELECT COUNT(*) FROM organization_invitations) AS organization_invitations;
