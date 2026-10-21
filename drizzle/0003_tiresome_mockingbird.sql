CREATE TABLE `do_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`token_encrypted` text NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `do_accounts_active_idx` ON `do_accounts` (`is_active`);--> statement-breakpoint
ALTER TABLE `services` ADD `do_account_id` text;--> statement-breakpoint
CREATE INDEX `services_account_idx` ON `services` (`do_account_id`);--> statement-breakpoint
ALTER TABLE `ssh_keys` ADD `do_ssh_key_map` text;