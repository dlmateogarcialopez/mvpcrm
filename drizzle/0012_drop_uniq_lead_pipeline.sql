-- ============================================================
-- Eliminar el índice único (leadId, pipelineId) de
-- lead_pipeline_stages. Con el nuevo modelo de historial
-- (INSERT en vez de UPSERT), un lead puede tener múltiples
-- registros en el mismo pipeline (uno por cada movimiento).
-- ============================================================

DROP INDEX `uniq_lead_pipeline` ON `lead_pipeline_stages`;
