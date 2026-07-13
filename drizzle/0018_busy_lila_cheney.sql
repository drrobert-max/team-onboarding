CREATE TABLE `question_replies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`questionId` int NOT NULL,
	`userId` int NOT NULL,
	`message` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `question_replies_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `video_replies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`videoSubmissionId` int NOT NULL,
	`userId` int NOT NULL,
	`message` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `video_replies_id` PRIMARY KEY(`id`)
);
