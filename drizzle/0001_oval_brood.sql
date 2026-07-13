CREATE TABLE `milestones` (
	`id` int AUTO_INCREMENT NOT NULL,
	`trackId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`weekNumber` int NOT NULL,
	`sortOrder` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `milestones_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `modules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`milestoneId` int NOT NULL,
	`title` varchar(500) NOT NULL,
	`description` text,
	`type` enum('sop','video','task','checklist') NOT NULL,
	`sopId` int,
	`loomUrl` varchar(1000),
	`loomVideoId` varchar(255),
	`taskInstructions` text,
	`sortOrder` int DEFAULT 0,
	`isRequired` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `modules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`type` enum('overdue_reminder','quiz_failed','onboarding_complete','sop_updated','approval_needed','account_approved','account_rejected') NOT NULL,
	`title` varchar(500) NOT NULL,
	`message` text NOT NULL,
	`isRead` boolean NOT NULL DEFAULT false,
	`relatedId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `quiz_attempts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`quizId` int NOT NULL,
	`moduleId` int NOT NULL,
	`answers` json NOT NULL,
	`score` int NOT NULL,
	`passed` boolean NOT NULL,
	`attemptNumber` int NOT NULL DEFAULT 1,
	`completedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `quiz_attempts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `quizzes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`moduleId` int NOT NULL,
	`questions` json NOT NULL,
	`passingScore` int NOT NULL DEFAULT 70,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `quizzes_id` PRIMARY KEY(`id`),
	CONSTRAINT `quizzes_moduleId_unique` UNIQUE(`moduleId`)
);
--> statement-breakpoint
CREATE TABLE `sop_categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`slug` varchar(255) NOT NULL,
	`description` text,
	`sortOrder` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sop_categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `sop_categories_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `sop_review_flags` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`sopId` int NOT NULL,
	`reason` text,
	`reviewedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sop_review_flags_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sop_versions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sopId` int NOT NULL,
	`version` int NOT NULL,
	`content` text NOT NULL,
	`archivedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sop_versions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sops` (
	`id` int AUTO_INCREMENT NOT NULL,
	`categoryId` int NOT NULL,
	`title` varchar(500) NOT NULL,
	`content` text NOT NULL,
	`googleDocId` varchar(255),
	`lastUpdated` timestamp NOT NULL DEFAULT (now()),
	`version` int NOT NULL DEFAULT 1,
	`isActive` boolean NOT NULL DEFAULT true,
	`flaggedForReview` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sops_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tracks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`teamRole` enum('ca','associate_doctor','scan_tech','preceptor') NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `tracks_id` PRIMARY KEY(`id`),
	CONSTRAINT `tracks_teamRole_unique` UNIQUE(`teamRole`)
);
--> statement-breakpoint
CREATE TABLE `user_module_progress` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`moduleId` int NOT NULL,
	`status` enum('not_started','in_progress','completed','needs_review') NOT NULL DEFAULT 'not_started',
	`completedAt` timestamp,
	`flaggedForReview` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_module_progress_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `teamRole` enum('ca','associate_doctor','scan_tech','preceptor');--> statement-breakpoint
ALTER TABLE `users` ADD `approvalStatus` enum('pending','approved','rejected') DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `approvedAt` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `approvedBy` int;--> statement-breakpoint
ALTER TABLE `users` ADD `onboardingStartedAt` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `onboardingCompletedAt` timestamp;