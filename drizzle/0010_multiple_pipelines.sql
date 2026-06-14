CREATE TABLE `lead_pipeline_stages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`leadId` int NOT NULL,
	`pipelineId` int NOT NULL,
	`stageId` int NOT NULL,
	`movedAt` timestamp NOT NULL DEFAULT (now()),
	`movedByUserId` int,
	CONSTRAINT `lead_pipeline_stages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `pipelines` (
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
--> statement-breakpoint
ALTER TABLE `pipeline_stages` MODIFY COLUMN `createdAt` timestamp NOT NULL DEFAULT (now());--> statement-breakpoint
ALTER TABLE `pipeline_stages` MODIFY COLUMN `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP;--> statement-breakpoint
ALTER TABLE `pipeline_stages` ADD `pipelineId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `pipeline_stages` ADD `kind` enum('open','won','lost','paused') DEFAULT 'open' NOT NULL;
--> statement-breakpoint

-- ============================================================
-- Siembra de datos: crear pipeline "Principal" con las fases
-- tradicionales y asignar los leads existentes.
-- ============================================================

-- 1) Crear el pipeline "Principal" si no existe.
INSERT INTO `pipelines` (`name`, `description`, `color`, `order`, `isActive`)
SELECT 'Principal', 'Embudo principal del sistema con las fases tradicionales.', '#3b82f6', 1, true
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `pipelines` WHERE `name` = 'Principal');
--> statement-breakpoint

-- 2) Asignar todas las fases existentes al pipeline "Principal"
--    y calcular su `kind` según el `name`.
SET @principal_id := (SELECT `id` FROM `pipelines` WHERE `name` = 'Principal' LIMIT 1);
UPDATE `pipeline_stages` SET `pipelineId` = @principal_id;
UPDATE `pipeline_stages` SET `kind` = 'won'    WHERE `name` = 'ganado';
UPDATE `pipeline_stages` SET `kind` = 'lost'   WHERE `name` = 'perdido';
UPDATE `pipeline_stages` SET `kind` = 'paused' WHERE `name` = 'pausado';
--> statement-breakpoint

-- 3) Si no existían fases (BD vacía), sembrar las 8 tradicionales.
INSERT INTO `pipeline_stages` (`pipelineId`, `name`, `displayName`, `color`, `order`, `isActive`, `kind`)
SELECT @principal_id, 'nuevo', 'Nuevo', '#3b82f6', 1, true, 'open'
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `pipeline_stages` WHERE `name` = 'nuevo');

INSERT INTO `pipeline_stages` (`pipelineId`, `name`, `displayName`, `color`, `order`, `isActive`, `kind`)
SELECT @principal_id, 'contactado', 'Contactado', '#8b5cf6', 2, true, 'open'
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `pipeline_stages` WHERE `name` = 'contactado');

INSERT INTO `pipeline_stages` (`pipelineId`, `name`, `displayName`, `color`, `order`, `isActive`, `kind`)
SELECT @principal_id, 'calificado', 'Calificado', '#6366f1', 3, true, 'open'
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `pipeline_stages` WHERE `name` = 'calificado');

INSERT INTO `pipeline_stages` (`pipelineId`, `name`, `displayName`, `color`, `order`, `isActive`, `kind`)
SELECT @principal_id, 'propuesta', 'Propuesta Enviada', '#f59e0b', 4, true, 'open'
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `pipeline_stages` WHERE `name` = 'propuesta');

INSERT INTO `pipeline_stages` (`pipelineId`, `name`, `displayName`, `color`, `order`, `isActive`, `kind`)
SELECT @principal_id, 'negociacion', 'Negociación', '#f97316', 5, true, 'open'
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `pipeline_stages` WHERE `name` = 'negociacion');

INSERT INTO `pipeline_stages` (`pipelineId`, `name`, `displayName`, `color`, `order`, `isActive`, `kind`)
SELECT @principal_id, 'ganado', 'Ganado', '#10b981', 6, true, 'won'
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `pipeline_stages` WHERE `name` = 'ganado');

INSERT INTO `pipeline_stages` (`pipelineId`, `name`, `displayName`, `color`, `order`, `isActive`, `kind`)
SELECT @principal_id, 'perdido', 'Perdido', '#ef4444', 7, true, 'lost'
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `pipeline_stages` WHERE `name` = 'perdido');

INSERT INTO `pipeline_stages` (`pipelineId`, `name`, `displayName`, `color`, `order`, `isActive`, `kind`)
SELECT @principal_id, 'pausado', 'Pausado', '#6b7280', 8, true, 'paused'
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `pipeline_stages` WHERE `name` = 'pausado');
--> statement-breakpoint

-- 4) Asignar todos los leads al pipeline "Principal" en la fase
--    que coincida con su `estadoLead` actual.
INSERT INTO `lead_pipeline_stages` (`leadId`, `pipelineId`, `stageId`, `movedByUserId`)
SELECT
  l.`id`,
  @principal_id,
  COALESCE(
    (SELECT ps.`id` FROM `pipeline_stages` ps
     WHERE ps.`pipelineId` = @principal_id
       AND (ps.`name` = l.`estadoLead` OR ps.`displayName` = l.`estadoLead`)
     LIMIT 1),
    (SELECT ps.`id` FROM `pipeline_stages` ps
     WHERE ps.`pipelineId` = @principal_id
     ORDER BY ps.`order` ASC LIMIT 1)
  ) AS stage_id,
  l.`updatedByUserId`
FROM `leads` l
WHERE NOT EXISTS (
  SELECT 1 FROM `lead_pipeline_stages` lps
  WHERE lps.`leadId` = l.`id` AND lps.`pipelineId` = @principal_id
);
--> statement-breakpoint

-- 5) Índice único para evitar duplicados lead × pipeline.
CREATE UNIQUE INDEX `uniq_lead_pipeline` ON `lead_pipeline_stages` (`leadId`, `pipelineId`);
