CREATE TYPE "public"."task_log_status" AS ENUM('success', 'retrying', 'failed');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('active', 'paused', 'failed');--> statement-breakpoint
CREATE TABLE "task_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"executed_at" timestamp with time zone NOT NULL,
	"status" "task_log_status" NOT NULL,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"http_status" integer,
	"duration_ms" integer,
	"message" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "task_logs_retry_count_non_negative" CHECK ("task_logs"."retry_count" >= 0),
	CONSTRAINT "task_logs_duration_ms_non_negative" CHECK ("task_logs"."duration_ms" >= 0)
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"cron_schedule" varchar(100) NOT NULL,
	"timezone" varchar(64) DEFAULT 'UTC' NOT NULL,
	"webhook_url" text NOT NULL,
	"payload" jsonb NOT NULL,
	"max_retry" integer DEFAULT 3 NOT NULL,
	"retry_delay_ms" integer DEFAULT 5000 NOT NULL,
	"status" "task_status" DEFAULT 'active' NOT NULL,
	"last_run_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tasks_max_retry_range" CHECK ("tasks"."max_retry" BETWEEN 0 AND 10),
	CONSTRAINT "tasks_retry_delay_ms_range" CHECK ("tasks"."retry_delay_ms" BETWEEN 1000 AND 3600000)
);
--> statement-breakpoint
ALTER TABLE "task_logs" ADD CONSTRAINT "task_logs_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "task_logs_task_id_created_at_idx" ON "task_logs" USING btree ("task_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "task_logs_created_at_idx" ON "task_logs" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "task_logs_status_idx" ON "task_logs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "tasks_status_idx" ON "tasks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "tasks_created_at_idx" ON "tasks" USING btree ("created_at" DESC NULLS LAST);