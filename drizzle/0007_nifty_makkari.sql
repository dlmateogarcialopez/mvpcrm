CREATE TABLE `automation_rules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(150) NOT NULL,
	`description` text,
	`trigger` varchar(50) NOT NULL,
	`triggerCondition` text,
	`action` varchar(50) NOT NULL,
	`actionData` text,
	`isActive` boolean DEFAULT true,
	`executionCount` int DEFAULT 0,
	`lastExecutedAt` timestamp,
	`createdAt` timestamp DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `automation_rules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `custom_channels` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`icon` varchar(50) DEFAULT 'MessageSquare',
	`isActive` boolean DEFAULT true,
	`createdAt` timestamp DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `custom_channels_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `custom_labels` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(50) NOT NULL,
	`color` varchar(7) DEFAULT '#6b7280',
	`description` text,
	`createdAt` timestamp DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `custom_labels_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `email_campaigns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(150) NOT NULL,
	`subject` varchar(200) NOT NULL,
	`templateId` int,
	`content` text,
	`targetSegment` varchar(50) NOT NULL,
	`targetSegmentData` text,
	`status` varchar(20) DEFAULT 'draft',
	`scheduledAt` timestamp,
	`sentAt` timestamp,
	`totalSent` int DEFAULT 0,
	`totalOpened` int DEFAULT 0,
	`totalClicked` int DEFAULT 0,
	`createdAt` timestamp DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `email_campaigns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `pipeline_stages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`displayName` varchar(100) NOT NULL,
	`color` varchar(7) DEFAULT '#3b82f6',
	`order` int DEFAULT 0,
	`isActive` boolean DEFAULT true,
	`createdAt` timestamp DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `pipeline_stages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `leads` MODIFY COLUMN `estadoLead` varchar(50) NOT NULL DEFAULT 'nuevo';--> statement-breakpoint
ALTER TABLE `leads` MODIFY COLUMN `canalOrigen` varchar(100) NOT NULL DEFAULT 'otro';--> statement-breakpoint
ALTER TABLE `leads` ADD `labels` text;