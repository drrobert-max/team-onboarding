CREATE TABLE `library_videos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`driveFileId` varchar(255) NOT NULL,
	`name` varchar(500) NOT NULL,
	`category` varchar(255) NOT NULL DEFAULT 'General',
	`description` text,
	`driveCreatedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `library_videos_id` PRIMARY KEY(`id`),
	CONSTRAINT `library_videos_driveFileId_unique` UNIQUE(`driveFileId`)
);
