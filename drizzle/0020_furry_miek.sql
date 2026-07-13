CREATE TABLE `text_highlights` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`moduleId` int NOT NULL,
	`startOffset` int NOT NULL,
	`endOffset` int NOT NULL,
	`color` varchar(20) NOT NULL DEFAULT 'yellow',
	`selectedText` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `text_highlights_id` PRIMARY KEY(`id`)
);
