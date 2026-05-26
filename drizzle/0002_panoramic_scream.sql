CREATE TABLE `leadActivities` (
	`id` int AUTO_INCREMENT NOT NULL,
	`leadId` int NOT NULL,
	`activityType` enum('lead_created','lead_updated','status_changed','note_added','calendar_sync','alert_sent') NOT NULL,
	`title` varchar(160) NOT NULL,
	`description` text,
	`payload` text,
	`createdByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `leadActivities_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `leadCalendarSyncs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`leadId` int NOT NULL,
	`externalCalendarId` varchar(255),
	`externalEventId` varchar(255),
	`syncAction` enum('create','update','skip','error','manual') NOT NULL,
	`syncStatus` enum('pending','success','error') NOT NULL DEFAULT 'pending',
	`requestFingerprint` varchar(255),
	`message` text,
	`triggeredByUserId` int,
	`syncedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `leadCalendarSyncs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `leadActivities` ADD CONSTRAINT `leadActivities_leadId_leads_id_fk` FOREIGN KEY (`leadId`) REFERENCES `leads`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `leadActivities` ADD CONSTRAINT `leadActivities_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `leadCalendarSyncs` ADD CONSTRAINT `leadCalendarSyncs_leadId_leads_id_fk` FOREIGN KEY (`leadId`) REFERENCES `leads`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `leadCalendarSyncs` ADD CONSTRAINT `leadCalendarSyncs_triggeredByUserId_users_id_fk` FOREIGN KEY (`triggeredByUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;