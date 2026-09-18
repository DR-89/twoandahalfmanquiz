CREATE TABLE `quiz_rooms` (
	`code` text PRIMARY KEY NOT NULL,
	`state` text NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `quiz_rooms_expires_idx` ON `quiz_rooms` (`expires`);