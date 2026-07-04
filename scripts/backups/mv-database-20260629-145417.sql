-- MySQL dump 10.13  Distrib 8.0.46, for Linux (x86_64)
--
-- Host: localhost    Database: cotizador_leads
-- ------------------------------------------------------
-- Server version	8.0.46

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Current Database: `cotizador_leads`
--

/*!40000 DROP DATABASE IF EXISTS `cotizador_leads`*/;

CREATE DATABASE /*!32312 IF NOT EXISTS*/ `cotizador_leads` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci */ /*!80016 DEFAULT ENCRYPTION='N' */;

USE `cotizador_leads`;

--
-- Table structure for table `__drizzle_migrations`
--

DROP TABLE IF EXISTS `__drizzle_migrations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `__drizzle_migrations` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `hash` text NOT NULL,
  `created_at` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `id` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `__drizzle_migrations`
--

LOCK TABLES `__drizzle_migrations` WRITE;
/*!40000 ALTER TABLE `__drizzle_migrations` DISABLE KEYS */;
/*!40000 ALTER TABLE `__drizzle_migrations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `appSettings`
--

DROP TABLE IF EXISTS `appSettings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `appSettings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `configName` varchar(120) NOT NULL DEFAULT 'Configuración principal',
  `isDefault` tinyint(1) NOT NULL DEFAULT '1',
  `precioMultiple` int NOT NULL DEFAULT '99000',
  `precioJunior` int NOT NULL DEFAULT '69000',
  `precioSenior` int NOT NULL DEFAULT '69000',
  `precioParqueadero` int NOT NULL DEFAULT '8000',
  `ticketPromedioReferencia` int NOT NULL DEFAULT '500000',
  `minimoPersonasAmarillo` int NOT NULL DEFAULT '100',
  `minimoPersonasRojo` int NOT NULL DEFAULT '200',
  `minimoValorAmarillo` int NOT NULL DEFAULT '20000000',
  `minimoValorRojo` int NOT NULL DEFAULT '35000000',
  `diasUrgenciaAlta` int NOT NULL DEFAULT '2',
  `horasLeadCaliente` int NOT NULL DEFAULT '1',
  `scoreAltoThreshold` int NOT NULL DEFAULT '65',
  `metaIngresosMensual` int NOT NULL DEFAULT '50000000',
  `comisionPorcentaje` int NOT NULL DEFAULT '5',
  `calendarSyncEnabled` tinyint(1) NOT NULL DEFAULT '0',
  `googleCalendarId` varchar(255) DEFAULT NULL,
  `emailAlertsEnabled` tinyint(1) NOT NULL DEFAULT '0',
  `smsAlertsEnabled` tinyint(1) NOT NULL DEFAULT '0',
  `alertEmailTo` varchar(320) DEFAULT NULL,
  `alertSmsTo` varchar(32) DEFAULT NULL,
  `updatedByUserId` int DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `updatedByUserId` (`updatedByUserId`),
  CONSTRAINT `appSettings_ibfk_1` FOREIGN KEY (`updatedByUserId`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `appSettings`
--

LOCK TABLES `appSettings` WRITE;
/*!40000 ALTER TABLE `appSettings` DISABLE KEYS */;
INSERT INTO `appSettings` VALUES (1,'Configuración principal',1,99000,69000,69000,8000,500000,100,200,20000000,35000000,2,1,65,50000000,5,1,'sportsinsights92@gmail.com',0,0,NULL,NULL,1,'2026-04-22 04:16:07','2026-06-05 19:16:24');
/*!40000 ALTER TABLE `appSettings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `automation_recipients`
--

DROP TABLE IF EXISTS `automation_recipients`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `automation_recipients` (
  `id` int NOT NULL AUTO_INCREMENT,
  `organizationId` int NOT NULL DEFAULT '1',
  `name` varchar(160) NOT NULL,
  `telegramChatId` varchar(64) DEFAULT NULL,
  `email` varchar(320) DEFAULT NULL,
  `notes` text,
  `isActive` tinyint(1) NOT NULL DEFAULT '1',
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_automation_recipients_org` (`organizationId`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `automation_recipients`
--

LOCK TABLES `automation_recipients` WRITE;
/*!40000 ALTER TABLE `automation_recipients` DISABLE KEYS */;
INSERT INTO `automation_recipients` VALUES (1,1,'mateo','622309459','dl.mgarcia@umanizales.edu.co',NULL,1,'2026-06-13 04:43:41','2026-06-13 04:43:41');
/*!40000 ALTER TABLE `automation_recipients` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `automation_rules`
--

DROP TABLE IF EXISTS `automation_rules`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `automation_rules` (
  `id` int NOT NULL AUTO_INCREMENT,
  `organizationId` int NOT NULL DEFAULT '1',
  `name` varchar(150) NOT NULL,
  `description` text,
  `trigger` varchar(50) NOT NULL,
  `triggerCondition` text,
  `action` varchar(50) NOT NULL,
  `actionData` text,
  `isActive` tinyint(1) DEFAULT '1',
  `executionCount` int DEFAULT '0',
  `lastExecutedAt` timestamp NULL DEFAULT NULL,
  `createdAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_automation_rules_org` (`organizationId`)
) ENGINE=InnoDB AUTO_INCREMENT=21 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `automation_rules`
--

LOCK TABLES `automation_rules` WRITE;
/*!40000 ALTER TABLE `automation_rules` DISABLE KEYS */;
INSERT INTO `automation_rules` VALUES (1,1,'Asignar leads nuevos',NULL,'lead_created','','assign_agent','',1,53,'2026-06-26 16:16:29','2026-05-26 20:01:17','2026-06-26 16:16:28'),(2,1,'Alerta para leads urgentes',NULL,'status_changed','','send_telegram','',1,49,'2026-06-26 16:16:29','2026-05-26 20:01:17','2026-06-26 16:16:29'),(10,1,'Nueva Automatización',NULL,'opportunity_won','','send_telegram_to_user','{\"recipientId\":1}',1,3,'2026-06-26 16:09:18','2026-06-13 03:48:39','2026-06-26 16:09:18'),(11,1,'Nueva Automatización',NULL,'after_visit','','send_email','',1,0,NULL,'2026-06-15 04:27:42','2026-06-16 01:22:08'),(12,2,'Asignar leads nuevos',NULL,'lead_created','','assign_agent','',1,47,'2026-06-19 21:51:09','2026-06-19 18:36:39','2026-06-19 21:51:08'),(13,2,'Alerta para leads urgentes',NULL,'status_changed','','send_telegram','',1,14,'2026-06-19 21:51:09','2026-06-19 18:36:39','2026-06-19 21:51:09'),(14,2,'Alerta Telegram por gestión vencida',NULL,'gestion_vencida','','send_telegram','',1,0,NULL,'2026-06-19 18:36:39','2026-06-19 18:36:39'),(15,2,'Etiquetar leads con gestión vencida',NULL,'gestion_vencida','','add_label','gestion vencida',1,0,NULL,'2026-06-19 18:36:39','2026-06-19 18:36:39'),(16,2,'Alerta Telegram: próximo a vencer',NULL,'proxima_a_vencer','3','send_telegram','',1,1,'2026-06-19 18:38:18','2026-06-19 18:36:39','2026-06-19 18:38:17'),(17,2,'Etiquetar leads próximos a vencer',NULL,'proxima_a_vencer','3','add_label','Próximo a vencer',1,1,'2026-06-19 18:38:18','2026-06-19 18:36:39','2026-06-19 18:38:17'),(18,2,'Notificar oportunidad ganada',NULL,'opportunity_won','','send_email_to_user','',1,0,NULL,'2026-06-19 18:36:39','2026-06-19 18:36:39'),(19,2,'Notificar oportunidad perdida',NULL,'opportunity_lost','','send_email_to_user','',1,0,NULL,'2026-06-19 18:36:39','2026-06-19 18:36:39'),(20,2,'Notificar propuesta enviada',NULL,'opportunity_proposal_sent','','send_email_to_user','',1,0,NULL,'2026-06-19 18:36:39','2026-06-19 18:36:39');
/*!40000 ALTER TABLE `automation_rules` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `call_recordings`
--

DROP TABLE IF EXISTS `call_recordings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `call_recordings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `organizationId` int NOT NULL DEFAULT '1',
  `leadId` int DEFAULT NULL,
  `attemptId` int DEFAULT NULL,
  `twilioCallSid` varchar(64) DEFAULT NULL,
  `twilioRecordingSid` varchar(64) DEFAULT NULL,
  `filePath` varchar(500) DEFAULT NULL,
  `durationSec` int NOT NULL DEFAULT '0',
  `status` enum('pending','downloaded','failed') NOT NULL DEFAULT 'pending',
  `downloadedAt` timestamp NULL DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  PRIMARY KEY (`id`),
  KEY `call_recordings_attemptId_fk` (`attemptId`),
  KEY `idx_call_recordings_org` (`organizationId`),
  KEY `idx_call_recordings_lead` (`leadId`),
  CONSTRAINT `call_recordings_attemptId_fk` FOREIGN KEY (`attemptId`) REFERENCES `dial_attempts` (`id`) ON DELETE SET NULL,
  CONSTRAINT `call_recordings_leadId_fk` FOREIGN KEY (`leadId`) REFERENCES `leads` (`id`) ON DELETE SET NULL,
  CONSTRAINT `call_recordings_organizationId_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `call_recordings`
--

LOCK TABLES `call_recordings` WRITE;
/*!40000 ALTER TABLE `call_recordings` DISABLE KEYS */;
/*!40000 ALTER TABLE `call_recordings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `custom_channels`
--

DROP TABLE IF EXISTS `custom_channels`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `custom_channels` (
  `id` int NOT NULL AUTO_INCREMENT,
  `organizationId` int NOT NULL DEFAULT '1',
  `name` varchar(100) NOT NULL,
  `icon` varchar(50) DEFAULT 'MessageSquare',
  `isActive` tinyint(1) DEFAULT '1',
  `createdAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_custom_channels_org` (`organizationId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `custom_channels`
--

LOCK TABLES `custom_channels` WRITE;
/*!40000 ALTER TABLE `custom_channels` DISABLE KEYS */;
/*!40000 ALTER TABLE `custom_channels` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `custom_labels`
--

DROP TABLE IF EXISTS `custom_labels`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `custom_labels` (
  `id` int NOT NULL AUTO_INCREMENT,
  `organizationId` int NOT NULL DEFAULT '1',
  `name` varchar(50) NOT NULL,
  `color` varchar(20) NOT NULL,
  `isActive` tinyint(1) DEFAULT '1',
  `createdAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `description` text,
  PRIMARY KEY (`id`),
  KEY `idx_custom_labels_org` (`organizationId`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `custom_labels`
--

LOCK TABLES `custom_labels` WRITE;
/*!40000 ALTER TABLE `custom_labels` DISABLE KEYS */;
INSERT INTO `custom_labels` VALUES (1,1,'VIP','#d97706',1,'2026-05-27 03:50:54','2026-05-27 03:50:54','Clientes muy importantes'),(2,1,'Frecuente','#2563eb',1,'2026-05-27 03:50:55','2026-05-27 03:50:55','Clientes recurrentes'),(3,1,'Nuevo Evento','#16a34a',1,'2026-05-27 03:50:55','2026-05-27 03:50:55','Oportunidad reciente'),(4,2,'VIP','#d97706',1,'2026-06-23 15:02:35','2026-06-23 15:02:35','Clientes muy importantes'),(5,2,'Frecuente','#2563eb',1,'2026-06-23 15:02:35','2026-06-23 15:02:35','Clientes recurrentes'),(6,2,'Nuevo Evento','#16a34a',1,'2026-06-23 15:02:35','2026-06-23 15:02:35','Oportunidad reciente');
/*!40000 ALTER TABLE `custom_labels` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `dial_attempts`
--

DROP TABLE IF EXISTS `dial_attempts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `dial_attempts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `organizationId` int NOT NULL DEFAULT '1',
  `queueId` int NOT NULL,
  `queueLeadId` int NOT NULL,
  `leadId` int NOT NULL,
  `userId` int NOT NULL,
  `twilioCallSid` varchar(64) DEFAULT NULL,
  `status` enum('initiated','ringing','in_progress','completed','busy','failed','no_answer') NOT NULL DEFAULT 'initiated',
  `initiatedAt` timestamp NOT NULL DEFAULT (now()),
  `answeredAt` timestamp NULL DEFAULT NULL,
  `endedAt` timestamp NULL DEFAULT NULL,
  `durationSec` int DEFAULT NULL,
  `whatsappMessageSid` varchar(64) DEFAULT NULL,
  `whatsappSentAt` timestamp NULL DEFAULT NULL,
  `agentMarkedOutcome` enum('answered','no_answer') DEFAULT NULL,
  `agentMarkedAt` timestamp NULL DEFAULT NULL,
  `recordingUrl` varchar(500) DEFAULT NULL,
  `notes` text,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  PRIMARY KEY (`id`),
  KEY `dial_attempts_queueId_fk` (`queueId`),
  KEY `dial_attempts_queueLeadId_fk` (`queueLeadId`),
  KEY `dial_attempts_userId_fk` (`userId`),
  KEY `idx_dial_attempts_org` (`organizationId`,`createdAt`),
  KEY `idx_dial_attempts_lead` (`leadId`),
  CONSTRAINT `dial_attempts_leadId_fk` FOREIGN KEY (`leadId`) REFERENCES `leads` (`id`) ON DELETE CASCADE,
  CONSTRAINT `dial_attempts_organizationId_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `dial_attempts_queueId_fk` FOREIGN KEY (`queueId`) REFERENCES `dialing_queues` (`id`) ON DELETE CASCADE,
  CONSTRAINT `dial_attempts_queueLeadId_fk` FOREIGN KEY (`queueLeadId`) REFERENCES `dialing_queue_leads` (`id`) ON DELETE CASCADE,
  CONSTRAINT `dial_attempts_userId_fk` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `dial_attempts`
--

LOCK TABLES `dial_attempts` WRITE;
/*!40000 ALTER TABLE `dial_attempts` DISABLE KEYS */;
/*!40000 ALTER TABLE `dial_attempts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `dialing_queue_leads`
--

DROP TABLE IF EXISTS `dialing_queue_leads`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `dialing_queue_leads` (
  `id` int NOT NULL AUTO_INCREMENT,
  `organizationId` int NOT NULL DEFAULT '1',
  `queueId` int NOT NULL,
  `leadId` int NOT NULL,
  `position` int NOT NULL,
  `status` enum('pending','calling','answered','no_answer','skipped','exhausted','completed') NOT NULL DEFAULT 'pending',
  `attempts` int NOT NULL DEFAULT '0',
  `lastAttemptId` int DEFAULT NULL,
  `lastOutcome` enum('answered','no_answer','busy','failed','skipped') DEFAULT NULL,
  `lastAttemptAt` timestamp NULL DEFAULT NULL,
  `completedAt` timestamp NULL DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_dialing_queue_leads_queue_lead` (`queueId`,`leadId`),
  KEY `dialing_queue_leads_leadId_fk` (`leadId`),
  KEY `idx_dialing_queue_leads_org` (`organizationId`),
  KEY `idx_dialing_queue_leads_status` (`queueId`,`status`,`position`),
  CONSTRAINT `dialing_queue_leads_leadId_fk` FOREIGN KEY (`leadId`) REFERENCES `leads` (`id`) ON DELETE CASCADE,
  CONSTRAINT `dialing_queue_leads_organizationId_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `dialing_queue_leads_queueId_fk` FOREIGN KEY (`queueId`) REFERENCES `dialing_queues` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `dialing_queue_leads`
--

LOCK TABLES `dialing_queue_leads` WRITE;
/*!40000 ALTER TABLE `dialing_queue_leads` DISABLE KEYS */;
/*!40000 ALTER TABLE `dialing_queue_leads` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `dialing_queues`
--

DROP TABLE IF EXISTS `dialing_queues`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `dialing_queues` (
  `id` int NOT NULL AUTO_INCREMENT,
  `organizationId` int NOT NULL DEFAULT '1',
  `name` varchar(200) NOT NULL,
  `ownerUserId` int NOT NULL,
  `leadFilter` text,
  `maxAttempts` int NOT NULL DEFAULT '1',
  `retryDelayMinutes` int NOT NULL DEFAULT '60',
  `callDelayMs` int NOT NULL DEFAULT '3000',
  `callerIdNumber` varchar(32) NOT NULL DEFAULT '',
  `whatsappNoAnswerTemplateName` varchar(120) DEFAULT NULL,
  `whatsappNoAnswerTemplateVars` text,
  `status` enum('draft','active','paused','completed','cancelled') NOT NULL DEFAULT 'draft',
  `currentLeadId` int DEFAULT NULL,
  `totalLeads` int NOT NULL DEFAULT '0',
  `completedLeads` int NOT NULL DEFAULT '0',
  `startedAt` timestamp NULL DEFAULT NULL,
  `pausedAt` timestamp NULL DEFAULT NULL,
  `completedAt` timestamp NULL DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `dialing_queues_ownerUserId_fk` (`ownerUserId`),
  KEY `dialing_queues_currentLeadId_fk` (`currentLeadId`),
  KEY `idx_dialing_queues_org` (`organizationId`),
  KEY `idx_dialing_queues_status` (`organizationId`,`status`),
  CONSTRAINT `dialing_queues_currentLeadId_fk` FOREIGN KEY (`currentLeadId`) REFERENCES `leads` (`id`) ON DELETE SET NULL,
  CONSTRAINT `dialing_queues_organizationId_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `dialing_queues_ownerUserId_fk` FOREIGN KEY (`ownerUserId`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `dialing_queues`
--

LOCK TABLES `dialing_queues` WRITE;
/*!40000 ALTER TABLE `dialing_queues` DISABLE KEYS */;
/*!40000 ALTER TABLE `dialing_queues` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `email_campaigns`
--

DROP TABLE IF EXISTS `email_campaigns`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `email_campaigns` (
  `id` int NOT NULL AUTO_INCREMENT,
  `organizationId` int NOT NULL DEFAULT '1',
  `name` varchar(150) NOT NULL,
  `subject` varchar(200) NOT NULL,
  `templateId` int DEFAULT NULL,
  `content` text,
  `targetSegment` varchar(50) NOT NULL,
  `targetSegmentData` text,
  `status` varchar(20) DEFAULT 'draft',
  `scheduledAt` timestamp NULL DEFAULT NULL,
  `sentAt` timestamp NULL DEFAULT NULL,
  `totalSent` int DEFAULT '0',
  `totalOpened` int DEFAULT '0',
  `totalClicked` int DEFAULT '0',
  `createdAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_email_campaigns_org` (`organizationId`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `email_campaigns`
--

LOCK TABLES `email_campaigns` WRITE;
/*!40000 ALTER TABLE `email_campaigns` DISABLE KEYS */;
INSERT INTO `email_campaigns` VALUES (5,1,'prueba','prueba',NULL,'prueba','stage','nuevo','sent',NULL,'2026-05-28 23:09:32',0,0,0,'2026-05-28 23:09:28','2026-05-28 23:09:31'),(6,1,'prueba','prueba',NULL,'prueba','stage','nuevo','sent',NULL,'2026-05-29 00:35:20',1,0,0,'2026-05-29 00:35:14','2026-05-29 00:35:19'),(7,1,'Campaña de prueba','Campaña de prueba',NULL,'Campaña de prueba','stage','nuevo','sent',NULL,'2026-05-29 17:47:12',1,0,0,'2026-05-29 17:47:00','2026-05-29 17:47:12'),(8,1,'prueba','prueba',NULL,'prueba','stage','nuevo','sent',NULL,'2026-06-03 17:46:40',1,0,0,'2026-06-03 17:46:35','2026-06-03 17:46:39');
/*!40000 ALTER TABLE `email_campaigns` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `leadActivities`
--

DROP TABLE IF EXISTS `leadActivities`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `leadActivities` (
  `id` int NOT NULL AUTO_INCREMENT,
  `organizationId` int NOT NULL DEFAULT '1',
  `leadId` int NOT NULL,
  `activityType` enum('lead_created','lead_updated','status_changed','note_added','assignment_changed','sensitive_fields_changed','calendar_sync','alert_sent','automation','call_attempt','call_answered','call_no_answer','sms_sent','sms_received') NOT NULL,
  `title` varchar(255) NOT NULL,
  `description` text,
  `payload` json DEFAULT NULL,
  `isSystem` tinyint(1) DEFAULT '0',
  `createdByUserId` int DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_lead_activities_org` (`organizationId`)
) ENGINE=InnoDB AUTO_INCREMENT=153 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `leadActivities`
--

LOCK TABLES `leadActivities` WRITE;
/*!40000 ALTER TABLE `leadActivities` DISABLE KEYS */;
INSERT INTO `leadActivities` VALUES (1,1,1,'lead_created','Lead creado','Lead LEAD-5HLEUMUU creado con prioridad verde.','{\"prioridad\": \"verde\", \"scoreTotal\": 35, \"valorTotal\": 99000, \"agenteResponsable\": \"Super Admin\"}',0,1,'2026-05-04 02:38:49','2026-05-04 02:38:49'),(2,1,1,'calendar_sync','Sincronización de calendario','La sincronización con Google Calendar está desactivada en configuración.','{\"syncAction\": \"skip\", \"syncStatus\": \"success\", \"externalEventId\": null}',1,1,'2026-05-04 02:38:50','2026-05-04 02:38:50'),(3,1,2,'lead_created','Lead creado','Lead LEAD-M9P1V5PG creado con prioridad amarillo.','{\"prioridad\": \"amarillo\", \"scoreTotal\": 60, \"valorTotal\": 880000, \"agenteResponsable\": \"Super Admin\"}',0,1,'2026-05-05 22:21:07','2026-05-05 22:21:07'),(4,1,2,'calendar_sync','Sincronización de calendario','La sincronización con Google Calendar está desactivada en configuración.','{\"syncAction\": \"skip\", \"syncStatus\": \"success\", \"externalEventId\": null}',1,1,'2026-05-05 22:21:07','2026-05-05 22:21:07'),(5,1,2,'lead_updated','Lead actualizado','Lead LEAD-M9P1V5PG actualizado por Super Admin.','{\"prioridad\": \"verde\", \"scoreTotal\": 57, \"valorTotal\": 880000}',0,1,'2026-05-06 03:51:01','2026-05-06 03:51:01'),(6,1,2,'sensitive_fields_changed','Cambios sensibles registrados','Se ajustaron fecha de visita, prioridad.','{\"fields\": [{\"after\": \"9/5/2026, 10:19:00 p. m.\", \"label\": \"fecha de visita\", \"before\": \"6/5/2026, 10:19:33 p. m.\"}, {\"after\": \"verde\", \"label\": \"prioridad\", \"before\": \"amarillo\"}]}',0,1,'2026-05-06 03:51:01','2026-05-06 03:51:01'),(7,1,2,'calendar_sync','Sincronización de calendario','La sincronización con Google Calendar está desactivada en configuración.','{\"syncAction\": \"skip\", \"syncStatus\": \"success\", \"externalEventId\": null}',1,1,'2026-05-06 03:51:01','2026-05-06 03:51:01'),(8,1,2,'lead_updated','Lead actualizado','Lead LEAD-M9P1V5PG actualizado por Super Admin.','{\"prioridad\": \"verde\", \"scoreTotal\": 57, \"valorTotal\": 880000}',0,1,'2026-05-06 04:16:03','2026-05-06 04:16:03'),(9,1,2,'status_changed','Estado actualizado','Cambio de estado de Nuevo a Contactado.','{\"after\": \"contactado\", \"before\": \"nuevo\"}',0,1,'2026-05-06 04:16:03','2026-05-06 04:16:03'),(10,1,2,'calendar_sync','Sincronización de calendario','La sincronización con Google Calendar está desactivada en configuración.','{\"syncAction\": \"skip\", \"syncStatus\": \"success\", \"externalEventId\": null}',1,1,'2026-05-06 04:16:03','2026-05-06 04:16:03'),(11,1,2,'lead_updated','Lead actualizado','Lead LEAD-M9P1V5PG actualizado por Super Admin.','{\"prioridad\": \"verde\", \"scoreTotal\": 57, \"valorTotal\": 880000}',0,1,'2026-05-06 04:16:10','2026-05-06 04:16:10'),(12,1,2,'status_changed','Estado actualizado','Cambio de estado de Contactado a Nuevo.','{\"after\": \"nuevo\", \"before\": \"contactado\"}',0,1,'2026-05-06 04:16:10','2026-05-06 04:16:10'),(13,1,2,'calendar_sync','Sincronización de calendario','La sincronización con Google Calendar está desactivada en configuración.','{\"syncAction\": \"skip\", \"syncStatus\": \"success\", \"externalEventId\": null}',1,1,'2026-05-06 04:16:10','2026-05-06 04:16:10'),(14,1,2,'lead_updated','Lead actualizado','Lead LEAD-M9P1V5PG actualizado por Super Admin.','{\"prioridad\": \"amarillo\", \"scoreTotal\": 56, \"valorTotal\": 880000}',0,1,'2026-05-08 21:13:35','2026-05-08 21:13:35'),(15,1,2,'status_changed','Estado actualizado','Cambio de estado de Nuevo a Contactado.','{\"after\": \"contactado\", \"before\": \"nuevo\"}',0,1,'2026-05-08 21:13:35','2026-05-08 21:13:35'),(16,1,2,'sensitive_fields_changed','Cambios sensibles registrados','Se ajustaron prioridad.','{\"fields\": [{\"after\": \"amarillo\", \"label\": \"prioridad\", \"before\": \"verde\"}]}',0,1,'2026-05-08 21:13:35','2026-05-08 21:13:35'),(17,1,2,'calendar_sync','Sincronización de calendario','La sincronización con Google Calendar está desactivada en configuración.','{\"syncAction\": \"skip\", \"syncStatus\": \"success\", \"externalEventId\": null}',1,1,'2026-05-08 21:13:36','2026-05-08 21:13:36'),(18,1,1,'lead_updated','Lead actualizado','Lead LEAD-5HLEUMUU actualizado por Super Admin.','{\"prioridad\": \"verde\", \"scoreTotal\": 31, \"valorTotal\": 99000}',0,1,'2026-05-08 21:16:36','2026-05-08 21:16:36'),(19,1,1,'status_changed','Estado actualizado','Cambio de estado de Nuevo a Calificado.','{\"after\": \"calificado\", \"before\": \"nuevo\"}',0,1,'2026-05-08 21:16:36','2026-05-08 21:16:36'),(20,1,1,'calendar_sync','Sincronización de calendario','La sincronización con Google Calendar está desactivada en configuración.','{\"syncAction\": \"skip\", \"syncStatus\": \"success\", \"externalEventId\": null}',1,1,'2026-05-08 21:16:37','2026-05-08 21:16:37'),(21,1,3,'lead_created','Lead creado','Lead LEAD-KXORNICH creado con prioridad amarillo.','{\"prioridad\": \"amarillo\", \"scoreTotal\": 56, \"valorTotal\": 633000, \"agenteResponsable\": \"Super Admin\"}',0,1,'2026-05-08 21:18:54','2026-05-08 21:18:54'),(22,1,3,'calendar_sync','Sincronización de calendario','La sincronización con Google Calendar está desactivada en configuración.','{\"syncAction\": \"skip\", \"syncStatus\": \"success\", \"externalEventId\": null}',1,1,'2026-05-08 21:18:54','2026-05-08 21:18:54'),(23,1,3,'lead_updated','Lead actualizado','Lead LEAD-KXORNICH actualizado por Super Admin.','{\"prioridad\": \"rojo\", \"scoreTotal\": 68, \"valorTotal\": 1029000}',0,1,'2026-05-08 21:20:02','2026-05-08 21:20:02'),(24,1,3,'sensitive_fields_changed','Cambios sensibles registrados','Se ajustaron prioridad, valor estimado.','{\"fields\": [{\"after\": \"rojo\", \"label\": \"prioridad\", \"before\": \"amarillo\"}, {\"after\": \"$ 1.029.000\", \"label\": \"valor estimado\", \"before\": \"$ 633.000\"}]}',0,1,'2026-05-08 21:20:03','2026-05-08 21:20:03'),(25,1,3,'calendar_sync','Sincronización de calendario','La sincronización con Google Calendar está desactivada en configuración.','{\"syncAction\": \"skip\", \"syncStatus\": \"success\", \"externalEventId\": null}',1,1,'2026-05-08 21:20:03','2026-05-08 21:20:03'),(26,1,3,'lead_updated','Lead actualizado','Lead LEAD-KXORNICH actualizado por Super Admin.','{\"prioridad\": \"rojo\", \"scoreTotal\": 68, \"valorTotal\": 1029000}',0,1,'2026-05-08 21:20:19','2026-05-08 21:20:19'),(27,1,3,'status_changed','Estado actualizado','Cambio de estado de Nuevo a Contactado.','{\"after\": \"contactado\", \"before\": \"nuevo\"}',0,1,'2026-05-08 21:20:19','2026-05-08 21:20:19'),(28,1,3,'calendar_sync','Sincronización de calendario','La sincronización con Google Calendar está desactivada en configuración.','{\"syncAction\": \"skip\", \"syncStatus\": \"success\", \"externalEventId\": null}',1,1,'2026-05-08 21:20:19','2026-05-08 21:20:19'),(29,1,1,'lead_updated','Lead actualizado','Lead LEAD-5HLEUMUU actualizado por Super Admin.','{\"prioridad\": \"verde\", \"scoreTotal\": 31, \"valorTotal\": 99000}',0,1,'2026-05-26 03:49:44','2026-05-26 03:49:44'),(30,1,1,'status_changed','Estado actualizado','Cambio de estado de Calificado a Propuesta enviada.','{\"after\": \"propuesta\", \"before\": \"calificado\"}',0,1,'2026-05-26 03:49:44','2026-05-26 03:49:44'),(31,1,1,'calendar_sync','Sincronización de calendario','La sincronización con Google Calendar está desactivada en configuración.','{\"syncAction\": \"skip\", \"syncStatus\": \"success\", \"externalEventId\": null}',1,1,'2026-05-26 03:49:44','2026-05-26 03:49:44'),(32,1,1,'lead_updated','Lead actualizado','Lead LEAD-5HLEUMUU actualizado por Super Admin.','{\"prioridad\": \"verde\", \"scoreTotal\": 31, \"valorTotal\": 99000}',0,1,'2026-05-26 03:50:05','2026-05-26 03:50:05'),(33,1,1,'status_changed','Estado actualizado','Cambio de estado de Propuesta enviada a Calificado.','{\"after\": \"calificado\", \"before\": \"propuesta\"}',0,1,'2026-05-26 03:50:05','2026-05-26 03:50:05'),(34,1,1,'calendar_sync','Sincronización de calendario','La sincronización con Google Calendar está desactivada en configuración.','{\"syncAction\": \"skip\", \"syncStatus\": \"success\", \"externalEventId\": null}',1,1,'2026-05-26 03:50:05','2026-05-26 03:50:05'),(35,1,3,'lead_updated','Lead actualizado','Lead LEAD-KXORNICH actualizado por Super Admin.','{\"prioridad\": \"amarillo\", \"scoreTotal\": 64, \"valorTotal\": 1029000}',0,1,'2026-05-26 04:04:56','2026-05-26 04:04:56'),(36,1,3,'status_changed','Estado actualizado','Cambio de estado de Contactado a Calificado.','{\"after\": \"calificado\", \"before\": \"contactado\"}',0,1,'2026-05-26 04:04:56','2026-05-26 04:04:56'),(37,1,3,'sensitive_fields_changed','Cambios sensibles registrados','Se ajustaron prioridad.','{\"fields\": [{\"after\": \"amarillo\", \"label\": \"prioridad\", \"before\": \"rojo\"}]}',0,1,'2026-05-26 04:04:56','2026-05-26 04:04:56'),(38,1,3,'calendar_sync','Sincronización de calendario','La sincronización con Google Calendar está desactivada en configuración.','{\"syncAction\": \"skip\", \"syncStatus\": \"success\", \"externalEventId\": null}',1,1,'2026-05-26 04:04:56','2026-05-26 04:04:56'),(39,1,3,'lead_updated','Lead actualizado','Lead LEAD-KXORNICH actualizado por Super Admin.','{\"prioridad\": \"amarillo\", \"scoreTotal\": 64, \"valorTotal\": 1029000}',0,1,'2026-05-26 04:05:03','2026-05-26 04:05:03'),(40,1,3,'status_changed','Estado actualizado','Cambio de estado de Calificado a Contactado.','{\"after\": \"contactado\", \"before\": \"calificado\"}',0,1,'2026-05-26 04:05:03','2026-05-26 04:05:03'),(41,1,3,'calendar_sync','Sincronización de calendario','La sincronización con Google Calendar está desactivada en configuración.','{\"syncAction\": \"skip\", \"syncStatus\": \"success\", \"externalEventId\": null}',1,1,'2026-05-26 04:05:04','2026-05-26 04:05:04'),(42,1,3,'lead_updated','Lead actualizado','Lead LEAD-KXORNICH actualizado por Super Admin.','{\"prioridad\": \"amarillo\", \"scoreTotal\": 64, \"valorTotal\": 1029000}',0,1,'2026-05-26 20:01:27','2026-05-26 20:01:27'),(43,1,3,'status_changed','Estado actualizado','Cambio de estado de Contactado a Nuevo.','{\"after\": \"nuevo\", \"before\": \"contactado\"}',0,1,'2026-05-26 20:01:27','2026-05-26 20:01:27'),(44,1,3,'calendar_sync','Sincronización de calendario','La sincronización con Google Calendar está desactivada en configuración.','{\"syncAction\": \"skip\", \"syncStatus\": \"success\", \"externalEventId\": null}',1,1,'2026-05-26 20:01:27','2026-05-26 20:01:27'),(45,1,3,'lead_updated','Lead actualizado','Lead LEAD-KXORNICH actualizado por Super Admin.','{\"prioridad\": \"amarillo\", \"scoreTotal\": 64, \"valorTotal\": 1029000}',0,1,'2026-05-26 20:01:50','2026-05-26 20:01:50'),(46,1,3,'status_changed','Estado actualizado','Cambio de estado de Nuevo a Contactado.','{\"after\": \"contactado\", \"before\": \"nuevo\"}',0,1,'2026-05-26 20:01:50','2026-05-26 20:01:50'),(47,1,3,'calendar_sync','Sincronización de calendario','La sincronización con Google Calendar está desactivada en configuración.','{\"syncAction\": \"skip\", \"syncStatus\": \"success\", \"externalEventId\": null}',1,1,'2026-05-26 20:01:50','2026-05-26 20:01:50'),(48,1,1,'lead_updated','Lead actualizado','Lead LEAD-5HLEUMUU actualizado por Super Admin.','{\"prioridad\": \"verde\", \"scoreTotal\": 31, \"valorTotal\": 99000}',0,1,'2026-05-26 20:01:58','2026-05-26 20:01:58'),(49,1,1,'status_changed','Estado actualizado','Cambio de estado de Calificado a Propuesta enviada.','{\"after\": \"propuesta\", \"before\": \"calificado\"}',0,1,'2026-05-26 20:01:58','2026-05-26 20:01:58'),(50,1,1,'calendar_sync','Sincronización de calendario','La sincronización con Google Calendar está desactivada en configuración.','{\"syncAction\": \"skip\", \"syncStatus\": \"success\", \"externalEventId\": null}',1,1,'2026-05-26 20:01:58','2026-05-26 20:01:58'),(51,1,1,'lead_updated','Lead actualizado','Lead LEAD-5HLEUMUU actualizado por Super Admin.','{\"prioridad\": \"verde\", \"scoreTotal\": 31, \"valorTotal\": 99000}',0,1,'2026-05-26 20:02:00','2026-05-26 20:02:00'),(52,1,1,'status_changed','Estado actualizado','Cambio de estado de Propuesta enviada a Calificado.','{\"after\": \"calificado\", \"before\": \"propuesta\"}',0,1,'2026-05-26 20:02:00','2026-05-26 20:02:00'),(53,1,1,'calendar_sync','Sincronización de calendario','La sincronización con Google Calendar está desactivada en configuración.','{\"syncAction\": \"skip\", \"syncStatus\": \"success\", \"externalEventId\": null}',1,1,'2026-05-26 20:02:00','2026-05-26 20:02:00'),(54,1,4,'lead_created','Lead creado','Lead LEAD-XYRF4O5O creado con prioridad amarillo.','{\"prioridad\": \"amarillo\", \"scoreTotal\": 58, \"valorTotal\": 693000, \"agenteResponsable\": \"Super Admin\"}',0,1,'2026-05-27 03:55:06','2026-05-27 03:55:06'),(55,1,4,'calendar_sync','Sincronización de calendario','La sincronización con Google Calendar está desactivada en configuración.','{\"syncAction\": \"skip\", \"syncStatus\": \"success\", \"externalEventId\": null}',1,1,'2026-05-27 03:55:07','2026-05-27 03:55:07'),(56,1,4,'lead_updated','Lead actualizado','Lead LEAD-XYRF4O5O actualizado por Super Admin.','{\"prioridad\": \"amarillo\", \"scoreTotal\": 58, \"valorTotal\": 693000}',0,1,'2026-05-27 04:25:04','2026-05-27 04:25:04'),(57,1,4,'calendar_sync','Sincronización de calendario','La sincronización con Google Calendar está desactivada en configuración.','{\"syncAction\": \"skip\", \"syncStatus\": \"success\", \"externalEventId\": null}',1,1,'2026-05-27 04:25:04','2026-05-27 04:25:04'),(58,1,5,'lead_created','Lead creado','Lead LEAD-TILNGGCI creado con prioridad verde.','{\"prioridad\": \"verde\", \"scoreTotal\": 61, \"valorTotal\": 1473000, \"agenteResponsable\": \"Super Admin\"}',0,1,'2026-05-27 18:13:16','2026-05-27 18:13:16'),(59,1,5,'calendar_sync','Sincronización de calendario','La sincronización con Google Calendar está desactivada en configuración.','{\"syncAction\": \"skip\", \"syncStatus\": \"success\", \"externalEventId\": null}',1,1,'2026-05-27 18:13:16','2026-05-27 18:13:16'),(60,1,5,'lead_updated','Lead actualizado','Lead LEAD-TILNGGCI actualizado por Super Admin.','{\"prioridad\": \"verde\", \"scoreTotal\": 61, \"valorTotal\": 1473000}',0,1,'2026-05-28 23:07:13','2026-05-28 23:07:13'),(61,1,5,'status_changed','Estado actualizado','Cambio de estado de Nuevo a Contactado.','{\"after\": \"contactado\", \"before\": \"nuevo\"}',0,1,'2026-05-28 23:07:13','2026-05-28 23:07:13'),(62,1,5,'calendar_sync','Sincronización de calendario','La sincronización con Google Calendar está desactivada en configuración.','{\"syncAction\": \"skip\", \"syncStatus\": \"success\", \"externalEventId\": null}',1,1,'2026-05-28 23:07:13','2026-05-28 23:07:13'),(63,1,4,'lead_updated','Lead actualizado','Lead LEAD-XYRF4O5O actualizado por Super Admin.','{\"prioridad\": \"amarillo\", \"scoreTotal\": 55, \"valorTotal\": 693000}',0,1,'2026-05-28 23:09:02','2026-05-28 23:09:02'),(64,1,4,'calendar_sync','Sincronización de calendario','La sincronización con Google Calendar está desactivada en configuración.','{\"syncAction\": \"skip\", \"syncStatus\": \"success\", \"externalEventId\": null}',1,1,'2026-05-28 23:09:03','2026-05-28 23:09:03'),(65,1,4,'lead_updated','Lead actualizado','Lead LEAD-XYRF4O5O actualizado por Super Admin.','{\"prioridad\": \"amarillo\", \"scoreTotal\": 54, \"valorTotal\": 693000}',0,1,'2026-05-29 17:16:40','2026-05-29 17:16:40'),(66,1,4,'status_changed','Estado actualizado','Cambio de estado de Nuevo a Contactado.','{\"after\": \"contactado\", \"before\": \"nuevo\"}',0,1,'2026-05-29 17:16:40','2026-05-29 17:16:40'),(67,1,4,'sensitive_fields_changed','Cambios sensibles registrados','Se ajustaron próximo paso.','{\"fields\": [{\"after\": \"sin dato\", \"label\": \"próximo paso\", \"before\": \"enviar correo\"}]}',0,1,'2026-05-29 17:16:40','2026-05-29 17:16:40'),(68,1,4,'calendar_sync','Sincronización de calendario','La sincronización con Google Calendar está desactivada en configuración.','{\"syncAction\": \"skip\", \"syncStatus\": \"success\", \"externalEventId\": null}',1,1,'2026-05-29 17:16:41','2026-05-29 17:16:41'),(69,1,4,'lead_updated','Lead actualizado','Lead LEAD-XYRF4O5O actualizado por Super Admin.','{\"prioridad\": \"amarillo\", \"scoreTotal\": 54, \"valorTotal\": 693000}',0,1,'2026-05-29 17:17:16','2026-05-29 17:17:16'),(70,1,4,'status_changed','Estado actualizado','Cambio de estado de Contactado a Nuevo.','{\"after\": \"nuevo\", \"before\": \"contactado\"}',0,1,'2026-05-29 17:17:16','2026-05-29 17:17:16'),(71,1,4,'calendar_sync','Sincronización de calendario','La sincronización con Google Calendar está desactivada en configuración.','{\"syncAction\": \"skip\", \"syncStatus\": \"success\", \"externalEventId\": null}',1,1,'2026-05-29 17:17:17','2026-05-29 17:17:17'),(72,1,4,'lead_updated','Lead actualizado','Lead LEAD-XYRF4O5O actualizado por Super Admin.','{\"prioridad\": \"amarillo\", \"scoreTotal\": 54, \"valorTotal\": 693000}',0,1,'2026-06-03 17:43:21','2026-06-03 17:43:21'),(73,1,4,'status_changed','Estado actualizado','Cambio de estado de Nuevo a Contactado.','{\"after\": \"contactado\", \"before\": \"nuevo\"}',0,1,'2026-06-03 17:43:21','2026-06-03 17:43:21'),(74,1,4,'calendar_sync','Sincronización de calendario','La sincronización con Google Calendar está desactivada en configuración.','{\"syncAction\": \"skip\", \"syncStatus\": \"success\", \"externalEventId\": null}',1,1,'2026-06-03 17:43:21','2026-06-03 17:43:21'),(75,1,4,'lead_updated','Lead actualizado','Lead LEAD-XYRF4O5O actualizado por Super Admin.','{\"prioridad\": \"amarillo\", \"scoreTotal\": 54, \"valorTotal\": 693000}',0,1,'2026-06-03 17:43:42','2026-06-03 17:43:42'),(76,1,4,'status_changed','Estado actualizado','Cambio de estado de Contactado a Nuevo.','{\"after\": \"nuevo\", \"before\": \"contactado\"}',0,1,'2026-06-03 17:43:42','2026-06-03 17:43:42'),(77,1,4,'calendar_sync','Sincronización de calendario','La sincronización con Google Calendar está desactivada en configuración.','{\"syncAction\": \"skip\", \"syncStatus\": \"success\", \"externalEventId\": null}',1,1,'2026-06-03 17:43:42','2026-06-03 17:43:42'),(78,1,1,'lead_updated','Lead actualizado','Lead LEAD-5HLEUMUU actualizado por Super Admin.','{\"prioridad\": \"verde\", \"scoreTotal\": 31, \"valorTotal\": 99000}',0,1,'2026-06-03 17:43:52','2026-06-03 17:43:52'),(79,1,1,'status_changed','Estado actualizado','Cambio de estado de Calificado a Ganado.','{\"after\": \"ganado\", \"before\": \"calificado\"}',0,1,'2026-06-03 17:43:52','2026-06-03 17:43:52'),(80,1,1,'calendar_sync','Sincronización de calendario','La sincronización con Google Calendar está desactivada en configuración.','{\"syncAction\": \"skip\", \"syncStatus\": \"success\", \"externalEventId\": null}',1,1,'2026-06-03 17:43:52','2026-06-03 17:43:52'),(81,1,4,'lead_updated','Lead actualizado','Lead LEAD-XYRF4O5O actualizado por Super Admin.','{\"prioridad\": \"verde\", \"scoreTotal\": 52, \"valorTotal\": 693000}',0,1,'2026-06-05 18:22:21','2026-06-05 18:22:21'),(82,1,4,'sensitive_fields_changed','Cambios sensibles registrados','Se ajustaron fecha de visita, prioridad.','{\"fields\": [{\"after\": \"10/6/2026, 3:51:00 a. m.\", \"label\": \"fecha de visita\", \"before\": \"30/5/2026, 3:51:00 a. m.\"}, {\"after\": \"verde\", \"label\": \"prioridad\", \"before\": \"amarillo\"}]}',0,1,'2026-06-05 18:22:21','2026-06-05 18:22:21'),(83,1,4,'calendar_sync','Sincronización de calendario','Google Calendar API has not been used in project 941743786158 before or it is disabled. Enable it by visiting https://console.developers.google.com/apis/api/calendar-json.googleapis.com/overview?project=941743786158 then retry. If you enabled this API recently, wait a few minutes for the action to propagate to our systems and retry.','{\"syncAction\": \"error\", \"syncStatus\": \"error\", \"externalEventId\": null}',1,1,'2026-06-05 18:22:22','2026-06-05 18:22:22'),(84,1,4,'calendar_sync','Sincronización de calendario','Google Calendar API has not been used in project 941743786158 before or it is disabled. Enable it by visiting https://console.developers.google.com/apis/api/calendar-json.googleapis.com/overview?project=941743786158 then retry. If you enabled this API recently, wait a few minutes for the action to propagate to our systems and retry.','{\"syncAction\": \"error\", \"syncStatus\": \"error\", \"externalEventId\": null}',1,1,'2026-06-05 18:23:36','2026-06-05 18:23:36'),(85,1,4,'lead_updated','Lead actualizado','Lead LEAD-XYRF4O5O actualizado por Super Admin.','{\"prioridad\": \"verde\", \"scoreTotal\": 52, \"valorTotal\": 693000}',0,1,'2026-06-05 19:16:44','2026-06-05 19:16:44'),(86,1,4,'sensitive_fields_changed','Cambios sensibles registrados','Se ajustaron fecha de visita.','{\"fields\": [{\"after\": \"11/6/2026, 3:51:00 a. m.\", \"label\": \"fecha de visita\", \"before\": \"10/6/2026, 3:51:00 a. m.\"}]}',0,1,'2026-06-05 19:16:44','2026-06-05 19:16:44'),(87,1,4,'calendar_sync','Sincronización de calendario','Google Calendar API has not been used in project 941743786158 before or it is disabled. Enable it by visiting https://console.developers.google.com/apis/api/calendar-json.googleapis.com/overview?project=941743786158 then retry. If you enabled this API recently, wait a few minutes for the action to propagate to our systems and retry.','{\"syncAction\": \"error\", \"syncStatus\": \"error\", \"externalEventId\": null}',1,1,'2026-06-05 19:16:45','2026-06-05 19:16:45'),(88,1,4,'lead_updated','Lead actualizado','Lead LEAD-XYRF4O5O actualizado por Super Admin.','{\"prioridad\": \"verde\", \"scoreTotal\": 52, \"valorTotal\": 693000}',0,1,'2026-06-05 19:24:02','2026-06-05 19:24:02'),(89,1,4,'sensitive_fields_changed','Cambios sensibles registrados','Se ajustaron fecha de visita.','{\"fields\": [{\"after\": \"9/6/2026, 3:51:00 a. m.\", \"label\": \"fecha de visita\", \"before\": \"11/6/2026, 3:51:00 a. m.\"}]}',0,1,'2026-06-05 19:24:02','2026-06-05 19:24:02'),(90,1,4,'calendar_sync','Sincronización de calendario','Not Found','{\"syncAction\": \"error\", \"syncStatus\": \"error\", \"externalEventId\": null}',1,1,'2026-06-05 19:24:03','2026-06-05 19:24:03'),(91,1,4,'lead_updated','Lead actualizado','Lead LEAD-XYRF4O5O actualizado por Super Admin.','{\"prioridad\": \"amarillo\", \"scoreTotal\": 54, \"valorTotal\": 693000}',0,1,'2026-06-05 19:32:24','2026-06-05 19:32:24'),(92,1,4,'sensitive_fields_changed','Cambios sensibles registrados','Se ajustaron fecha de visita, prioridad.','{\"fields\": [{\"after\": \"8/6/2026, 3:51:00 a. m.\", \"label\": \"fecha de visita\", \"before\": \"9/6/2026, 3:51:00 a. m.\"}, {\"after\": \"amarillo\", \"label\": \"prioridad\", \"before\": \"verde\"}]}',0,1,'2026-06-05 19:32:24','2026-06-05 19:32:24'),(93,1,4,'calendar_sync','Sincronización de calendario','Not Found','{\"syncAction\": \"error\", \"syncStatus\": \"error\", \"externalEventId\": null}',1,1,'2026-06-05 19:32:24','2026-06-05 19:32:24'),(94,1,4,'lead_updated','Lead actualizado','Lead LEAD-XYRF4O5O actualizado por Super Admin.','{\"prioridad\": \"amarillo\", \"scoreTotal\": 54, \"valorTotal\": 693000}',0,1,'2026-06-05 19:40:34','2026-06-05 19:40:34'),(95,1,4,'sensitive_fields_changed','Cambios sensibles registrados','Se ajustaron fecha de visita.','{\"fields\": [{\"after\": \"7/6/2026, 3:51:00 a. m.\", \"label\": \"fecha de visita\", \"before\": \"8/6/2026, 3:51:00 a. m.\"}]}',0,1,'2026-06-05 19:40:34','2026-06-05 19:40:34'),(96,1,4,'calendar_sync','Sincronización de calendario','Service accounts cannot invite attendees without Domain-Wide Delegation of Authority.','{\"syncAction\": \"error\", \"syncStatus\": \"error\", \"externalEventId\": null}',1,1,'2026-06-05 19:40:36','2026-06-05 19:40:36'),(97,1,4,'lead_updated','Lead actualizado','Lead LEAD-XYRF4O5O actualizado por Super Admin.','{\"prioridad\": \"verde\", \"scoreTotal\": 49, \"valorTotal\": 693000}',0,1,'2026-06-05 19:56:47','2026-06-05 19:56:47'),(98,1,4,'sensitive_fields_changed','Cambios sensibles registrados','Se ajustaron fecha de visita, prioridad.','{\"fields\": [{\"after\": \"12/6/2026, 3:51:00 a. m.\", \"label\": \"fecha de visita\", \"before\": \"7/6/2026, 3:51:00 a. m.\"}, {\"after\": \"verde\", \"label\": \"prioridad\", \"before\": \"amarillo\"}]}',0,1,'2026-06-05 19:56:47','2026-06-05 19:56:47'),(99,1,4,'calendar_sync','Sincronización de calendario','Evento creado correctamente (sin participantes externos por restricción de cuota).','{\"syncAction\": \"create\", \"syncStatus\": \"success\", \"externalEventId\": \"a74d9nfper390l64jpkkkn4n3o\"}',1,1,'2026-06-05 19:56:49','2026-06-05 19:56:49'),(100,1,1,'lead_updated','Lead actualizado','Lead LEAD-5HLEUMUU actualizado por Super Admin.','{\"prioridad\": \"verde\", \"scoreTotal\": 31, \"valorTotal\": 99000}',0,1,'2026-06-13 04:44:29','2026-06-13 04:44:29'),(101,1,1,'status_changed','Estado actualizado','Cambio de estado de Ganado a Negociación.','{\"after\": \"negociacion\", \"before\": \"ganado\"}',0,1,'2026-06-13 04:44:29','2026-06-13 04:44:29'),(102,1,1,'calendar_sync','Sincronización de calendario','Evento creado correctamente (sin participantes externos por restricción de cuota).','{\"syncAction\": \"create\", \"syncStatus\": \"success\", \"externalEventId\": \"b16nonmiit0jt3pdflf6aaq414\"}',1,1,'2026-06-13 04:44:31','2026-06-13 04:44:31'),(103,1,1,'lead_updated','Lead actualizado','Lead LEAD-5HLEUMUU actualizado por Super Admin.','{\"prioridad\": \"verde\", \"scoreTotal\": 31, \"valorTotal\": 99000}',0,1,'2026-06-13 04:44:43','2026-06-13 04:44:43'),(104,1,1,'status_changed','Estado actualizado','Cambio de estado de Negociación a Ganado.','{\"after\": \"ganado\", \"before\": \"negociacion\"}',0,1,'2026-06-13 04:44:43','2026-06-13 04:44:43'),(105,1,1,'calendar_sync','Sincronización de calendario','Evento actualizado correctamente (sin participantes externos por restricción de cuota).','{\"syncAction\": \"update\", \"syncStatus\": \"success\", \"externalEventId\": \"b16nonmiit0jt3pdflf6aaq414\"}',1,1,'2026-06-13 04:44:44','2026-06-13 04:44:44'),(106,1,1,'alert_sent','Email de automatización enviado','Para: 622309459 — Asunto: Telegram a mateo','{\"source\": \"automation\", \"channel\": \"email\", \"subject\": \"Telegram a mateo\", \"success\": true, \"recipient\": \"622309459\"}',1,1,'2026-06-13 04:44:44','2026-06-13 04:44:44'),(107,1,1,'lead_updated','Lead actualizado','Lead LEAD-5HLEUMUU actualizado por Super Admin.','{\"prioridad\": \"verde\", \"scoreTotal\": 31, \"valorTotal\": 99000}',0,1,'2026-06-13 06:21:09','2026-06-13 06:21:09'),(108,1,1,'status_changed','Estado actualizado','Cambio de estado de Ganado a Negociación.','{\"after\": \"negociacion\", \"before\": \"ganado\"}',0,1,'2026-06-13 06:21:09','2026-06-13 06:21:09'),(109,1,1,'calendar_sync','Sincronización de calendario','Evento actualizado correctamente (sin participantes externos por restricción de cuota).','{\"syncAction\": \"update\", \"syncStatus\": \"success\", \"externalEventId\": \"b16nonmiit0jt3pdflf6aaq414\"}',1,1,'2026-06-13 06:21:10','2026-06-13 06:21:10'),(110,1,1,'lead_updated','Lead actualizado','Lead LEAD-5HLEUMUU actualizado por Super Admin.','{\"prioridad\": \"verde\", \"scoreTotal\": 31, \"valorTotal\": 99000}',0,1,'2026-06-13 06:21:14','2026-06-13 06:21:14'),(111,1,1,'status_changed','Estado actualizado','Cambio de estado de Negociación a Ganado.','{\"after\": \"ganado\", \"before\": \"negociacion\"}',0,1,'2026-06-13 06:21:14','2026-06-13 06:21:14'),(112,1,1,'calendar_sync','Sincronización de calendario','Evento actualizado correctamente (sin participantes externos por restricción de cuota).','{\"syncAction\": \"update\", \"syncStatus\": \"success\", \"externalEventId\": \"b16nonmiit0jt3pdflf6aaq414\"}',1,1,'2026-06-13 06:21:15','2026-06-13 06:21:15'),(113,1,1,'alert_sent','Email de automatización enviado','Para: 622309459 — Asunto: Telegram a mateo','{\"source\": \"automation\", \"channel\": \"email\", \"subject\": \"Telegram a mateo\", \"success\": true, \"recipient\": \"622309459\"}',1,1,'2026-06-13 06:21:15','2026-06-13 06:21:15'),(114,1,5,'lead_updated','Lead actualizado','Lead LEAD-TILNGGCI actualizado por Super Admin.','{\"prioridad\": \"amarillo\", \"scoreTotal\": 62, \"valorTotal\": 1473000}',0,1,'2026-06-14 14:16:59','2026-06-14 14:16:59'),(115,1,5,'status_changed','Estado actualizado','Cambio de estado de Contactado a Calificado.','{\"after\": \"calificado\", \"before\": \"contactado\"}',0,1,'2026-06-14 14:16:59','2026-06-14 14:16:59'),(116,1,5,'sensitive_fields_changed','Cambios sensibles registrados','Se ajustaron prioridad.','{\"fields\": [{\"after\": \"amarillo\", \"label\": \"prioridad\", \"before\": \"verde\"}]}',0,1,'2026-06-14 14:16:59','2026-06-14 14:16:59'),(117,1,5,'calendar_sync','Sincronización de calendario','Evento creado correctamente (sin participantes externos por restricción de cuota).','{\"syncAction\": \"create\", \"syncStatus\": \"success\", \"externalEventId\": \"3k1466bb3oo7jl9457f0aej3d4\"}',1,1,'2026-06-14 14:17:02','2026-06-14 14:17:02'),(118,1,6,'lead_created','Lead creado','Lead LEAD-QCCYDYB_ creado con prioridad gris.','{\"prioridad\": \"gris\", \"scoreTotal\": 33, \"valorTotal\": 198000, \"agenteResponsable\": \"Super Admin\"}',0,1,'2026-06-14 14:36:08','2026-06-14 14:36:08'),(119,1,6,'calendar_sync','Sincronización de calendario','Evento creado correctamente (sin participantes externos por restricción de cuota).','{\"syncAction\": \"create\", \"syncStatus\": \"success\", \"externalEventId\": \"gbi73lk1ksdv2dvogfh55a7ho8\"}',1,1,'2026-06-14 14:36:10','2026-06-14 14:36:10'),(120,1,7,'lead_created','Lead creado','Lead LEAD-ECEW-2JV creado con prioridad verde.','{\"prioridad\": \"verde\", \"scoreTotal\": 35, \"valorTotal\": 198000, \"agenteResponsable\": \"Super Admin\"}',0,1,'2026-06-15 01:10:48','2026-06-15 01:10:48'),(121,1,7,'calendar_sync','Sincronización de calendario','Evento creado correctamente (sin participantes externos por restricción de cuota).','{\"syncAction\": \"create\", \"syncStatus\": \"success\", \"externalEventId\": \"6of56k9i1ss19h78o6t44b5u40\"}',1,1,'2026-06-15 01:10:50','2026-06-15 01:10:50'),(122,1,2,'lead_updated','Lead actualizado','Lead LEAD-M9P1V5PG actualizado por Super Admin.','{\"prioridad\": \"amarillo\", \"scoreTotal\": 56, \"valorTotal\": 880000}',0,1,'2026-06-15 01:12:25','2026-06-15 01:12:25'),(123,1,2,'status_changed','Estado actualizado','Cambio de estado de Contactado a Calificado.','{\"after\": \"calificado\", \"before\": \"contactado\"}',0,1,'2026-06-15 01:12:25','2026-06-15 01:12:25'),(124,1,2,'calendar_sync','Sincronización de calendario','Evento creado correctamente (sin participantes externos por restricción de cuota).','{\"syncAction\": \"create\", \"syncStatus\": \"success\", \"externalEventId\": \"nri0asupl5f8ml1kco64vht924\"}',1,1,'2026-06-15 01:12:26','2026-06-15 01:12:26'),(125,1,8,'lead_created','Lead creado','Lead LEAD-U8VIFM3Y creado con prioridad amarillo.','{\"prioridad\": \"amarillo\", \"scoreTotal\": 40, \"valorTotal\": 297000, \"agenteResponsable\": \"Super Admin\"}',0,1,'2026-06-15 03:34:42','2026-06-15 03:34:42'),(126,1,8,'calendar_sync','Sincronización de calendario','Evento creado correctamente (sin participantes externos por restricción de cuota).','{\"syncAction\": \"create\", \"syncStatus\": \"success\", \"externalEventId\": \"1pj6oppimm4sgbp93f1cn7kq9o\"}',1,1,'2026-06-15 03:34:44','2026-06-15 03:34:44'),(127,1,9,'lead_created','Lead creado','Lead LEAD-7PCPZSES creado con prioridad verde.','{\"prioridad\": \"verde\", \"scoreTotal\": 23, \"valorTotal\": 69000, \"agenteResponsable\": \"Super Admin\"}',0,1,'2026-06-15 03:37:32','2026-06-15 03:37:32'),(128,1,9,'calendar_sync','Sincronización de calendario','Evento creado correctamente (sin participantes externos por restricción de cuota).','{\"syncAction\": \"create\", \"syncStatus\": \"success\", \"externalEventId\": \"tp3s8cq62dfsohrbhlpur2vspk\"}',1,1,'2026-06-15 03:37:33','2026-06-15 03:37:33'),(129,1,9,'lead_updated','Lead actualizado','Lead LEAD-7PCPZSES actualizado por Super Admin.','{\"prioridad\": \"verde\", \"scoreTotal\": 23, \"valorTotal\": 69000}',0,1,'2026-06-15 03:38:03','2026-06-15 03:38:03'),(130,1,9,'calendar_sync','Sincronización de calendario','Evento actualizado correctamente (sin participantes externos por restricción de cuota).','{\"syncAction\": \"update\", \"syncStatus\": \"success\", \"externalEventId\": \"tp3s8cq62dfsohrbhlpur2vspk\"}',1,1,'2026-06-15 03:38:05','2026-06-15 03:38:05'),(131,1,9,'lead_updated','Lead actualizado','Lead LEAD-7PCPZSES actualizado por Super Admin.','{\"prioridad\": \"verde\", \"scoreTotal\": 21, \"valorTotal\": 69000}',0,1,'2026-06-16 01:23:04','2026-06-16 01:23:04'),(132,1,9,'calendar_sync','Sincronización de calendario','Evento actualizado correctamente (sin participantes externos por restricción de cuota).','{\"syncAction\": \"update\", \"syncStatus\": \"success\", \"externalEventId\": \"tp3s8cq62dfsohrbhlpur2vspk\"}',1,1,'2026-06-16 01:23:07','2026-06-16 01:23:07'),(133,1,8,'lead_updated','Lead actualizado','Lead LEAD-U8VIFM3Y actualizado por Super Admin.','{\"prioridad\": \"verde\", \"scoreTotal\": 38, \"valorTotal\": 297000}',0,1,'2026-06-16 01:23:28','2026-06-16 01:23:28'),(134,1,8,'sensitive_fields_changed','Cambios sensibles registrados','Se ajustaron fecha de visita, prioridad.','{\"fields\": [{\"after\": \"16/6/2026, 2:00:00 a. m.\", \"label\": \"fecha de visita\", \"before\": \"18/6/2026, 3:33:00 a. m.\"}, {\"after\": \"verde\", \"label\": \"prioridad\", \"before\": \"amarillo\"}]}',0,1,'2026-06-16 01:23:29','2026-06-16 01:23:29'),(135,1,8,'calendar_sync','Sincronización de calendario','Evento actualizado correctamente (sin participantes externos por restricción de cuota).','{\"syncAction\": \"update\", \"syncStatus\": \"success\", \"externalEventId\": \"1pj6oppimm4sgbp93f1cn7kq9o\"}',1,1,'2026-06-16 01:23:30','2026-06-16 01:23:30'),(136,1,10,'lead_created','Lead creado','Lead LEAD-V-AABA8O creado con prioridad verde.','{\"prioridad\": \"verde\", \"scoreTotal\": 35, \"valorTotal\": 99000, \"agenteResponsable\": \"Super Admin\"}',0,1,'2026-06-19 15:18:47','2026-06-19 15:18:47'),(137,1,11,'lead_created','Lead creado','Lead LEAD-1MULLN-K creado con prioridad verde.','{\"prioridad\": \"verde\", \"scoreTotal\": 35, \"valorTotal\": 99000, \"agenteResponsable\": \"Super Admin\"}',0,1,'2026-06-19 15:19:16','2026-06-19 15:19:16'),(138,1,12,'lead_created','Lead creado','Lead LEAD-LKDL9OFN creado con prioridad verde.','{\"prioridad\": \"verde\", \"scoreTotal\": 35, \"valorTotal\": 99000, \"agenteResponsable\": \"Super Admin\"}',0,1,'2026-06-19 15:23:55','2026-06-19 15:23:55'),(139,1,12,'calendar_sync','Sincronización de calendario','Evento creado correctamente (sin participantes externos por restricción de cuota).','{\"syncAction\": \"create\", \"syncStatus\": \"success\", \"externalEventId\": \"jupaq43oa9ji03c8rmprqqq1uo\"}',1,1,'2026-06-19 15:23:56','2026-06-19 15:23:56'),(140,2,13,'lead_created','Lead creado','Lead LEAD-NZRZR0BJ creado con prioridad verde.','{\"prioridad\": \"verde\", \"scoreTotal\": 35, \"valorTotal\": 99000, \"agenteResponsable\": \"Super Admin\"}',0,1,'2026-06-19 18:38:16','2026-06-19 18:38:16'),(141,2,13,'calendar_sync','Sincronización de calendario','La sincronización con Google Calendar está desactivada en configuración.','{\"syncAction\": \"skip\", \"syncStatus\": \"success\", \"externalEventId\": null}',1,1,'2026-06-19 18:38:17','2026-06-19 18:38:17'),(142,2,13,'lead_updated','Etiqueta añadida por automatización','La automatización agregó la(s) etiqueta(s): Próximo a vencer.','{\"next\": \"[\\\"Próximo a vencer\\\"]\", \"source\": \"automation\", \"previous\": \"[]\"}',1,1,'2026-06-19 18:38:17','2026-06-19 18:38:17'),(143,2,14,'lead_created','Lead creado','Lead LEAD-UHVT_0XI creado con prioridad verde.','{\"prioridad\": \"verde\", \"scoreTotal\": 35, \"valorTotal\": 99000, \"agenteResponsable\": \"Super Admin\"}',0,1,'2026-06-19 21:51:08','2026-06-19 21:51:08'),(144,2,14,'calendar_sync','Sincronización de calendario','La sincronización con Google Calendar está desactivada en configuración.','{\"syncAction\": \"skip\", \"syncStatus\": \"success\", \"externalEventId\": null}',1,1,'2026-06-19 21:51:08','2026-06-19 21:51:08'),(145,2,14,'status_changed','Estado actualizado por automatización','Cambio de estado de \"nuevo\" a \"fase1\" vía regla automática.','{\"after\": \"fase1\", \"before\": \"nuevo\", \"source\": \"automation\"}',1,1,'2026-06-19 22:06:42','2026-06-19 22:06:42'),(146,2,13,'status_changed','Estado actualizado por automatización','Cambio de estado de \"nuevo\" a \"fase1\" vía regla automática.','{\"after\": \"fase1\", \"before\": \"nuevo\", \"source\": \"automation\"}',1,1,'2026-06-19 22:06:53','2026-06-19 22:06:53'),(147,1,2,'lead_updated','Lead actualizado','Lead LEAD-M9P1V5PG actualizado por Super Admin.','{\"prioridad\": \"amarillo\", \"scoreTotal\": 56, \"valorTotal\": 880000}',0,1,'2026-06-26 16:09:16','2026-06-26 16:09:16'),(148,1,2,'status_changed','Estado actualizado','Cambio de estado de Calificado a Ganado.','{\"after\": \"ganado\", \"before\": \"calificado\"}',0,1,'2026-06-26 16:09:16','2026-06-26 16:09:16'),(149,1,2,'calendar_sync','Sincronización de calendario','Evento actualizado correctamente (sin participantes externos por restricción de cuota).','{\"syncAction\": \"update\", \"syncStatus\": \"success\", \"externalEventId\": \"nri0asupl5f8ml1kco64vht924\"}',1,1,'2026-06-26 16:09:18','2026-06-26 16:09:18'),(150,1,2,'alert_sent','Email de automatización enviado','Para: 622309459 — Asunto: Telegram a mateo','{\"source\": \"automation\", \"channel\": \"email\", \"subject\": \"Telegram a mateo\", \"success\": true, \"recipient\": \"622309459\"}',1,1,'2026-06-26 16:09:18','2026-06-26 16:09:18'),(151,1,15,'lead_created','Lead creado','Lead LEAD-GIMPT3GI creado con prioridad verde.','{\"prioridad\": \"verde\", \"scoreTotal\": 35, \"valorTotal\": 99000, \"agenteResponsable\": \"Super Admin\"}',0,1,'2026-06-26 16:16:27','2026-06-26 16:16:27'),(152,1,15,'calendar_sync','Sincronización de calendario','Evento creado correctamente (sin participantes externos por restricción de cuota).','{\"syncAction\": \"create\", \"syncStatus\": \"success\", \"externalEventId\": \"j1uu2q6q4d2osffbb3pcf3lj94\"}',1,1,'2026-06-26 16:16:28','2026-06-26 16:16:28');
/*!40000 ALTER TABLE `leadActivities` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `leadCalendarSyncs`
--

DROP TABLE IF EXISTS `leadCalendarSyncs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `leadCalendarSyncs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `organizationId` int NOT NULL DEFAULT '1',
  `leadId` int NOT NULL,
  `externalCalendarId` varchar(255) DEFAULT NULL,
  `externalEventId` varchar(255) DEFAULT NULL,
  `syncAction` enum('create','update','skip','error','manual') NOT NULL,
  `syncStatus` enum('pending','success','error') NOT NULL DEFAULT 'pending',
  `requestFingerprint` varchar(255) DEFAULT NULL,
  `message` text,
  `triggeredByUserId` int DEFAULT NULL,
  `syncedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_lead_calendar_syncs_org` (`organizationId`)
) ENGINE=InnoDB AUTO_INCREMENT=54 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `leadCalendarSyncs`
--

LOCK TABLES `leadCalendarSyncs` WRITE;
/*!40000 ALTER TABLE `leadCalendarSyncs` DISABLE KEYS */;
INSERT INTO `leadCalendarSyncs` VALUES (1,1,1,NULL,NULL,'skip','success','LEAD-5HLEUMUU:1777862329000','La sincronización con Google Calendar está desactivada en configuración.',1,'2026-05-04 02:38:50'),(2,1,2,NULL,NULL,'skip','success','LEAD-M9P1V5PG:1778019667000','La sincronización con Google Calendar está desactivada en configuración.',1,'2026-05-05 22:21:07'),(3,1,2,NULL,NULL,'skip','success','LEAD-M9P1V5PG:1778039461000','La sincronización con Google Calendar está desactivada en configuración.',1,'2026-05-06 03:51:01'),(4,1,2,NULL,NULL,'skip','success','LEAD-M9P1V5PG:1778040963000','La sincronización con Google Calendar está desactivada en configuración.',1,'2026-05-06 04:16:03'),(5,1,2,NULL,NULL,'skip','success','LEAD-M9P1V5PG:1778040970000','La sincronización con Google Calendar está desactivada en configuración.',1,'2026-05-06 04:16:10'),(6,1,2,NULL,NULL,'skip','success','LEAD-M9P1V5PG:1778274815000','La sincronización con Google Calendar está desactivada en configuración.',1,'2026-05-08 21:13:36'),(7,1,1,NULL,NULL,'skip','success','LEAD-5HLEUMUU:1778274996000','La sincronización con Google Calendar está desactivada en configuración.',1,'2026-05-08 21:16:37'),(8,1,3,NULL,NULL,'skip','success','LEAD-KXORNICH:1778275134000','La sincronización con Google Calendar está desactivada en configuración.',1,'2026-05-08 21:18:54'),(9,1,3,NULL,NULL,'skip','success','LEAD-KXORNICH:1778275202000','La sincronización con Google Calendar está desactivada en configuración.',1,'2026-05-08 21:20:03'),(10,1,3,NULL,NULL,'skip','success','LEAD-KXORNICH:1778275219000','La sincronización con Google Calendar está desactivada en configuración.',1,'2026-05-08 21:20:19'),(11,1,1,NULL,NULL,'skip','success','LEAD-5HLEUMUU:1779767384000','La sincronización con Google Calendar está desactivada en configuración.',1,'2026-05-26 03:49:44'),(12,1,1,NULL,NULL,'skip','success','LEAD-5HLEUMUU:1779767405000','La sincronización con Google Calendar está desactivada en configuración.',1,'2026-05-26 03:50:05'),(13,1,3,NULL,NULL,'skip','success','LEAD-KXORNICH:1779768296000','La sincronización con Google Calendar está desactivada en configuración.',1,'2026-05-26 04:04:56'),(14,1,3,NULL,NULL,'skip','success','LEAD-KXORNICH:1779768303000','La sincronización con Google Calendar está desactivada en configuración.',1,'2026-05-26 04:05:04'),(15,1,3,NULL,NULL,'skip','success','LEAD-KXORNICH:1779825687000','La sincronización con Google Calendar está desactivada en configuración.',1,'2026-05-26 20:01:27'),(16,1,3,NULL,NULL,'skip','success','LEAD-KXORNICH:1779825710000','La sincronización con Google Calendar está desactivada en configuración.',1,'2026-05-26 20:01:50'),(17,1,1,NULL,NULL,'skip','success','LEAD-5HLEUMUU:1779825718000','La sincronización con Google Calendar está desactivada en configuración.',1,'2026-05-26 20:01:58'),(18,1,1,NULL,NULL,'skip','success','LEAD-5HLEUMUU:1779825720000','La sincronización con Google Calendar está desactivada en configuración.',1,'2026-05-26 20:02:00'),(19,1,4,NULL,NULL,'skip','success','LEAD-XYRF4O5O:1779854106000','La sincronización con Google Calendar está desactivada en configuración.',1,'2026-05-27 03:55:06'),(20,1,4,NULL,NULL,'skip','success','LEAD-XYRF4O5O:1779855903000','La sincronización con Google Calendar está desactivada en configuración.',1,'2026-05-27 04:25:04'),(21,1,5,NULL,NULL,'skip','success','LEAD-TILNGGCI:1779905595000','La sincronización con Google Calendar está desactivada en configuración.',1,'2026-05-27 18:13:16'),(22,1,5,NULL,NULL,'skip','success','LEAD-TILNGGCI:1780009633000','La sincronización con Google Calendar está desactivada en configuración.',1,'2026-05-28 23:07:13'),(23,1,4,NULL,NULL,'skip','success','LEAD-XYRF4O5O:1780009742000','La sincronización con Google Calendar está desactivada en configuración.',1,'2026-05-28 23:09:03'),(24,1,4,NULL,NULL,'skip','success','LEAD-XYRF4O5O:1780075000000','La sincronización con Google Calendar está desactivada en configuración.',1,'2026-05-29 17:16:40'),(25,1,4,NULL,NULL,'skip','success','LEAD-XYRF4O5O:1780075036000','La sincronización con Google Calendar está desactivada en configuración.',1,'2026-05-29 17:17:17'),(26,1,4,NULL,NULL,'skip','success','LEAD-XYRF4O5O:1780508601000','La sincronización con Google Calendar está desactivada en configuración.',1,'2026-06-03 17:43:21'),(27,1,4,NULL,NULL,'skip','success','LEAD-XYRF4O5O:1780508622000','La sincronización con Google Calendar está desactivada en configuración.',1,'2026-06-03 17:43:42'),(28,1,1,NULL,NULL,'skip','success','LEAD-5HLEUMUU:1780508632000','La sincronización con Google Calendar está desactivada en configuración.',1,'2026-06-03 17:43:52'),(29,1,4,'sportsinsights92@gmail.com',NULL,'error','error','LEAD-XYRF4O5O:1780683741000','Google Calendar API has not been used in project 941743786158 before or it is disabled. Enable it by visiting https://console.developers.google.com/apis/api/calendar-json.googleapis.com/overview?project=941743786158 then retry. If you enabled this API recently, wait a few minutes for the action to propagate to our systems and retry.',1,'2026-06-05 18:22:22'),(30,1,4,'sportsinsights92@gmail.com',NULL,'error','error','LEAD-XYRF4O5O:1780683742000','Google Calendar API has not been used in project 941743786158 before or it is disabled. Enable it by visiting https://console.developers.google.com/apis/api/calendar-json.googleapis.com/overview?project=941743786158 then retry. If you enabled this API recently, wait a few minutes for the action to propagate to our systems and retry.',1,'2026-06-05 18:23:36'),(31,1,4,'sportsinsights92@gmail.com',NULL,'error','error','LEAD-XYRF4O5O:1780687004000','Google Calendar API has not been used in project 941743786158 before or it is disabled. Enable it by visiting https://console.developers.google.com/apis/api/calendar-json.googleapis.com/overview?project=941743786158 then retry. If you enabled this API recently, wait a few minutes for the action to propagate to our systems and retry.',1,'2026-06-05 19:16:45'),(32,1,4,'sportsinsights92@gmail.com',NULL,'error','error','LEAD-XYRF4O5O:1780687442000','Not Found',1,'2026-06-05 19:24:03'),(33,1,4,'sportsinsights92@gmail.com',NULL,'error','error','LEAD-XYRF4O5O:1780687944000','Not Found',1,'2026-06-05 19:32:24'),(34,1,4,'sportsinsights92@gmail.com',NULL,'error','error','LEAD-XYRF4O5O:1780688434000','Service accounts cannot invite attendees without Domain-Wide Delegation of Authority.',1,'2026-06-05 19:40:36'),(35,1,4,'sportsinsights92@gmail.com','a74d9nfper390l64jpkkkn4n3o','create','success','LEAD-XYRF4O5O:1780689407000','Evento creado correctamente (sin participantes externos por restricción de cuota).',1,'2026-06-05 19:56:49'),(36,1,1,'sportsinsights92@gmail.com','b16nonmiit0jt3pdflf6aaq414','create','success','LEAD-5HLEUMUU:1781325869000','Evento creado correctamente (sin participantes externos por restricción de cuota).',1,'2026-06-13 04:44:31'),(37,1,1,'sportsinsights92@gmail.com','b16nonmiit0jt3pdflf6aaq414','update','success','LEAD-5HLEUMUU:1781325883000','Evento actualizado correctamente (sin participantes externos por restricción de cuota).',1,'2026-06-13 04:44:44'),(38,1,1,'sportsinsights92@gmail.com','b16nonmiit0jt3pdflf6aaq414','update','success','LEAD-5HLEUMUU:1781331669000','Evento actualizado correctamente (sin participantes externos por restricción de cuota).',1,'2026-06-13 06:21:10'),(39,1,1,'sportsinsights92@gmail.com','b16nonmiit0jt3pdflf6aaq414','update','success','LEAD-5HLEUMUU:1781331674000','Evento actualizado correctamente (sin participantes externos por restricción de cuota).',1,'2026-06-13 06:21:15'),(40,1,5,'sportsinsights92@gmail.com','3k1466bb3oo7jl9457f0aej3d4','create','success','LEAD-TILNGGCI:1781446619000','Evento creado correctamente (sin participantes externos por restricción de cuota).',1,'2026-06-14 14:17:02'),(41,1,6,'sportsinsights92@gmail.com','gbi73lk1ksdv2dvogfh55a7ho8','create','success','LEAD-QCCYDYB_:1781447768000','Evento creado correctamente (sin participantes externos por restricción de cuota).',1,'2026-06-14 14:36:10'),(42,1,7,'sportsinsights92@gmail.com','6of56k9i1ss19h78o6t44b5u40','create','success','LEAD-ECEW-2JV:1781485848000','Evento creado correctamente (sin participantes externos por restricción de cuota).',1,'2026-06-15 01:10:50'),(43,1,2,'sportsinsights92@gmail.com','nri0asupl5f8ml1kco64vht924','create','success','LEAD-M9P1V5PG:1781485945000','Evento creado correctamente (sin participantes externos por restricción de cuota).',1,'2026-06-15 01:12:26'),(44,1,8,'sportsinsights92@gmail.com','1pj6oppimm4sgbp93f1cn7kq9o','create','success','LEAD-U8VIFM3Y:1781494482000','Evento creado correctamente (sin participantes externos por restricción de cuota).',1,'2026-06-15 03:34:44'),(45,1,9,'sportsinsights92@gmail.com','tp3s8cq62dfsohrbhlpur2vspk','create','success','LEAD-7PCPZSES:1781494652000','Evento creado correctamente (sin participantes externos por restricción de cuota).',1,'2026-06-15 03:37:33'),(46,1,9,'sportsinsights92@gmail.com','tp3s8cq62dfsohrbhlpur2vspk','update','success','LEAD-7PCPZSES:1781494683000','Evento actualizado correctamente (sin participantes externos por restricción de cuota).',1,'2026-06-15 03:38:05'),(47,1,9,'sportsinsights92@gmail.com','tp3s8cq62dfsohrbhlpur2vspk','update','success','LEAD-7PCPZSES:1781572984000','Evento actualizado correctamente (sin participantes externos por restricción de cuota).',1,'2026-06-16 01:23:07'),(48,1,8,'sportsinsights92@gmail.com','1pj6oppimm4sgbp93f1cn7kq9o','update','success','LEAD-U8VIFM3Y:1781573008000','Evento actualizado correctamente (sin participantes externos por restricción de cuota).',1,'2026-06-16 01:23:30'),(49,1,12,'sportsinsights92@gmail.com','jupaq43oa9ji03c8rmprqqq1uo','create','success','LEAD-LKDL9OFN:1781882634000','Evento creado correctamente (sin participantes externos por restricción de cuota).',1,'2026-06-19 15:23:56'),(50,1,13,NULL,NULL,'skip','success','LEAD-NZRZR0BJ:1781894296000','La sincronización con Google Calendar está desactivada en configuración.',1,'2026-06-19 18:38:17'),(51,1,14,NULL,NULL,'skip','success','LEAD-UHVT_0XI:1781905868000','La sincronización con Google Calendar está desactivada en configuración.',1,'2026-06-19 21:51:08'),(52,1,2,'sportsinsights92@gmail.com','nri0asupl5f8ml1kco64vht924','update','success','LEAD-M9P1V5PG:1782490156000','Evento actualizado correctamente (sin participantes externos por restricción de cuota).',1,'2026-06-26 16:09:17'),(53,1,15,'sportsinsights92@gmail.com','j1uu2q6q4d2osffbb3pcf3lj94','create','success','LEAD-GIMPT3GI:1782490587000','Evento creado correctamente (sin participantes externos por restricción de cuota).',1,'2026-06-26 16:16:28');
/*!40000 ALTER TABLE `leadCalendarSyncs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `lead_pipeline_stages`
--

DROP TABLE IF EXISTS `lead_pipeline_stages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `lead_pipeline_stages` (
  `id` int NOT NULL AUTO_INCREMENT,
  `organizationId` int NOT NULL DEFAULT '1',
  `leadId` int NOT NULL,
  `pipelineId` int NOT NULL,
  `stageId` int NOT NULL,
  `movedAt` timestamp NOT NULL DEFAULT (now()),
  `movedByUserId` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_lead_pipeline_stages_org` (`organizationId`)
) ENGINE=InnoDB AUTO_INCREMENT=28 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `lead_pipeline_stages`
--

LOCK TABLES `lead_pipeline_stages` WRITE;
/*!40000 ALTER TABLE `lead_pipeline_stages` DISABLE KEYS */;
INSERT INTO `lead_pipeline_stages` VALUES (1,1,1,1,6,'2026-06-14 01:46:06',1),(2,1,2,1,3,'2026-06-15 01:12:26',1),(3,1,3,1,2,'2026-06-14 01:46:06',1),(4,1,4,1,1,'2026-06-14 01:46:06',1),(5,1,5,1,3,'2026-06-14 14:17:00',1),(10,1,6,2,11,'2026-06-15 03:57:03',1),(11,1,7,2,10,'2026-06-15 03:57:21',1),(12,1,8,2,9,'2026-06-15 03:34:42',1),(13,1,9,2,9,'2026-06-15 03:56:06',1),(14,1,6,1,1,'2026-06-15 04:00:26',1),(15,1,7,1,1,'2026-06-15 04:00:26',1),(16,1,8,1,1,'2026-06-15 04:00:26',1),(17,1,9,1,1,'2026-06-15 04:00:26',1),(18,1,12,2,9,'2026-06-19 15:23:55',1),(20,2,14,3,14,'2026-06-19 22:06:42',1),(21,2,13,3,14,'2026-06-19 22:06:53',1),(22,1,2,1,6,'2026-06-26 16:09:17',1),(23,1,15,4,16,'2026-06-26 16:16:28',1),(24,1,15,4,16,'2026-06-26 16:17:11',1),(25,1,15,4,16,'2026-06-26 16:17:25',1),(26,1,15,4,17,'2026-06-26 16:17:29',1),(27,1,15,4,16,'2026-06-26 16:18:10',1);
/*!40000 ALTER TABLE `lead_pipeline_stages` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `leads`
--

DROP TABLE IF EXISTS `leads`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `leads` (
  `id` int NOT NULL AUTO_INCREMENT,
  `organizationId` int NOT NULL DEFAULT '1',
  `publicId` varchar(32) NOT NULL,
  `nombreCliente` varchar(160) NOT NULL,
  `telefono` varchar(32) NOT NULL,
  `correo` varchar(320) NOT NULL,
  `fechaVisita` bigint NOT NULL,
  `motivoVisita` text NOT NULL,
  `tipoEvento` enum('corporativo','social','experiencia','reunion','otro') NOT NULL DEFAULT 'otro',
  `objecionPrincipal` text NOT NULL,
  `valorTotal` int NOT NULL DEFAULT '0',
  `scoreTotal` int NOT NULL DEFAULT '0',
  `prioridad` enum('gris','verde','amarillo','rojo') NOT NULL DEFAULT 'gris',
  `estadoLead` varchar(50) NOT NULL DEFAULT 'nuevo',
  `agenteUserId` int DEFAULT NULL,
  `fechaIngresoLead` bigint NOT NULL,
  `createdByUserId` int NOT NULL,
  `updatedByUserId` int NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `contactoNombre` varchar(160) DEFAULT NULL,
  `contactoTelefono` varchar(32) DEFAULT NULL,
  `contactoCorreo` varchar(320) DEFAULT NULL,
  `empresaNombre` varchar(160) DEFAULT NULL,
  `empresaCiudad` varchar(120) DEFAULT NULL,
  `prioridadExplicacion` text,
  `labels` text,
  `agenteResponsable` varchar(160) DEFAULT NULL,
  `fechaLimiteGestion` bigint DEFAULT NULL,
  `ultimaGestion` bigint DEFAULT NULL,
  `proximaAccion` text,
  `notasInternas` text,
  `motivoPerdido` varchar(240) DEFAULT NULL,
  `motivoPausa` varchar(240) DEFAULT NULL,
  `lastActivityAt` bigint DEFAULT NULL,
  `calendarEventId` varchar(255) DEFAULT NULL,
  `calendarEventUrl` text,
  `calendarSyncStatus` enum('disabled','pending','synced','error') NOT NULL DEFAULT 'disabled',
  `calendarSyncMessage` text,
  `alertPending` tinyint(1) NOT NULL DEFAULT '0',
  `alertLastChannel` varchar(32) DEFAULT NULL,
  `alertLastMessage` text,
  `lastCallAt` timestamp NULL DEFAULT NULL,
  `lastSmsAt` timestamp NULL DEFAULT NULL,
  `dialingStatus` varchar(80) DEFAULT NULL,
  `totalDialAttempts` int NOT NULL DEFAULT '0',
  `lastAlertAt` bigint DEFAULT NULL,
  `closedAt` bigint DEFAULT NULL,
  `nombreEmpresa` varchar(160) DEFAULT NULL,
  `ciudad` varchar(120) DEFAULT NULL,
  `cantidadMultiple` int DEFAULT '0',
  `cantidadJunior` int DEFAULT '0',
  `cantidadSenior` int DEFAULT '0',
  `cantidadParqueadero` int DEFAULT '0',
  `precioMultiple` int DEFAULT '0',
  `precioJunior` int DEFAULT '0',
  `precioSenior` int DEFAULT '0',
  `precioParqueadero` int DEFAULT '0',
  `subtotalMultiple` int DEFAULT '0',
  `subtotalJunior` int DEFAULT '0',
  `subtotalSenior` int DEFAULT '0',
  `subtotalParqueadero` int DEFAULT '0',
  `totalPersonas` int DEFAULT '0',
  `ticketPromedio` int DEFAULT '0',
  `scoreCantidad` int DEFAULT '0',
  `scoreValorTotal` int DEFAULT '0',
  `scoreTicketPromedio` int DEFAULT '0',
  `scoreUrgencia` int DEFAULT '0',
  `scoreRecencia` int DEFAULT '0',
  `prioridadBase` varchar(50) DEFAULT 'gris',
  `canalOrigen` varchar(100) DEFAULT 'otro',
  PRIMARY KEY (`id`),
  UNIQUE KEY `publicId` (`publicId`),
  KEY `agenteUserId` (`agenteUserId`),
  KEY `idx_leads_org` (`organizationId`),
  CONSTRAINT `leads_ibfk_1` FOREIGN KEY (`agenteUserId`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `leads`
--

LOCK TABLES `leads` WRITE;
/*!40000 ALTER TABLE `leads` DISABLE KEYS */;
INSERT INTO `leads` VALUES (1,1,'LEAD-5HLEUMUU','Juan Perez','3001234567','juan@example.com',1777948638738,'Servicio de consultor','corporativo','Falta de presupuesto inicial',99000,31,'verde','ganado',1,1777862329914,1,1,'2026-05-04 02:38:49','2026-06-13 06:21:15','Juan Perez','3001234567','juan@example.com',NULL,'Bogota','Se sube un nivel por visita en 2 días o menos.',NULL,'Super Admin',NULL,1781331674352,NULL,NULL,NULL,NULL,1781331675319,'b16nonmiit0jt3pdflf6aaq414','https://www.google.com/calendar/event?eid=YjE2bm9ubWlpdDBqdDNwZGZsZjZhYXE0MTQgc3BvcnRzaW5zaWdodHM5MkBt','synced','Evento actualizado correctamente (sin participantes externos por restricción de cuota).',0,NULL,NULL,NULL,NULL,NULL,0,NULL,1781331674370,NULL,'Bogota',1,0,0,0,99000,69000,69000,8000,99000,0,0,0,1,99000,3,2,15,10,1,'gris','whatsapp'),(2,1,'LEAD-M9P1V5PG','daniel','7134017316','prueba@gmail.com',1778365140000,'familia','social','nada',880000,56,'amarillo','ganado',1,1778019667818,1,1,'2026-05-05 22:21:07','2026-06-26 16:09:17','daniel','7134017316','prueba@gmail.com',NULL,'manizales','Se sube un nivel por visita en 2 días o menos.',NULL,'Super Admin',1778192460000,1782490156318,NULL,NULL,NULL,NULL,1782490157936,'nri0asupl5f8ml1kco64vht924','https://www.google.com/calendar/event?eid=bnJpMGFzdXBsNWY4bWwxa2NvNjR2aHQ5MjQgc3BvcnRzaW5zaWdodHM5MkBt','synced','Evento actualizado correctamente (sin participantes externos por restricción de cuota).',1,NULL,NULL,NULL,NULL,NULL,0,NULL,1782490156360,NULL,'manizales',5,3,2,5,99000,69000,69000,8000,495000,207000,138000,40000,10,88000,20,14,11,10,1,'verde','whatsapp'),(3,1,'LEAD-KXORNICH','victoria','3009876543','victoria@gmail.com',1778361419883,'viaje','social','nada',1029000,64,'amarillo','contactado',1,1778275133889,1,1,'2026-05-08 21:18:54','2026-05-26 20:01:50','victoria','3009876543','victoria@gmail.com',NULL,'buga','Se sube un nivel por visita en 2 días o menos.',NULL,'Super Admin',NULL,1779825710564,NULL,NULL,NULL,NULL,1779825710657,NULL,NULL,'disabled','La sincronización con Google Calendar está desactivada en configuración.',1,NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,NULL,'buga',9,2,0,0,99000,69000,69000,8000,891000,138000,0,0,11,93545,20,20,13,10,1,'verde','whatsapp'),(4,1,'LEAD-XYRF4O5O','Mateo García López','3136043363','mateogarcialopez3@gmail.com',1781236260000,'software ia','corporativo','costos altos',693000,49,'verde','nuevo',1,1779854106149,1,1,'2026-05-27 03:55:06','2026-06-05 19:56:49','Mateo García López','3136043363','mateogarcialopez3@gmail.com',NULL,'Manizales','Prioridad verde definida por score 49.',NULL,'Super Admin',1779940440000,1780508622052,NULL,NULL,NULL,NULL,1780689409069,'a74d9nfper390l64jpkkkn4n3o','https://www.google.com/calendar/event?eid=YTc0ZDluZnBlcjM5MGw2NGpwa2trbjRuM28gc3BvcnRzaW5zaWdodHM5MkBt','synced','Evento creado correctamente (sin participantes externos por restricción de cuota).',1,NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,NULL,'Manizales',7,0,0,0,99000,69000,69000,8000,693000,0,0,0,7,99000,14,14,15,5,1,'verde','facebook'),(5,1,'LEAD-TILNGGCI','jhon doe','564215565','jhon.doe@ejemplo.com',1780510395924,'Reunión de planificación y almuerzo ejecutivo.','corporativo','Ninguna',1473000,62,'amarillo','calificado',1,1779905595931,1,1,'2026-05-27 18:13:15','2026-06-14 14:17:01','jhon doe','564215565','jhon.doe@ejemplo.com','Empresa doe','Manizales','Se sube un nivel por visita en 2 días o menos.',NULL,'Super Admin',NULL,1781446619533,NULL,NULL,NULL,NULL,1781446621775,'3k1466bb3oo7jl9457f0aej3d4','https://www.google.com/calendar/event?eid=M2sxNDY2YmIzb283amw5NDU3ZjBhZWozZDQgc3BvcnRzaW5zaWdodHM5MkBt','synced','Evento creado correctamente (sin participantes externos por restricción de cuota).',1,NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,'Empresa doe','Manizales',10,5,2,0,99000,69000,69000,8000,990000,345000,138000,0,17,86647,20,20,11,10,1,'verde','whatsapp'),(6,1,'LEAD-QCCYDYB_','prueba1','3136043363','pruebaspc96@gmail.com',1781793000000,'prueba','corporativo','prueba',198000,33,'gris','nuevo',1,1781447768528,1,1,'2026-06-14 14:36:08','2026-06-14 14:36:10','prueba1','3136043363','pruebaspc96@gmail.com',NULL,'manizales','Prioridad gris definida por score 33.',NULL,'Super Admin',1781447640000,1781447768541,'validar pruebas',NULL,NULL,NULL,1781447770025,'gbi73lk1ksdv2dvogfh55a7ho8','https://www.google.com/calendar/event?eid=Z2JpNzNsazFrc2R2MmR2b2dmaDU1YTdobzggc3BvcnRzaW5zaWdodHM5MkBt','synced','Evento creado correctamente (sin participantes externos por restricción de cuota).',1,NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,NULL,'manizales',2,0,0,0,99000,69000,69000,8000,198000,0,0,0,2,99000,3,2,15,8,5,'gris','whatsapp'),(7,1,'LEAD-ECEW-2JV','prueba2','3136043363','pruebaspc96@gmail.com',1781658540000,'un producto','social','un producto',198000,35,'verde','nuevo',1,1781485848055,1,1,'2026-06-15 01:10:48','2026-06-15 01:10:50','prueba2','3136043363','pruebaspc96@gmail.com',NULL,'manizales','Se sube un nivel por visita en 2 días o menos.',NULL,'Super Admin',1781572200000,1781485848066,'un producto',NULL,NULL,NULL,1781485850159,'6of56k9i1ss19h78o6t44b5u40','https://www.google.com/calendar/event?eid=Nm9mNTZrOWkxc3MxOWg3OG82dDQ0YjV1NDAgc3BvcnRzaW5zaWdodHM5MkBt','synced','Evento creado correctamente (sin participantes externos por restricción de cuota).',0,NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,NULL,'manizales',2,0,0,0,99000,69000,69000,8000,198000,0,0,0,2,99000,3,2,15,10,5,'gris','instagram'),(8,1,'LEAD-U8VIFM3Y','prueba3','3136043363','mateogarcialopez3@gmail.com',1781575200000,'prueba','corporativo','prueba',297000,38,'verde','nuevo',1,1781494482644,1,1,'2026-06-15 03:34:42','2026-06-16 01:23:30','prueba3','3136043363','mateogarcialopez3@gmail.com',NULL,'caali','Se sube un nivel por visita en 2 días o menos.',NULL,'Super Admin',1781580840000,1781494482652,'prueba',NULL,NULL,NULL,1781573010577,'1pj6oppimm4sgbp93f1cn7kq9o','https://www.google.com/calendar/event?eid=MXBqNm9wcGltbTRzZ2JwOTNmMWNuN2txOW8gc3BvcnRzaW5zaWdodHM5MkBt','synced','Evento actualizado correctamente (sin participantes externos por restricción de cuota).',0,NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,NULL,'caali',3,0,0,0,99000,69000,69000,8000,297000,0,0,0,3,99000,5,5,15,10,3,'gris','llamada'),(9,1,'LEAD-7PCPZSES','prueba5','3136043363','mateogarcialopez3@gmail.com',1781580987716,'prueba','experiencia','prueba',69000,21,'verde','nuevo',1,1781494652211,1,1,'2026-06-15 03:37:32','2026-06-16 01:23:07','prueba5','3136043363','mateogarcialopez3@gmail.com',NULL,'dorada','Se sube un nivel por visita en 2 días o menos.',NULL,'Super Admin',1781581020000,1781494652216,'prueba',NULL,NULL,NULL,1781572987446,'tp3s8cq62dfsohrbhlpur2vspk','https://www.google.com/calendar/event?eid=dHAzczhjcTYyZGZzb2hyYmhscHVyMnZzcGsgc3BvcnRzaW5zaWdodHM5MkBt','synced','Evento actualizado correctamente (sin participantes externos por restricción de cuota).',0,NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,NULL,'dorada',0,1,0,0,99000,69000,69000,8000,0,69000,0,0,1,69000,3,2,3,10,3,'gris','referido'),(10,1,'LEAD-V-AABA8O','prueba9','3136043363','mateoarcialopez3@gmail.com',1781968665609,'prueba9','social','prueba9',99000,35,'verde','nuevo',1,1781882327359,1,1,'2026-06-19 15:18:47','2026-06-19 15:18:47','prueba9','3136043363','mateoarcialopez3@gmail.com',NULL,'ibague','Se sube un nivel por visita en 2 días o menos.',NULL,'Super Admin',1781968680000,1781882327378,NULL,'prueba9',NULL,NULL,1781882327378,NULL,NULL,'pending','Pendiente de sincronización',0,NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,NULL,'ibague',1,0,0,0,99000,69000,69000,8000,99000,0,0,0,1,99000,3,2,15,10,5,'gris','whatsapp'),(11,1,'LEAD-1MULLN-K','prueba9','3136043363','mateoarcialopez3@gmail.com',1781968665609,'prueba9','social','prueba9',99000,35,'verde','nuevo',1,1781882356090,1,1,'2026-06-19 15:19:16','2026-06-19 15:19:16','prueba9','3136043363','mateoarcialopez3@gmail.com',NULL,'ibague','Se sube un nivel por visita en 2 días o menos.',NULL,'Super Admin',1781968680000,1781882356099,NULL,'prueba9',NULL,NULL,1781882356099,NULL,NULL,'pending','Pendiente de sincronización',0,NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,NULL,'ibague',1,0,0,0,99000,69000,69000,8000,99000,0,0,0,1,99000,3,2,15,10,5,'gris','whatsapp'),(12,1,'LEAD-LKDL9OFN','prueba9','3136043363','mateoarcialopez3@gmail.com',1781968665609,'prueba9','social','prueba9',99000,35,'verde','nuevo',1,1781882634982,1,1,'2026-06-19 15:23:54','2026-06-19 15:23:56','prueba9','3136043363','mateoarcialopez3@gmail.com',NULL,'ibague','Se sube un nivel por visita en 2 días o menos.',NULL,'Super Admin',1781968680000,1781882634985,NULL,'prueba9',NULL,NULL,1781882636742,'jupaq43oa9ji03c8rmprqqq1uo','https://www.google.com/calendar/event?eid=anVwYXE0M29hOWppMDNjOHJtcHJxcXExdW8gc3BvcnRzaW5zaWdodHM5MkBt','synced','Evento creado correctamente (sin participantes externos por restricción de cuota).',0,NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,NULL,'ibague',1,0,0,0,99000,69000,69000,8000,99000,0,0,0,1,99000,3,2,15,10,5,'gris','whatsapp'),(13,2,'LEAD-NZRZR0BJ','prueba10','3136043363','mateogarcialopez3@gmail.com',1781980627836,'prueba10','social','prueba10',99000,35,'verde','fase1',1,1781894296929,1,1,'2026-06-19 18:38:16','2026-06-19 22:06:53','prueba10','3136043363','mateogarcialopez3@gmail.com',NULL,'dorada','Se sube un nivel por visita en 2 días o menos.','[\"Próximo a vencer\"]','Super Admin',1781980620000,1781894296937,'prueba10','prueba10',NULL,NULL,1781906813443,NULL,NULL,'disabled','La sincronización con Google Calendar está desactivada en configuración.',0,NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,NULL,'dorada',1,0,0,0,99000,69000,69000,8000,99000,0,0,0,1,99000,3,2,15,10,5,'gris','whatsapp'),(14,2,'LEAD-UHVT_0XI','prueba11','3136043363','mateogarcialopez@gmail.com',1781992217000,'prueba11','social','prueba11',99000,35,'verde','fase1',1,1781905868715,1,1,'2026-06-19 21:51:08','2026-06-19 22:06:42','prueba11','3136043363','mateogarcialopez@gmail.com',NULL,NULL,'Se sube un nivel por visita en 2 días o menos.',NULL,'Super Admin',NULL,1781905868722,'prueba11',NULL,NULL,NULL,1781906802112,NULL,NULL,'disabled','La sincronización con Google Calendar está desactivada en configuración.',0,NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,NULL,NULL,1,0,0,0,99000,69000,69000,8000,99000,0,0,0,1,99000,3,2,15,10,5,'gris','whatsapp'),(15,1,'LEAD-GIMPT3GI','citaprueba','3136043363','mateogarcialopez3@gmail.com',1782576937036,'citaprueba','social','citaprueba',99000,35,'verde','nuevo',1,1782490587881,1,1,'2026-06-26 16:16:27','2026-06-26 16:16:28','citaprueba','3136043363','mateogarcialopez3@gmail.com',NULL,'manizales','Se sube un nivel por visita en 2 días o menos.',NULL,'Super Admin',1782576960000,1782490587886,NULL,'citaprueba',NULL,NULL,1782490588794,'j1uu2q6q4d2osffbb3pcf3lj94','https://www.google.com/calendar/event?eid=ajF1dTJxNnE0ZDJvc2ZmYmIzcGNmM2xqOTQgc3BvcnRzaW5zaWdodHM5MkBt','synced','Evento creado correctamente (sin participantes externos por restricción de cuota).',0,NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,NULL,'manizales',1,0,0,0,99000,69000,69000,8000,99000,0,0,0,1,99000,3,2,15,10,5,'gris','whatsapp');
/*!40000 ALTER TABLE `leads` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `metric_views`
--

DROP TABLE IF EXISTS `metric_views`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `metric_views` (
  `id` int NOT NULL AUTO_INCREMENT,
  `organizationId` int NOT NULL DEFAULT '1',
  `userId` int NOT NULL,
  `name` varchar(100) NOT NULL,
  `config` text NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_metric_views_org` (`organizationId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `metric_views`
--

LOCK TABLES `metric_views` WRITE;
/*!40000 ALTER TABLE `metric_views` DISABLE KEYS */;
/*!40000 ALTER TABLE `metric_views` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `organization_invitations`
--

DROP TABLE IF EXISTS `organization_invitations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `organization_invitations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `organizationId` int NOT NULL,
  `email` varchar(320) NOT NULL,
  `orgRole` enum('owner','admin','agent','viewer') NOT NULL DEFAULT 'agent',
  `invitedByUserId` int NOT NULL,
  `token` varchar(64) NOT NULL,
  `status` enum('pending','accepted','expired','revoked') NOT NULL DEFAULT 'pending',
  `expiresAt` timestamp NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  PRIMARY KEY (`id`),
  UNIQUE KEY `organization_invitations_token_unique` (`token`),
  KEY `organization_invitations_invitedByUserId_users_id_fk` (`invitedByUserId`),
  KEY `idx_organization_invitations_email` (`email`),
  KEY `idx_organization_invitations_org` (`organizationId`),
  CONSTRAINT `organization_invitations_invitedByUserId_users_id_fk` FOREIGN KEY (`invitedByUserId`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `organization_invitations_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `organization_invitations`
--

LOCK TABLES `organization_invitations` WRITE;
/*!40000 ALTER TABLE `organization_invitations` DISABLE KEYS */;
INSERT INTO `organization_invitations` VALUES (1,2,'colaborador.invitado@mvp.local','admin',1,'hXWgbVJkGuC8eFcXVdY6d-znt8yoUqRM9ZPxedaDbC667DAO','accepted','2026-06-26 22:59:44','2026-06-19 22:59:44');
/*!40000 ALTER TABLE `organization_invitations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `organization_members`
--

DROP TABLE IF EXISTS `organization_members`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `organization_members` (
  `id` int NOT NULL AUTO_INCREMENT,
  `organizationId` int NOT NULL,
  `userId` int NOT NULL,
  `orgRole` enum('owner','admin','agent','viewer') NOT NULL DEFAULT 'agent',
  `status` enum('active','invited','suspended') NOT NULL DEFAULT 'active',
  `joinedAt` timestamp NOT NULL DEFAULT (now()),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_organization_members_org_user` (`organizationId`,`userId`),
  KEY `idx_organization_members_user` (`userId`),
  CONSTRAINT `organization_members_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `organization_members_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `organization_members`
--

LOCK TABLES `organization_members` WRITE;
/*!40000 ALTER TABLE `organization_members` DISABLE KEYS */;
INSERT INTO `organization_members` VALUES (1,1,1,'owner','active','2026-06-19 03:37:05'),(2,1,32,'agent','active','2026-06-19 03:37:05'),(3,1,166,'agent','active','2026-06-19 03:37:05'),(4,2,1,'owner','active','2026-06-19 04:01:45'),(5,2,32,'admin','active','2026-06-19 23:00:51');
/*!40000 ALTER TABLE `organization_members` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `organization_settings`
--

DROP TABLE IF EXISTS `organization_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `organization_settings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `organizationId` int NOT NULL,
  `displayName` varchar(200) DEFAULT NULL,
  `primaryColor` varchar(20) DEFAULT NULL,
  `logoUrl` text,
  `faviconUrl` text,
  `pricing` text,
  `scoring` text,
  `meta` text,
  `integrations` text,
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `organization_settings_organizationId_unique` (`organizationId`),
  CONSTRAINT `organization_settings_organizationId_organizations_id_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `organization_settings`
--

LOCK TABLES `organization_settings` WRITE;
/*!40000 ALTER TABLE `organization_settings` DISABLE KEYS */;
INSERT INTO `organization_settings` VALUES (1,1,'Maquina de Ventas','#5B21B6',NULL,NULL,'{\"precioJunior\": 69000, \"precioSenior\": 69000, \"precioMultiple\": 99000, \"precioParqueadero\": 8000, \"ticketPromedioReferencia\": 500000}','{\"minimoValorRojo\": 35000000, \"diasUrgenciaAlta\": 2, \"horasLeadCaliente\": 1, \"minimoPersonasRojo\": 200, \"scoreAltoThreshold\": 65, \"minimoValorAmarillo\": 20000000, \"minimoPersonasAmarillo\": 100}','{\"comisionPorcentaje\": 5, \"metaIngresosMensual\": 50000000}','{\"sms\": {\"to\": null, \"enabled\": 0}, \"email\": {\"to\": null, \"enabled\": 0}, \"googleCalendar\": {\"enabled\": 1, \"calendarId\": \"sportsinsights92@gmail.com\"}}','2026-06-19 03:57:03'),(2,2,'cafecentro','#BE185D',NULL,NULL,NULL,NULL,NULL,NULL,'2026-06-19 23:01:56');
/*!40000 ALTER TABLE `organization_settings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `organizations`
--

DROP TABLE IF EXISTS `organizations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `organizations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(200) NOT NULL,
  `slug` varchar(80) NOT NULL,
  `status` enum('active','paused','archived') NOT NULL DEFAULT 'active',
  `createdByUserId` int DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `organizations_slug_unique` (`slug`),
  KEY `organizations_createdByUserId_users_id_fk` (`createdByUserId`),
  CONSTRAINT `organizations_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `organizations`
--

LOCK TABLES `organizations` WRITE;
/*!40000 ALTER TABLE `organizations` DISABLE KEYS */;
INSERT INTO `organizations` VALUES (1,'Negocio Principal','default','active',1,'2026-06-19 03:37:03','2026-06-19 03:37:03'),(2,'cafecentro','cafe','active',1,'2026-06-19 04:01:45','2026-06-19 04:01:45');
/*!40000 ALTER TABLE `organizations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `permissions`
--

DROP TABLE IF EXISTS `permissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `permissions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `key` varchar(64) NOT NULL,
  `name` varchar(100) NOT NULL,
  `groupName` varchar(50) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  PRIMARY KEY (`id`),
  UNIQUE KEY `permissions_key_unique` (`key`)
) ENGINE=InnoDB AUTO_INCREMENT=20 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `permissions`
--

LOCK TABLES `permissions` WRITE;
/*!40000 ALTER TABLE `permissions` DISABLE KEYS */;
INSERT INTO `permissions` VALUES (1,'leads.view','Ver oportunidades','Leads','Acceder a la lista de oportunidades.','2026-06-16 03:40:58'),(2,'leads.create','Crear oportunidades','Leads','Crear nuevas oportunidades en el sistema.','2026-06-16 03:40:58'),(3,'leads.edit','Editar oportunidades','Leads','Modificar datos de oportunidades existentes.','2026-06-16 03:40:58'),(4,'leads.change_status','Cambiar estado de leads','Leads','Mover leads entre fases del embudo.','2026-06-16 03:40:58'),(5,'leads.delete','Eliminar oportunidades','Leads','Eliminar oportunidades del sistema.','2026-06-16 03:40:58'),(6,'pipelines.view','Ver embudos','Embudos','Acceder a la vista de embudos y sus fases.','2026-06-16 03:40:58'),(7,'pipelines.manage','Gestionar embudos y fases','Embudos','Crear, editar, eliminar y reordenar embudos y fases.','2026-06-16 03:40:58'),(8,'automations.view','Ver automatizaciones','Automatizaciones','Acceder al panel de automatizaciones.','2026-06-16 03:40:58'),(9,'automations.create','Crear y editar reglas','Automatizaciones','Crear y modificar reglas de automatizaciÃ³n.','2026-06-16 03:40:58'),(10,'automations.delete','Eliminar reglas','Automatizaciones','Eliminar reglas de automatizaciÃ³n.','2026-06-16 03:40:58'),(11,'automations.recipients','Gestionar destinatarios','Automatizaciones','Acceder a la libreta de destinatarios de automatizaciones.','2026-06-16 03:40:58'),(12,'automations.super_triggers','Usar triggers avanzados','Automatizaciones','Crear reglas con triggers opportunity_* y acciones a destinatarios especÃ­ficos.','2026-06-16 03:40:58'),(13,'metrics.view','Ver mÃ©tricas','MÃ©tricas','Acceder a mÃ©tricas de conversiÃ³n y funnel.','2026-06-16 03:40:58'),(14,'import_export.use','Importar y exportar','Importar / Exportar','Importar leads desde Excel y exportar a Excel.','2026-06-16 03:40:58'),(15,'settings.view','Ver configuraciÃ³n','ConfiguraciÃ³n','Acceder al panel de configuraciÃ³n.','2026-06-16 03:40:59'),(16,'settings.edit','Editar configuraciÃ³n','ConfiguraciÃ³n','Modificar parÃ¡metros del sistema (metas, comisiones, etc.).','2026-06-16 03:40:59'),(17,'settings.team_manage','Gestionar equipo','ConfiguraciÃ³n','Ver y editar el equipo comercial.','2026-06-16 03:40:59'),(18,'users.create','Crear usuarios','Usuarios','Crear nuevos usuarios con permisos personalizados.','2026-06-16 03:40:59'),(19,'users.edit_permissions','Asignar permisos','Usuarios','Editar los permisos de usuarios con rol personalizado.','2026-06-16 03:40:59');
/*!40000 ALTER TABLE `permissions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `pipeline_stages`
--

DROP TABLE IF EXISTS `pipeline_stages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pipeline_stages` (
  `id` int NOT NULL AUTO_INCREMENT,
  `organizationId` int NOT NULL DEFAULT '1',
  `name` varchar(100) NOT NULL,
  `color` varchar(20) DEFAULT '#gray',
  `order` int DEFAULT '0',
  `isActive` tinyint(1) DEFAULT '1',
  `createdAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `displayName` varchar(100) NOT NULL DEFAULT '',
  `pipelineId` int NOT NULL,
  `kind` enum('open','won','lost','paused') NOT NULL DEFAULT 'open',
  PRIMARY KEY (`id`),
  KEY `idx_pipeline_stages_org` (`organizationId`)
) ENGINE=InnoDB AUTO_INCREMENT=20 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `pipeline_stages`
--

LOCK TABLES `pipeline_stages` WRITE;
/*!40000 ALTER TABLE `pipeline_stages` DISABLE KEYS */;
INSERT INTO `pipeline_stages` VALUES (1,1,'nuevo','#3b82f6',1,1,'2026-05-27 03:50:54','2026-06-15 01:14:39','Nuevo',1,'open'),(2,1,'contactado','#a855f7',2,1,'2026-05-27 03:50:55','2026-06-15 01:14:39','Contactado',1,'open'),(3,1,'calificado','#6366f1',3,1,'2026-05-27 03:50:55','2026-06-14 01:46:06','Calificado',1,'open'),(4,1,'propuesta','#eab308',4,1,'2026-05-27 03:50:55','2026-06-14 01:46:06','Propuesta Enviada',1,'open'),(5,1,'negociacion','#f97316',5,1,'2026-05-27 03:50:55','2026-06-14 01:46:06','Negociación',1,'open'),(6,1,'ganado','#22c55e',6,1,'2026-05-27 03:50:55','2026-06-14 01:46:06','Ganado',1,'won'),(7,1,'perdido','#ef4444',7,1,'2026-05-27 03:50:55','2026-06-14 01:46:06','Perdido',1,'lost'),(8,1,'pausado','#6b7280',8,1,'2026-05-27 03:50:55','2026-06-14 01:46:06','Pausado',1,'paused'),(9,1,'fase1','#3bf7ea',1,1,'2026-06-14 01:54:47','2026-06-15 01:46:42','fase1',2,'open'),(10,1,'fase2','#3ef73b',2,1,'2026-06-14 01:55:09','2026-06-15 01:46:47','fase2',2,'open'),(11,1,'fase3','#f7613b',3,1,'2026-06-14 14:29:23','2026-06-15 01:46:47','fase3',2,'open'),(12,1,'inicio','#3b82f6',1,1,'2026-06-19 21:51:37','2026-06-19 21:51:37','inicio',3,'open'),(13,1,'inicio','#3b82f6',1,1,'2026-06-19 21:52:03','2026-06-19 21:52:03','inicio',3,'open'),(14,2,'fase1','#3b82f6',1,1,'2026-06-19 22:06:15','2026-06-19 22:06:15','fase1',3,'open'),(15,2,'fase2','#3b82f6',2,1,'2026-06-19 22:07:13','2026-06-19 22:07:13','fase2',3,'open'),(16,1,'nuevo contacto','#3b82f6',1,1,'2026-06-26 16:11:56','2026-06-26 16:11:56','nuevo contacto',4,'open'),(17,1,'cita gratuita','#3b82f6',2,1,'2026-06-26 16:12:11','2026-06-26 16:12:11','cita gratuita',4,'open'),(18,1,'cita paga','#3b82f6',3,1,'2026-06-26 16:12:22','2026-06-26 16:12:22','cita paga',4,'open'),(19,1,'ganado','#3b82f6',4,1,'2026-06-26 16:12:33','2026-06-26 16:12:33','ganado',4,'open');
/*!40000 ALTER TABLE `pipeline_stages` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `pipelines`
--

DROP TABLE IF EXISTS `pipelines`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pipelines` (
  `id` int NOT NULL AUTO_INCREMENT,
  `organizationId` int NOT NULL DEFAULT '1',
  `name` varchar(100) NOT NULL,
  `description` text,
  `color` varchar(7) DEFAULT '#3b82f6',
  `order` int DEFAULT '0',
  `isActive` tinyint(1) DEFAULT '1',
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_pipelines_org` (`organizationId`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `pipelines`
--

LOCK TABLES `pipelines` WRITE;
/*!40000 ALTER TABLE `pipelines` DISABLE KEYS */;
INSERT INTO `pipelines` VALUES (1,1,'Principal','Embudo principal del sistema con las fases tradicionales.','#3b82f6',1,1,'2026-06-14 01:46:06','2026-06-14 01:46:06'),(2,1,'b5b','embudo de prueba','#e41a0c',2,1,'2026-06-14 01:54:30','2026-06-19 18:39:58'),(3,2,'ventas',NULL,'#315e3a',1,1,'2026-06-19 21:10:39','2026-06-19 21:10:39'),(4,1,'prueba','prueba de fases','#3bf77a',3,1,'2026-06-26 16:11:37','2026-06-26 16:11:37');
/*!40000 ALTER TABLE `pipelines` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `settingsChangeLogs`
--

DROP TABLE IF EXISTS `settingsChangeLogs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `settingsChangeLogs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `organizationId` int NOT NULL DEFAULT '1',
  `settingsId` int NOT NULL,
  `changedByUserId` int DEFAULT NULL,
  `summary` varchar(255) NOT NULL,
  `changedFields` text NOT NULL,
  `previousSnapshot` text NOT NULL,
  `nextSnapshot` text NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_settings_change_logs_org` (`organizationId`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `settingsChangeLogs`
--

LOCK TABLES `settingsChangeLogs` WRITE;
/*!40000 ALTER TABLE `settingsChangeLogs` DISABLE KEYS */;
INSERT INTO `settingsChangeLogs` VALUES (1,1,1,1,'Se actualizaron 2 campos: sincronización con google calendar, id del calendario.','[{\"field\":\"calendarSyncEnabled\",\"label\":\"Sincronización con Google Calendar\",\"previous\":\"Inactivo\",\"next\":\"Activo\"},{\"field\":\"googleCalendarId\",\"label\":\"ID del calendario\",\"previous\":null,\"next\":\"sportsinsights92@gmail.com\"}]','{\"configName\":\"Configuración principal\",\"precioMultiple\":99000,\"precioJunior\":69000,\"precioSenior\":69000,\"precioParqueadero\":8000,\"ticketPromedioReferencia\":500000,\"minimoPersonasAmarillo\":100,\"minimoPersonasRojo\":200,\"minimoValorAmarillo\":20000000,\"minimoValorRojo\":35000000,\"diasUrgenciaAlta\":2,\"horasLeadCaliente\":1,\"scoreAltoThreshold\":65,\"metaIngresosMensual\":50000000,\"comisionPorcentaje\":5,\"calendarSyncEnabled\":false,\"googleCalendarId\":\"\",\"emailAlertsEnabled\":false,\"smsAlertsEnabled\":false,\"alertEmailTo\":\"\",\"alertSmsTo\":\"\"}','{\"configName\":\"Configuración principal\",\"precioMultiple\":99000,\"precioJunior\":69000,\"precioSenior\":69000,\"precioParqueadero\":8000,\"ticketPromedioReferencia\":500000,\"minimoPersonasAmarillo\":100,\"minimoPersonasRojo\":200,\"minimoValorAmarillo\":20000000,\"minimoValorRojo\":35000000,\"diasUrgenciaAlta\":2,\"horasLeadCaliente\":1,\"scoreAltoThreshold\":65,\"metaIngresosMensual\":50000000,\"comisionPorcentaje\":5,\"calendarSyncEnabled\":true,\"googleCalendarId\":\"sportsinsights92@gmail.com\",\"emailAlertsEnabled\":false,\"smsAlertsEnabled\":false,\"alertEmailTo\":\"\",\"alertSmsTo\":\"\"}','2026-06-05 04:20:39'),(2,1,1,1,'Se actualizó sincronización con google calendar.','[{\"field\":\"calendarSyncEnabled\",\"label\":\"Sincronización con Google Calendar\",\"previous\":\"Activo\",\"next\":\"Inactivo\"}]','{\"configName\":\"Configuración principal\",\"precioMultiple\":99000,\"precioJunior\":69000,\"precioSenior\":69000,\"precioParqueadero\":8000,\"ticketPromedioReferencia\":500000,\"minimoPersonasAmarillo\":100,\"minimoPersonasRojo\":200,\"minimoValorAmarillo\":20000000,\"minimoValorRojo\":35000000,\"diasUrgenciaAlta\":2,\"horasLeadCaliente\":1,\"scoreAltoThreshold\":65,\"metaIngresosMensual\":50000000,\"comisionPorcentaje\":5,\"calendarSyncEnabled\":true,\"googleCalendarId\":\"sportsinsights92@gmail.com\",\"emailAlertsEnabled\":false,\"smsAlertsEnabled\":false,\"alertEmailTo\":\"\",\"alertSmsTo\":\"\"}','{\"configName\":\"Configuración principal\",\"precioMultiple\":99000,\"precioJunior\":69000,\"precioSenior\":69000,\"precioParqueadero\":8000,\"ticketPromedioReferencia\":500000,\"minimoPersonasAmarillo\":100,\"minimoPersonasRojo\":200,\"minimoValorAmarillo\":20000000,\"minimoValorRojo\":35000000,\"diasUrgenciaAlta\":2,\"horasLeadCaliente\":1,\"scoreAltoThreshold\":65,\"metaIngresosMensual\":50000000,\"comisionPorcentaje\":5,\"calendarSyncEnabled\":false,\"googleCalendarId\":\"sportsinsights92@gmail.com\",\"emailAlertsEnabled\":false,\"smsAlertsEnabled\":false,\"alertEmailTo\":\"\",\"alertSmsTo\":\"\"}','2026-06-05 19:09:25'),(3,1,1,1,'Se actualizó sincronización con google calendar.','[{\"field\":\"calendarSyncEnabled\",\"label\":\"Sincronización con Google Calendar\",\"previous\":\"Inactivo\",\"next\":\"Activo\"}]','{\"configName\":\"Configuración principal\",\"precioMultiple\":99000,\"precioJunior\":69000,\"precioSenior\":69000,\"precioParqueadero\":8000,\"ticketPromedioReferencia\":500000,\"minimoPersonasAmarillo\":100,\"minimoPersonasRojo\":200,\"minimoValorAmarillo\":20000000,\"minimoValorRojo\":35000000,\"diasUrgenciaAlta\":2,\"horasLeadCaliente\":1,\"scoreAltoThreshold\":65,\"metaIngresosMensual\":50000000,\"comisionPorcentaje\":5,\"calendarSyncEnabled\":false,\"googleCalendarId\":\"sportsinsights92@gmail.com\",\"emailAlertsEnabled\":false,\"smsAlertsEnabled\":false,\"alertEmailTo\":\"\",\"alertSmsTo\":\"\"}','{\"configName\":\"Configuración principal\",\"precioMultiple\":99000,\"precioJunior\":69000,\"precioSenior\":69000,\"precioParqueadero\":8000,\"ticketPromedioReferencia\":500000,\"minimoPersonasAmarillo\":100,\"minimoPersonasRojo\":200,\"minimoValorAmarillo\":20000000,\"minimoValorRojo\":35000000,\"diasUrgenciaAlta\":2,\"horasLeadCaliente\":1,\"scoreAltoThreshold\":65,\"metaIngresosMensual\":50000000,\"comisionPorcentaje\":5,\"calendarSyncEnabled\":true,\"googleCalendarId\":\"sportsinsights92@gmail.com\",\"emailAlertsEnabled\":false,\"smsAlertsEnabled\":false,\"alertEmailTo\":\"\",\"alertSmsTo\":\"\"}','2026-06-05 19:16:24');
/*!40000 ALTER TABLE `settingsChangeLogs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sms_messages`
--

DROP TABLE IF EXISTS `sms_messages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sms_messages` (
  `id` int NOT NULL AUTO_INCREMENT,
  `organizationId` int NOT NULL DEFAULT '1',
  `leadId` int NOT NULL,
  `twilioMessageSid` varchar(64) DEFAULT NULL,
  `direction` enum('inbound','outbound') NOT NULL DEFAULT 'outbound',
  `fromNumber` varchar(32) NOT NULL,
  `toNumber` varchar(32) NOT NULL,
  `body` text,
  `numMedia` int NOT NULL DEFAULT '0',
  `mediaUrl` text,
  `sentAt` timestamp NOT NULL DEFAULT (now()),
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  PRIMARY KEY (`id`),
  KEY `idx_sms_messages_org` (`organizationId`,`sentAt`),
  KEY `idx_sms_messages_lead` (`leadId`),
  CONSTRAINT `sms_messages_leadId_fk` FOREIGN KEY (`leadId`) REFERENCES `leads` (`id`) ON DELETE CASCADE,
  CONSTRAINT `sms_messages_organizationId_fk` FOREIGN KEY (`organizationId`) REFERENCES `organizations` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sms_messages`
--

LOCK TABLES `sms_messages` WRITE;
/*!40000 ALTER TABLE `sms_messages` DISABLE KEYS */;
/*!40000 ALTER TABLE `sms_messages` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_permissions`
--

DROP TABLE IF EXISTS `user_permissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_permissions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `organizationId` int NOT NULL DEFAULT '1',
  `userId` int NOT NULL,
  `permissionId` int NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  PRIMARY KEY (`id`),
  KEY `idx_user_permissions_org` (`organizationId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_permissions`
--

LOCK TABLES `user_permissions` WRITE;
/*!40000 ALTER TABLE `user_permissions` DISABLE KEYS */;
/*!40000 ALTER TABLE `user_permissions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `openId` varchar(64) NOT NULL,
  `name` text,
  `email` varchar(320) DEFAULT NULL,
  `loginMethod` varchar(64) DEFAULT NULL,
  `role` enum('guest','agent','admin','superadmin','custom') NOT NULL DEFAULT 'agent',
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `lastSignedIn` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `passwordHash` text,
  PRIMARY KEY (`id`),
  UNIQUE KEY `openId` (`openId`)
) ENGINE=InnoDB AUTO_INCREMENT=2635 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'test-owner-id','Super Admin','admin@mvp.local',NULL,'superadmin','2026-04-22 04:08:29','2026-06-29 19:16:48','2026-06-29 19:16:48','9bb9ebe2c2092dbfd4a2897e9ea92c21:dbbf2c93de56895dbd47b530fd3ba7184ef020b05561329ca40992414b81e90c23b22c280f3b177d8f01e8ac94e2a3ccfe9c3f3326795f0d6d522a5c83f34497'),(32,'colaborador.invitado@mvp.local','colaborador invitado','colaborador.invitado@mvp.local',NULL,'guest','2026-05-28 19:40:23','2026-06-26 16:50:05','2026-06-26 16:50:06','8bee202750a61a0fc8c9252c0ef7897f:f7dd5c12c10938cd8eeaa4ae1cf09258541b3dcfd7734c7741f8362114f5283a221afa235d96b10a60f66eb751ce6a7b4e01b47e8f0a79d106481cbe392d8c81'),(166,'colaborador.agente@mvp.local','jhon doe','colaborador.agente@mvp.local',NULL,'agent','2026-05-29 17:57:34','2026-06-03 17:41:49','2026-06-03 17:41:49','abc26657c4f2fe46a146b0325a34859b:d2cefadfefaeaa5f5595fc0534da778a2d81d921b10f767adaa8e1d65c1c21b751dde5be8677fa9132977b5beb362f0074ce1948446c74de49d9ae5b7054d7d7');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping events for database 'cotizador_leads'
--

--
-- Dumping routines for database 'cotizador_leads'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-06-29 19:54:18
