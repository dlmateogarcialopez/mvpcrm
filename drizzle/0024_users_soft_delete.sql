-- ============================================================
-- Migración 0024: soft delete de usuarios (deletedAt)
-- Versión idempotente.
-- ============================================================

SET @col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'deletedAt'
);
SET @sql := IF(@col = 0,
  'ALTER TABLE users ADD COLUMN deletedAt TIMESTAMP NULL DEFAULT NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND INDEX_NAME = 'idx_users_deletedAt'
);
SET @sql2 := IF(@idx = 0,
  'CREATE INDEX idx_users_deletedAt ON users (deletedAt)',
  'SELECT 1');
PREPARE stmt2 FROM @sql2; EXECUTE stmt2; DEALLOCATE PREPARE stmt2;
