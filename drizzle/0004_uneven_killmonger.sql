ALTER TABLE `plans` ADD `price_weekly` integer;--> statement-breakpoint
ALTER TABLE `services` ADD `billing_cycle` text DEFAULT 'monthly' NOT NULL;--> statement-breakpoint
UPDATE `plans` SET `price_weekly` = MAX(9000, CAST(ROUND(`price_monthly` * 0.35 / 1000.0) * 1000 AS INTEGER)) WHERE `price_weekly` IS NULL;--> statement-breakpoint
UPDATE `services` SET `billing_cycle` = COALESCE((SELECT `o`.`billing_cycle` FROM `orders` `o` WHERE `o`.`id` = `services`.`order_id`), 'monthly');--> statement-breakpoint
UPDATE `settings` SET `value` = `value` || ',weekly_expiry_reminder' WHERE `key` = 'email_templates' AND instr(`value`, 'weekly_expiry_reminder') = 0;--> statement-breakpoint
UPDATE `settings` SET `value` = json_insert(`value`, '$[#]', 'weekly_expiry_reminder') WHERE `key` = 'wa_user_events' AND json_valid(`value`) AND instr(`value`, 'weekly_expiry_reminder') = 0;
