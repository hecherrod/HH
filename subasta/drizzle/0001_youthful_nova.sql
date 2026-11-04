CREATE TABLE `offers` (
	`id` text PRIMARY KEY NOT NULL,
	`lot` integer NOT NULL,
	`user_id` text NOT NULL,
	`amount` integer NOT NULL,
	`status` text NOT NULL,
	`created_at` integer NOT NULL,
	`notified_at` integer,
	`deadline` integer,
	`paid_at` integer,
	`payment_reference` text,
	`mercado_pago_url` text,
	`link_disabled_at` integer,
	`email_sent_at` integer,
	`whatsapp_sent_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `one_offer_per_bidder` ON `offers` (`lot`,`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `one_current_offer_per_lot` ON `offers` (`lot`) WHERE "offers"."status" IN ('ready', 'pending', 'paid');--> statement-breakpoint
CREATE TABLE `participants` (
	`user_id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`whatsapp` text NOT NULL,
	`whatsapp_consent` integer DEFAULT 0 NOT NULL,
	`accepted_at` integer NOT NULL
);
