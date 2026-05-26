ALTER TABLE `leadActivities` MODIFY COLUMN `activityType` enum('lead_created','lead_updated','status_changed','note_added','assignment_changed','calendar_sync','alert_sent','automation') NOT NULL;--> statement-breakpoint
ALTER TABLE `leads` MODIFY COLUMN `estadoLead` enum('nuevo','contactado','calificado','propuesta','negociacion','seguimiento','cotizado','ganado','perdido','pausado') NOT NULL DEFAULT 'nuevo';--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('guest','agent','admin','superadmin') NOT NULL DEFAULT 'agent';--> statement-breakpoint
ALTER TABLE `appSettings` ADD `metaIngresosMensual` int DEFAULT 50000000 NOT NULL;--> statement-breakpoint
ALTER TABLE `appSettings` ADD `comisionPorcentaje` int DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE `leadActivities` ADD `isSystem` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `leads` ADD `nombreEmpresa` varchar(160);--> statement-breakpoint
ALTER TABLE `leads` ADD `ciudad` varchar(120);--> statement-breakpoint
ALTER TABLE `leads` ADD `tipoEvento` enum('corporativo','social','experiencia','reunion','otro') DEFAULT 'otro' NOT NULL;--> statement-breakpoint
ALTER TABLE `leads` ADD `motivoPerdido` varchar(240);--> statement-breakpoint
ALTER TABLE `leads` ADD `motivoPausa` varchar(240);--> statement-breakpoint
ALTER TABLE `leads` ADD `lastActivityAt` bigint;