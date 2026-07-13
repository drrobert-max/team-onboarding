CREATE TABLE `daily_checkins` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`moduleId` int NOT NULL,
	`checkDate` varchar(10) NOT NULL,
	`checkedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `daily_checkins_id` PRIMARY KEY(`id`)
);
