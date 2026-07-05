-- ============================================================
-- Migración 0022: formLayout para configuración de formulario por organización
-- Versión idempotente.
-- ============================================================

SET @col1 := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'organization_settings'
    AND COLUMN_NAME = 'formLayout'
);
SET @sql1 := IF(@col1 = 0,
  'ALTER TABLE organization_settings ADD COLUMN formLayout LONGTEXT NULL DEFAULT NULL',
  'SELECT 1');
PREPARE stmt1 FROM @sql1; EXECUTE stmt1; DEALLOCATE PREPARE stmt1;
