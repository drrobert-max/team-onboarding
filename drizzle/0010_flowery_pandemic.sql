CREATE TABLE `questions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`moduleId` int,
	`question` text NOT NULL,
	`reply` text,
	`repliedBy` int,
	`repliedAt` timestamp,
	`status` varchar(32) NOT NULL DEFAULT 'open',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `questions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `video_submissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`moduleId` int,
	`title` varchar(255) NOT NULL,
	`fileKey` varchar(512) NOT NULL,
	`fileUrl` varchar(512) NOT NULL,
	`fileName` varchar(255) NOT NULL,
	`feedback` text,
	`reviewedBy` int,
	`reviewedAt` timestamp,
	`status` varchar(32) NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `video_submissions_id` PRIMARY KEY(`id`)
);
