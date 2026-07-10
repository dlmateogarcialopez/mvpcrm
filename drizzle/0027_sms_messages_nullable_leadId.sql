-- ============================================================
-- Migración 0025: hacer sms_messages.leadId nullable
-- para soportar el flujo de "envío rápido" (sin lead asociado)
-- Versión idempotente.
-- ============================================================

SET @col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'sms_messages'
    AND COLUMN_NAME = 'leadId'
);
SET @sql := IF(@col = 0,
  'SELECT 1',
  'ALTER TABLE sms_messages MODIFY COLUMN leadId INT NULL'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
