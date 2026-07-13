CREATE TABLE `new_hire_prep_checklist` (
	`id` int AUTO_INCREMENT NOT NULL,
	`newHireUserId` int NOT NULL,
	`adminUserId` int NOT NULL,
	`items` json NOT NULL,
	`binderSopIds` json DEFAULT ('[]'),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `new_hire_prep_checklist_id` PRIMARY KEY(`id`)
);
