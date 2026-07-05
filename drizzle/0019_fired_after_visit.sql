-- ============================================================
-- Migración 0019: columna firedAfterVisitAt en leads
-- Versión idempotente.
-- Evita que la regla "after_visit" se dispare repetidamente.
-- ============================================================

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'leads'
    AND COLUMN_NAME = 'firedAfterVisitAt'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE `leads` ADD COLUMN `firedAfterVisitAt` timestamp NULL AFTER `totalDialAttempts`',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
