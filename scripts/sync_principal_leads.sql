-- ============================================================
-- Script para sincronizar leads huérfanos al pipeline Principal.
-- Caso: el contador del Principal mostraba 5 leads pero en el
-- detalle había 9. Este script asigna al Principal los leads
-- que nunca fueron insertados en lead_pipeline_stages.
-- ============================================================

SET @principal_id := (SELECT `id` FROM `pipelines` WHERE `order` = 1 LIMIT 1);

SELECT CONCAT('Pipeline Principal ID: ', @principal_id) AS info;

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

SELECT CONCAT('Leads sincronizados: ', ROW_COUNT()) AS result;
SELECT 'Sincronización completada.' AS status;
