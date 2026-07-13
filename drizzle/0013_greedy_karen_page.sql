ALTER TABLE `users` ADD `passwordHash` text;--> statement-breakpoint
ALTER TABLE `users` ADD `resetToken` varchar(128);--> statement-breakpoint
ALTER TABLE `users` ADD `resetTokenExpiresAt` timestamp;