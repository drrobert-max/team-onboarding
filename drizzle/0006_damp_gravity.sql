CREATE TABLE `test_out_grades` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`moduleId` int NOT NULL,
	`milestoneId` int NOT NULL,
	`grade` enum('mastered','needs_improvement') NOT NULL,
	`gradedBy` int NOT NULL,
	`carriedToMilestoneId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `test_out_grades_id` PRIMARY KEY(`id`)
);
