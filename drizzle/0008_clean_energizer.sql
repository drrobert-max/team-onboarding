CREATE TABLE `software_checklist` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`moduleId` int NOT NULL,
	`softwareName` varchar(255) NOT NULL,
	`isChecked` boolean NOT NULL DEFAULT false,
	`checkedAt` timestamp,
	`checkedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `software_checklist_id` PRIMARY KEY(`id`)
);
