ALTER TABLE "audit_log" ALTER COLUMN "action" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "audit_log" ALTER COLUMN "created_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "audit_log" ADD COLUMN "at" timestamp with time zone DEFAULT now();--> statement-breakpoint
ALTER TABLE "audit_log" ADD COLUMN "actor_user_id" uuid;--> statement-breakpoint
ALTER TABLE "audit_log" ADD COLUMN "actor_roles" text[];--> statement-breakpoint
ALTER TABLE "audit_log" ADD COLUMN "ip" text;--> statement-breakpoint
ALTER TABLE "audit_log" ADD COLUMN "summary" text;--> statement-breakpoint
ALTER TABLE "audit_log" ADD COLUMN "meta" jsonb;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;