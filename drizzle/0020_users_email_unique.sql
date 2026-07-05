-- ============================================================
-- Migración 0020: email único en users + detección duplicados
-- Versión idempotente.
-- ============================================================

SET @idx_exists := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND INDEX_NAME = 'idx_users_email'
);
SET @sql := IF(@idx_exists = 0,
  'CREATE UNIQUE INDEX `idx_users_email` ON `users` (`email`)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
