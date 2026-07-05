-- ============================================================
-- Migración 0021: campos personalizados para leads por organización
-- Versión idempotente.
-- ============================================================

SET @col1 := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'leads'
    AND COLUMN_NAME = 'customData'
);
SET @sql1 := IF(@col1 = 0,
  'ALTER TABLE leads ADD COLUMN customData LONGTEXT NULL DEFAULT NULL',
  'SELECT 1');
PREPARE stmt1 FROM @sql1; EXECUTE stmt1; DEALLOCATE PREPARE stmt1;

SET @col2 := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'organization_settings'
    AND COLUMN_NAME = 'leadFieldDefs'
);
SET @sql2 := IF(@col2 = 0,
  'ALTER TABLE organization_settings ADD COLUMN leadFieldDefs LONGTEXT NULL DEFAULT NULL',
  'SELECT 1');
PREPARE stmt2 FROM @sql2; EXECUTE stmt2; DEALLOCATE PREPARE stmt2;
