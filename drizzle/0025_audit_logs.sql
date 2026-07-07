-- ============================================================
-- Migración 0025: tabla de auditoría global para superadmin
-- Versión idempotente.
-- ============================================================

SET @table := (
  SELECT COUNT(*) FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'auditLogs'
);
SET @sql := IF(@table = 0,
  'CREATE TABLE auditLogs (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    organizationId  INT NOT NULL DEFAULT 1,
    actorUserId     INT NULL,
    actorEmail      VARCHAR(320) NULL,
    actorName       TEXT NULL,
    action          VARCHAR(40) NOT NULL,
    entityType      VARCHAR(40) NOT NULL,
    entityId        VARCHAR(64) NULL,
    entityName      VARCHAR(255) NULL,
    summary         VARCHAR(255) NOT NULL,
    details         MEDIUMTEXT NULL,
    ipAddress       VARCHAR(64) NULL,
    userAgent       VARCHAR(255) NULL,
    createdAt       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx1 := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'auditLogs' AND INDEX_NAME = 'idx_audit_org_created'
);
SET @sql1 := IF(@idx1 = 0,
  'CREATE INDEX idx_audit_org_created ON auditLogs (organizationId, createdAt)',
  'SELECT 1');
PREPARE stmt1 FROM @sql1; EXECUTE stmt1; DEALLOCATE PREPARE stmt1;

SET @idx2 := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'auditLogs' AND INDEX_NAME = 'idx_audit_actor_created'
);
SET @sql2 := IF(@idx2 = 0,
  'CREATE INDEX idx_audit_actor_created ON auditLogs (actorUserId, createdAt)',
  'SELECT 1');
PREPARE stmt2 FROM @sql2; EXECUTE stmt2; DEALLOCATE PREPARE stmt2;

SET @idx3 := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'auditLogs' AND INDEX_NAME = 'idx_audit_entity'
);
SET @sql3 := IF(@idx3 = 0,
  'CREATE INDEX idx_audit_entity ON auditLogs (entityType, entityId)',
  'SELECT 1');
PREPARE stmt3 FROM @sql3; EXECUTE stmt3; DEALLOCATE PREPARE stmt3;

SET @idx4 := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'auditLogs' AND INDEX_NAME = 'idx_audit_action_created'
);
SET @sql4 := IF(@idx4 = 0,
  'CREATE INDEX idx_audit_action_created ON auditLogs (action, createdAt)',
  'SELECT 1');
PREPARE stmt4 FROM @sql4; EXECUTE stmt4; DEALLOCATE PREPARE stmt4;
