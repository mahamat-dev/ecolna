CREATE TYPE "public"."enrollment_status" AS ENUM('ACTIVE', 'TRANSFERRED_OUT', 'WITHDRAWN', 'GRADUATED');--> statement-breakpoint
CREATE TABLE "enrollment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_profile_id" uuid NOT NULL,
	"class_section_id" uuid NOT NULL,
	"academic_year_id" uuid NOT NULL,
	"status" "enrollment_status" DEFAULT 'ACTIVE' NOT NULL,
	"joined_on" date,
	"exited_on" date,
	"exit_reason" text,
	"roll_no" integer
);
--> statement-breakpoint
CREATE TABLE "guardian_student" (
	"guardian_profile_id" uuid NOT NULL,
	"student_profile_id" uuid NOT NULL,
	"link_type" text,
	"is_primary" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "enrollment" ADD CONSTRAINT "enrollment_student_profile_id_profiles_id_fk" FOREIGN KEY ("student_profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollment" ADD CONSTRAINT "enrollment_class_section_id_class_section_id_fk" FOREIGN KEY ("class_section_id") REFERENCES "public"."class_section"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollment" ADD CONSTRAINT "enrollment_academic_year_id_academic_year_id_fk" FOREIGN KEY ("academic_year_id") REFERENCES "public"."academic_year"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guardian_student" ADD CONSTRAINT "guardian_student_guardian_profile_id_profiles_id_fk" FOREIGN KEY ("guardian_profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guardian_student" ADD CONSTRAINT "guardian_student_student_profile_id_profiles_id_fk" FOREIGN KEY ("student_profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_enrollment_student_year" ON "enrollment" USING btree ("student_profile_id","academic_year_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_enrollment_student_section" ON "enrollment" USING btree ("student_profile_id","class_section_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_roll_in_section" ON "enrollment" USING btree ("class_section_id","roll_no");