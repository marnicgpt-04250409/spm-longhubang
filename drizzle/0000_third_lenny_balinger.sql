CREATE TABLE `daily_quizzes` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`local_date` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`correct_count` integer,
	`completed_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `daily_quizzes_user_date_unique` ON `daily_quizzes` (`user_id`,`local_date`);--> statement-breakpoint
CREATE INDEX `daily_quizzes_date_score_idx` ON `daily_quizzes` (`local_date`,`correct_count`,`completed_at`);--> statement-breakpoint
CREATE TABLE `questions` (
	`id` text PRIMARY KEY NOT NULL,
	`upload_id` text,
	`author_id` text NOT NULL,
	`subject` text NOT NULL,
	`prompt` text NOT NULL,
	`option_a` text NOT NULL,
	`option_b` text NOT NULL,
	`option_c` text NOT NULL,
	`option_d` text NOT NULL,
	`correct_option` text NOT NULL,
	`explanation` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` integer NOT NULL,
	`published_at` integer,
	FOREIGN KEY (`upload_id`) REFERENCES `uploads`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `questions_status_subject_idx` ON `questions` (`status`,`subject`);--> statement-breakpoint
CREATE INDEX `questions_author_status_idx` ON `questions` (`author_id`,`status`);--> statement-breakpoint
CREATE TABLE `quiz_items` (
	`id` text PRIMARY KEY NOT NULL,
	`quiz_id` text NOT NULL,
	`question_id` text NOT NULL,
	`ordinal` integer NOT NULL,
	`selected_option` text,
	FOREIGN KEY (`quiz_id`) REFERENCES `daily_quizzes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `quiz_items_quiz_order_unique` ON `quiz_items` (`quiz_id`,`ordinal`);--> statement-breakpoint
CREATE INDEX `quiz_items_question_idx` ON `quiz_items` (`question_id`);--> statement-breakpoint
CREATE TABLE `uploads` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`filename` text NOT NULL,
	`r2_key` text NOT NULL,
	`status` text DEFAULT 'processing' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `uploads_user_created_idx` ON `uploads` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`google_subject` text NOT NULL,
	`display_name` text NOT NULL,
	`email` text NOT NULL,
	`role` text DEFAULT 'student' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_google_subject_unique` ON `users` (`google_subject`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);