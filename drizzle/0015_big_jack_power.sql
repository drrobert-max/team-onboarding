CREATE TABLE `module_task_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`moduleId` int NOT NULL,
	`itemText` varchar(512) NOT NULL,
	`itemIndex` int NOT NULL,
	`isChecked` boolean NOT NULL DEFAULT false,
	`checkedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `module_task_items_id` PRIMARY KEY(`id`)
);
