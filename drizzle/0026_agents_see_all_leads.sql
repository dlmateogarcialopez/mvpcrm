-- ============================================================
-- Migración 0026: toggle agentsSeeAllLeads para visibilidad por org
-- Versión idempotente.
-- ============================================================

SET @col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'organization_settings'
    AND COLUMN_NAME = 'agentsSeeAllLeads'
);
SET @sql := IF(@col = 0,
  'ALTER TABLE organization_settings ADD COLUMN agentsSeeAllLeads TINYINT(1) NOT NULL DEFAULT 1',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
