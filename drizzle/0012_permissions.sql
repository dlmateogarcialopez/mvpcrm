-- ============================================================
-- Migración 0012: permisos y roles custom
-- Crea las tablas permissions y user_permissions, agrega "custom"
-- al enum de users.role, y siembra el catálogo de permisos.
-- ============================================================

CREATE TABLE IF NOT EXISTS `permissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`key` varchar(64) NOT NULL,
	`name` varchar(100) NOT NULL,
	`groupName` varchar(50) NOT NULL,
	`description` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `permissions_id` PRIMARY KEY(`id`),
	CONSTRAINT `permissions_key_unique` UNIQUE(`key`)
);

CREATE TABLE IF NOT EXISTS `user_permissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`permissionId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `user_permissions_id` PRIMARY KEY(`id`)
);

ALTER TABLE `users` MODIFY COLUMN `role` enum('guest','agent','admin','superadmin','custom') NOT NULL DEFAULT 'agent';

-- ============================================================
-- Siembra del catálogo de permisos
-- ============================================================

-- Leads
INSERT IGNORE INTO `permissions` (`key`, `name`, `groupName`, `description`) VALUES
('leads.view', 'Ver oportunidades', 'Leads', 'Acceder a la lista de oportunidades.'),
('leads.create', 'Crear oportunidades', 'Leads', 'Crear nuevas oportunidades en el sistema.'),
('leads.edit', 'Editar oportunidades', 'Leads', 'Modificar datos de oportunidades existentes.'),
('leads.change_status', 'Cambiar estado de leads', 'Leads', 'Mover leads entre fases del embudo.'),
('leads.delete', 'Eliminar oportunidades', 'Leads', 'Eliminar oportunidades del sistema.');

-- Embudos
INSERT IGNORE INTO `permissions` (`key`, `name`, `groupName`, `description`) VALUES
('pipelines.view', 'Ver embudos', 'Embudos', 'Acceder a la vista de embudos y sus fases.'),
('pipelines.manage', 'Gestionar embudos y fases', 'Embudos', 'Crear, editar, eliminar y reordenar embudos y fases.');

-- Automatizaciones
INSERT IGNORE INTO `permissions` (`key`, `name`, `groupName`, `description`) VALUES
('automations.view', 'Ver automatizaciones', 'Automatizaciones', 'Acceder al panel de automatizaciones.'),
('automations.create', 'Crear y editar reglas', 'Automatizaciones', 'Crear y modificar reglas de automatización.'),
('automations.delete', 'Eliminar reglas', 'Automatizaciones', 'Eliminar reglas de automatización.'),
('automations.recipients', 'Gestionar destinatarios', 'Automatizaciones', 'Acceder a la libreta de destinatarios de automatizaciones.'),
('automations.super_triggers', 'Usar triggers avanzados', 'Automatizaciones', 'Crear reglas con triggers opportunity_* y acciones a destinatarios específicos.');

-- Métricas
INSERT IGNORE INTO `permissions` (`key`, `name`, `groupName`, `description`) VALUES
('metrics.view', 'Ver métricas', 'Métricas', 'Acceder a métricas de conversión y funnel.');

-- Importar/Exportar
INSERT IGNORE INTO `permissions` (`key`, `name`, `groupName`, `description`) VALUES
('import_export.use', 'Importar y exportar', 'Importar / Exportar', 'Importar leads desde Excel y exportar a Excel.');

-- Configuración
INSERT IGNORE INTO `permissions` (`key`, `name`, `groupName`, `description`) VALUES
('settings.view', 'Ver configuración', 'Configuración', 'Acceder al panel de configuración.'),
('settings.edit', 'Editar configuración', 'Configuración', 'Modificar parámetros del sistema (metas, comisiones, etc.).'),
('settings.team_manage', 'Gestionar equipo', 'Configuración', 'Ver y editar el equipo comercial.');

-- Usuarios
INSERT IGNORE INTO `permissions` (`key`, `name`, `groupName`, `description`) VALUES
('users.create', 'Crear usuarios', 'Usuarios', 'Crear nuevos usuarios con permisos personalizados.'),
('users.edit_permissions', 'Asignar permisos', 'Usuarios', 'Editar los permisos de usuarios con rol personalizado.');
