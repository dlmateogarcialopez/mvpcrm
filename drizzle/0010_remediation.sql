-- ============================================================
-- Script de REMEDIACIÓN idempotente para la migración 0010.
-- Aplicable cuando la migración 0010 falló parcialmente.
-- Estado conocido a remediar:
--   - pipeline_stages: existe SIN columnas pipelineId ni kind
--   - pipelines: NO existe
--   - lead_pipeline_stages: existe pero VACÍA
--   - __drizzle_migrations: vacía
-- ============================================================

-- ============================================================
-- Paso 1: Agregar columnas faltantes a pipeline_stages
-- ============================================================

-- Agregar pipelineId (si no existe)
SET @has_pipelineId := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'pipeline_stages'
    AND column_name = 'pipelineId'
);

SET @sql := IF(
  @has_pipelineId = 0,
  'ALTER TABLE `pipeline_stages` ADD `pipelineId` int NOT NULL',
  'SELECT ''pipelineId ya existe'' AS info'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Agregar kind (si no existe)
SET @has_kind := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'pipeline_stages'
    AND column_name = 'kind'
);

SET @sql := IF(
  @has_kind = 0,
  "ALTER TABLE `pipeline_stages` ADD `kind` enum('open','won','lost','paused') NOT NULL DEFAULT 'open'",
  'SELECT ''kind ya existe'' AS info'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ============================================================
-- Paso 2: Crear tabla pipelines (si no existe)
-- ============================================================

CREATE TABLE IF NOT EXISTS `pipelines` (
  `id` int AUTO_INCREMENT NOT NULL,
  `name` varchar(100) NOT NULL,
  `description` text,
  `color` varchar(7) DEFAULT '#3b82f6',
  `order` int DEFAULT 0,
  `isActive` boolean DEFAULT true,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `pipelines_id` PRIMARY KEY(`id`)
);

-- ============================================================
-- Paso 3: Crear pipeline "Principal" (si no existe)
-- ============================================================

INSERT INTO `pipelines` (`name`, `description`, `color`, `order`, `isActive`)
SELECT 'Principal', 'Embudo principal del sistema con las fases tradicionales.', '#3b82f6', 1, true
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `pipelines` WHERE `name` = 'Principal');

-- ============================================================
-- Paso 4: Asignar fases existentes al pipeline "Principal"
-- y calcular su kind
-- ============================================================

SET @principal_id := (SELECT `id` FROM `pipelines` WHERE `name` = 'Principal' LIMIT 1);

-- Asignar pipelineId a las fases que no lo tengan
UPDATE `pipeline_stages`
SET `pipelineId` = @principal_id
WHERE `pipelineId` IS NULL OR `pipelineId` = 0;

-- Calcular kind según el name
UPDATE `pipeline_stages` SET `kind` = 'won'    WHERE `name` = 'ganado'  AND `kind` <> 'won';
UPDATE `pipeline_stages` SET `kind` = 'lost'   WHERE `name` = 'perdido' AND `kind` <> 'lost';
UPDATE `pipeline_stages` SET `kind` = 'paused' WHERE `name` = 'pausado' AND `kind` <> 'paused';

-- ============================================================
-- Paso 5: Sembrar fases tradicionales si faltan
-- ============================================================

INSERT INTO `pipeline_stages`
  (`pipelineId`, `name`, `displayName`, `color`, `order`, `isActive`, `kind`)
SELECT @principal_id, 'nuevo', 'Nuevo', '#3b82f6', 1, true, 'open'
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `pipeline_stages` WHERE `name` = 'nuevo');

INSERT INTO `pipeline_stages`
  (`pipelineId`, `name`, `displayName`, `color`, `order`, `isActive`, `kind`)
SELECT @principal_id, 'contactado', 'Contactado', '#8b5cf6', 2, true, 'open'
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `pipeline_stages` WHERE `name` = 'contactado');

INSERT INTO `pipeline_stages`
  (`pipelineId`, `name`, `displayName`, `color`, `order`, `isActive`, `kind`)
SELECT @principal_id, 'calificado', 'Calificado', '#6366f1', 3, true, 'open'
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `pipeline_stages` WHERE `name` = 'calificado');

INSERT INTO `pipeline_stages`
  (`pipelineId`, `name`, `displayName`, `color`, `order`, `isActive`, `kind`)
SELECT @principal_id, 'propuesta', 'Propuesta Enviada', '#f59e0b', 4, true, 'open'
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `pipeline_stages` WHERE `name` = 'propuesta');

INSERT INTO `pipeline_stages`
  (`pipelineId`, `name`, `displayName`, `color`, `order`, `isActive`, `kind`)
SELECT @principal_id, 'negociacion', 'Negociación', '#f97316', 5, true, 'open'
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `pipeline_stages` WHERE `name` = 'negociacion');

INSERT INTO `pipeline_stages`
  (`pipelineId`, `name`, `displayName`, `color`, `order`, `isActive`, `kind`)
SELECT @principal_id, 'ganado', 'Ganado', '#10b981', 6, true, 'won'
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `pipeline_stages` WHERE `name` = 'ganado');

INSERT INTO `pipeline_stages`
  (`pipelineId`, `name`, `displayName`, `color`, `order`, `isActive`, `kind`)
SELECT @principal_id, 'perdido', 'Perdido', '#ef4444', 7, true, 'lost'
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `pipeline_stages` WHERE `name` = 'perdido');

INSERT INTO `pipeline_stages`
  (`pipelineId`, `name`, `displayName`, `color`, `order`, `isActive`, `kind`)
SELECT @principal_id, 'pausado', 'Pausado', '#6b7280', 8, true, 'paused'
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `pipeline_stages` WHERE `name` = 'pausado');

-- ============================================================
-- Paso 6: Asignar todos los leads al pipeline "Principal"
-- en la fase que coincida con su estadoLead actual
-- ============================================================

INSERT INTO `lead_pipeline_stages`
  (`leadId`, `pipelineId`, `stageId`, `movedByUserId`)
SELECT
  l.`id`,
  @principal_id,
  COALESCE(
    (
      SELECT ps.`id` FROM `pipeline_stages` ps
      WHERE ps.`pipelineId` = @principal_id
        AND (ps.`name` = l.`estadoLead` OR ps.`displayName` = l.`estadoLead`)
      LIMIT 1
    ),
    (
      SELECT ps.`id` FROM `pipeline_stages` ps
      WHERE ps.`pipelineId` = @principal_id
      ORDER BY ps.`order` ASC
      LIMIT 1
    )
  ) AS stage_id,
  l.`updatedByUserId`
FROM `leads` l
WHERE NOT EXISTS (
  SELECT 1 FROM `lead_pipeline_stages` lps
  WHERE lps.`leadId` = l.`id` AND lps.`pipelineId` = @principal_id
);

-- ============================================================
-- Paso 7: Crear índice único (si no existe)
-- ============================================================

SET @has_index := (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'lead_pipeline_stages'
    AND index_name = 'uniq_lead_pipeline'
);

SET @sql := IF(
  @has_index = 0,
  'CREATE UNIQUE INDEX `uniq_lead_pipeline` ON `lead_pipeline_stages` (`leadId`, `pipelineId`)',
  'SELECT ''uniq_lead_pipeline ya existe'' AS info'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ============================================================
-- Paso 8: Verificación
-- ============================================================

SELECT 'PIPELINES' AS tabla, COUNT(*) AS total FROM `pipelines`;
SELECT 'PIPELINE_STAGES' AS tabla, COUNT(*) AS total FROM `pipeline_stages`;
SELECT 'LEAD_PIPELINE_STAGES' AS tabla, COUNT(*) AS total FROM `lead_pipeline_stages`;

SELECT id, name, pipelineId, kind, `order`
FROM `pipeline_stages`
ORDER BY `order`;

SELECT id, name, `order`, isActive FROM `pipelines`;

-- Mensaje final
SELECT 'Remediación 0010 completada.' AS status;
