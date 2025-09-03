CREATE TYPE "public"."discipline_action_type" AS ENUM('WARNING', 'DETENTION', 'SUSPENSION_IN_SCHOOL', 'SUSPENSION_OUT_OF_SCHOOL', 'PARENT_MEETING', 'COMMUNITY_SERVICE');--> statement-breakpoint
CREATE TYPE "public"."discipline_role" AS ENUM('PERPETRATOR', 'VICTIM', 'WITNESS');--> statement-breakpoint
CREATE TYPE "public"."discipline_status" AS ENUM('OPEN', 'UNDER_REVIEW', 'RESOLVED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."discipline_visibility" AS ENUM('PRIVATE', 'STUDENT', 'GUARDIAN');--> statement-breakpoint
CREATE TABLE "detention_session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(128) NOT NULL,
	"date_time" timestamp with time zone NOT NULL,
	"duration_minutes" integer DEFAULT 60 NOT NULL,
	"room" varchar(64),
	"capacity" integer DEFAULT 30 NOT NULL,
	"created_by_profile_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "detention_session_attendance" (
	"session_id" uuid NOT NULL,
	"student_profile_id" uuid NOT NULL,
	"present" boolean DEFAULT false NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pk_detention_session_attendance" PRIMARY KEY("session_id","student_profile_id")
);
--> statement-breakpoint
CREATE TABLE "detention_session_enrollment" (
	"session_id" uuid NOT NULL,
	"action_id" uuid NOT NULL,
	"student_profile_id" uuid NOT NULL,
	CONSTRAINT "pk_detention_session_enrollment" PRIMARY KEY("session_id","action_id","student_profile_id")
);
--> statement-breakpoint
CREATE TABLE "discipline_action" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"incident_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"type" "discipline_action_type" NOT NULL,
	"points" integer DEFAULT 0 NOT NULL,
	"due_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discipline_category" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(32) NOT NULL,
	"default_points" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "discipline_category_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "discipline_category_translation" (
	"category_id" uuid NOT NULL,
	"locale" varchar(8) NOT NULL,
	"name" text NOT NULL,
	"description" text,
	CONSTRAINT "pk_discipline_category_translation" PRIMARY KEY("category_id","locale")
);
--> statement-breakpoint
CREATE TABLE "discipline_incident" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" uuid,
	"status" "discipline_status" DEFAULT 'OPEN' NOT NULL,
	"visibility" "discipline_visibility" DEFAULT 'PRIVATE' NOT NULL,
	"summary" text NOT NULL,
	"details" text,
	"occurred_at" timestamp with time zone NOT NULL,
	"location" varchar(128),
	"reported_by_profile_id" uuid NOT NULL,
	"class_section_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "discipline_incident_attachment" (
	"incident_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	CONSTRAINT "pk_discipline_incident_attachment" PRIMARY KEY("incident_id","file_id")
);
--> statement-breakpoint
CREATE TABLE "discipline_incident_participant" (
	"incident_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"role" "discipline_role" NOT NULL,
	"note" text,
	CONSTRAINT "pk_discipline_incident_participant" PRIMARY KEY("incident_id","profile_id","role")
);
--> statement-breakpoint
CREATE TABLE "advance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"requester_profile_id" uuid NOT NULL,
	"amount_cents" integer DEFAULT 0 NOT NULL,
	"reason" text,
	"status" varchar(16) DEFAULT 'REQUESTED' NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"approved_by_profile_id" uuid,
	"approved_at" timestamp with time zone,
	"repaid_cents" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fee_schedule" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(64) NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"amount_cents" integer DEFAULT 0 NOT NULL,
	"currency" varchar(3) DEFAULT 'XAF' NOT NULL,
	"academic_year_id" uuid,
	"grade_level_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fee_schedule_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "invoice" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_profile_id" uuid NOT NULL,
	"total_cents" integer DEFAULT 0 NOT NULL,
	"currency" varchar(3) DEFAULT 'XAF' NOT NULL,
	"status" varchar(16) DEFAULT 'DRAFT' NOT NULL,
	"issued_at" timestamp with time zone,
	"due_date" timestamp with time zone,
	"created_by_profile_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice_line" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"description" text NOT NULL,
	"amount_cents" integer DEFAULT 0 NOT NULL,
	"schedule_id" uuid
);
--> statement-breakpoint
CREATE TABLE "payment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid,
	"student_profile_id" uuid,
	"amount_cents" integer DEFAULT 0 NOT NULL,
	"method" varchar(32) DEFAULT 'CASH' NOT NULL,
	"reference" varchar(64),
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_profile_id" uuid
);
--> statement-breakpoint
CREATE TABLE "payroll_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"period_id" uuid NOT NULL,
	"staff_profile_id" uuid NOT NULL,
	"gross_cents" integer DEFAULT 0 NOT NULL,
	"allowances_cents" integer DEFAULT 0 NOT NULL,
	"deductions_cents" integer DEFAULT 0 NOT NULL,
	"net_cents" integer DEFAULT 0 NOT NULL,
	"status" varchar(16) DEFAULT 'DRAFT' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payroll_period" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(32) NOT NULL,
	"start_date" timestamp with time zone NOT NULL,
	"end_date" timestamp with time zone NOT NULL,
	"pay_date" timestamp with time zone NOT NULL,
	"status" varchar(16) DEFAULT 'OPEN' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payroll_period_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "student_fee" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_profile_id" uuid NOT NULL,
	"schedule_id" uuid NOT NULL,
	"amount_cents" integer DEFAULT 0 NOT NULL,
	"discount_cents" integer DEFAULT 0 NOT NULL,
	"due_date" timestamp with time zone,
	"status" varchar(16) DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sender_profile_id" uuid NOT NULL,
	"subject" text,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_recipient" (
	"message_id" uuid NOT NULL,
	"recipient_profile_id" uuid NOT NULL,
	"read_at" timestamp with time zone,
	"archived" boolean DEFAULT false NOT NULL,
	"deleted" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "detention_session" ADD CONSTRAINT "detention_session_created_by_profile_id_profiles_id_fk" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "detention_session_attendance" ADD CONSTRAINT "detention_session_attendance_session_id_detention_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."detention_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "detention_session_attendance" ADD CONSTRAINT "detention_session_attendance_student_profile_id_profiles_id_fk" FOREIGN KEY ("student_profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "detention_session_enrollment" ADD CONSTRAINT "detention_session_enrollment_session_id_detention_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."detention_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "detention_session_enrollment" ADD CONSTRAINT "detention_session_enrollment_action_id_discipline_action_id_fk" FOREIGN KEY ("action_id") REFERENCES "public"."discipline_action"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "detention_session_enrollment" ADD CONSTRAINT "detention_session_enrollment_student_profile_id_profiles_id_fk" FOREIGN KEY ("student_profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discipline_action" ADD CONSTRAINT "discipline_action_incident_id_discipline_incident_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."discipline_incident"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discipline_action" ADD CONSTRAINT "discipline_action_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discipline_category_translation" ADD CONSTRAINT "discipline_category_translation_category_id_discipline_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."discipline_category"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discipline_incident" ADD CONSTRAINT "discipline_incident_category_id_discipline_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."discipline_category"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discipline_incident" ADD CONSTRAINT "discipline_incident_reported_by_profile_id_profiles_id_fk" FOREIGN KEY ("reported_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discipline_incident" ADD CONSTRAINT "discipline_incident_class_section_id_class_section_id_fk" FOREIGN KEY ("class_section_id") REFERENCES "public"."class_section"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discipline_incident_attachment" ADD CONSTRAINT "discipline_incident_attachment_incident_id_discipline_incident_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."discipline_incident"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discipline_incident_attachment" ADD CONSTRAINT "discipline_incident_attachment_file_id_file_object_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."file_object"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discipline_incident_participant" ADD CONSTRAINT "discipline_incident_participant_incident_id_discipline_incident_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."discipline_incident"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discipline_incident_participant" ADD CONSTRAINT "discipline_incident_participant_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advance" ADD CONSTRAINT "advance_requester_profile_id_profiles_id_fk" FOREIGN KEY ("requester_profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advance" ADD CONSTRAINT "advance_approved_by_profile_id_profiles_id_fk" FOREIGN KEY ("approved_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_schedule" ADD CONSTRAINT "fee_schedule_academic_year_id_academic_year_id_fk" FOREIGN KEY ("academic_year_id") REFERENCES "public"."academic_year"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_schedule" ADD CONSTRAINT "fee_schedule_grade_level_id_grade_level_id_fk" FOREIGN KEY ("grade_level_id") REFERENCES "public"."grade_level"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_student_profile_id_profiles_id_fk" FOREIGN KEY ("student_profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_created_by_profile_id_profiles_id_fk" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_line" ADD CONSTRAINT "invoice_line_invoice_id_invoice_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoice"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_line" ADD CONSTRAINT "invoice_line_schedule_id_fee_schedule_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."fee_schedule"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_invoice_id_invoice_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoice"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_student_profile_id_profiles_id_fk" FOREIGN KEY ("student_profile_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_created_by_profile_id_profiles_id_fk" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_item" ADD CONSTRAINT "payroll_item_period_id_payroll_period_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."payroll_period"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_item" ADD CONSTRAINT "payroll_item_staff_profile_id_profiles_id_fk" FOREIGN KEY ("staff_profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_fee" ADD CONSTRAINT "student_fee_student_profile_id_profiles_id_fk" FOREIGN KEY ("student_profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_fee" ADD CONSTRAINT "student_fee_schedule_id_fee_schedule_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."fee_schedule"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message" ADD CONSTRAINT "message_sender_profile_id_profiles_id_fk" FOREIGN KEY ("sender_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_recipient" ADD CONSTRAINT "message_recipient_message_id_message_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."message"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_recipient" ADD CONSTRAINT "message_recipient_recipient_profile_id_profiles_id_fk" FOREIGN KEY ("recipient_profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;