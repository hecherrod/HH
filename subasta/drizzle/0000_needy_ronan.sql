CREATE TABLE `bids` (
	`id` text PRIMARY KEY NOT NULL,
	`lot` integer NOT NULL,
	`amount` integer NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `lot_amount` ON `bids` (`lot`,`amount`);