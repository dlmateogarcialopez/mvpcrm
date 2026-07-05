-- ============================================================
-- Migración 0017: columna autoMessage en phone_lists
-- Versión idempotente.
-- ============================================================

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'phone_lists'
    AND COLUMN_NAME = 'autoMessage'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE `phone_lists` ADD COLUMN `autoMessage` text NULL AFTER `callDelayMs`',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
