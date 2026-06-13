-- ============================================================
-- Script de aplicación de la migración 0009_automation_recipients
-- Fecha: 2026-06-12
-- Aplicable a: BD MySQL del servidor del cliente (5.189.136.252:3000)
--
-- Sintomas que resuelve:
--   - TRPCClientError en automation.recipients.list (query SELECT)
--   - TRPCClientError 500 en automation.recipients.create (INSERT)
--   - Cualquier referencia a la tabla `automation_recipients` falla
--
-- Uso:
--   mysql -h <HOST> -P <PORT> -u <USER> -p <DB_NAME> < apply_0009_automation_recipients.sql
--   o pegar el contenido en cualquier cliente MySQL (Workbench, HeidiSQL, TablePlus, etc.)
--
-- Este script es IDEMPOTENTE: si la tabla ya existe, no hace nada.
-- ============================================================

SET @dbname = DATABASE();
SELECT CONCAT('Aplicando migración 0009_automation_recipients en BD: ', @dbname) AS info;

-- Comprobación previa: ¿la tabla ya existe?
SELECT COUNT(*) AS tabla_existe
FROM information_schema.tables
WHERE table_schema = @dbname
  AND table_name = 'automation_recipients';

-- Si el conteo anterior es 1, la tabla ya existe. El bloque siguiente es no-op.
-- MySQL no soporta "CREATE TABLE IF NOT EXISTS" con el wrapper de Drizzle tal cual,
-- pero la migración original sí lo es (es el SQL idempotente que verás al final).
-- Aun así, validamos manualmente para reportar al usuario.

SET @should_create := (
  SELECT COUNT(*) = 0
  FROM information_schema.tables
  WHERE table_schema = @dbname
    AND table_name = 'automation_recipients'
);

-- Crear la tabla solo si no existe
CREATE TABLE IF NOT EXISTS `automation_recipients` (
  `id` int AUTO_INCREMENT NOT NULL,
  `name` varchar(160) NOT NULL,
  `telegramChatId` varchar(64),
  `email` varchar(320),
  `notes` text,
  `isActive` boolean NOT NULL DEFAULT true,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `automation_recipients_id` PRIMARY KEY(`id`)
);

-- Verificación final: la tabla debe existir y ser escribible
SELECT COUNT(*) AS total_destinatarios
FROM `automation_recipients`;

SELECT
  TABLE_NAME,
  ENGINE,
  TABLE_COLLATION
FROM information_schema.tables
WHERE table_schema = @dbname
  AND table_name = 'automation_recipients';

-- ============================================================
-- (Opcional) Insertar un destinatario de prueba para confirmar
-- que la tabla es escribible. DESCOMENTAR SOLO SI QUIERES PROBAR.
-- ============================================================

-- INSERT INTO `automation_recipients`
--   (`name`, `telegramChatId`, `email`, `notes`, `isActive`)
-- VALUES
--   ('Destinatario de prueba', '123456789', 'prueba@ejemplo.com', 'test', true);
--
-- SELECT * FROM `automation_recipients`;
--
-- DELETE FROM `automation_recipients`
-- WHERE `name` = 'Destinatario de prueba';

-- ============================================================
-- (Opcional) Verificar que el servidor Node puede leer la tabla.
-- Si tras aplicar este script la app sigue fallando, comparte
-- los logs del SERVIDOR (no del navegador) para diagnóstico.
-- ============================================================

-- Mensaje final
SELECT 'Migración 0009 aplicada correctamente.' AS status;
