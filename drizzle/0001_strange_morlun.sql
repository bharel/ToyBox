CREATE TABLE `integration_secrets` (
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`encrypted` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `name`)
);
--> statement-breakpoint
CREATE TABLE `oauth_states` (
	`hash` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sync_snapshots` (
	`user_id` text NOT NULL,
	`key` text NOT NULL,
	`source` text NOT NULL,
	`payload` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `key`)
);
--> statement-breakpoint
CREATE TABLE `toy_metadata` (
	`toy_id` text PRIMARY KEY NOT NULL,
	`payload` text NOT NULL,
	`updated_at` text NOT NULL
);
