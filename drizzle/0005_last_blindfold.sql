CREATE TABLE `settingsChangeLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`settingsId` int NOT NULL,
	`changedByUserId` int,
	`summary` varchar(255) NOT NULL,
	`changedFields` text NOT NULL,
	`previousSnapshot` text NOT NULL,
	`nextSnapshot` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `settingsChangeLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `settingsChangeLogs` ADD CONSTRAINT `settingsChangeLogs_settingsId_appSettings_id_fk` FOREIGN KEY (`settingsId`) REFERENCES `appSettings`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `settingsChangeLogs` ADD CONSTRAINT `settingsChangeLogs_changedByUserId_users_id_fk` FOREIGN KEY (`changedByUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;