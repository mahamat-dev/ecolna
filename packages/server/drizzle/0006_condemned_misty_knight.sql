CREATE TYPE "public"."attempt_status" AS ENUM('CREATED', 'IN_PROGRESS', 'SUBMITTED', 'GRADED');--> statement-breakpoint
CREATE TYPE "public"."question_type" AS ENUM('MCQ_SINGLE', 'MCQ_MULTI', 'TRUE_FALSE');--> statement-breakpoint
CREATE TYPE "public"."quiz_audience_scope" AS ENUM('ALL', 'GRADE_LEVEL', 'CLASS_SECTION', 'SUBJECT');--> statement-breakpoint
CREATE TYPE "public"."quiz_status" AS ENUM('DRAFT', 'PUBLISHED', 'CLOSED');--> statement-breakpoint
CREATE TABLE "attempt_answer" (
	"attempt_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"selected_option_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_correct" boolean,
	"score" numeric(6, 2),
	"answered_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pk_attempt_answer" PRIMARY KEY("attempt_id","question_id")
);
--> statement-breakpoint
CREATE TABLE "attempt_question" (
	"attempt_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"order_index" integer NOT NULL,
	"option_order" jsonb,
	"points" numeric(6, 2) DEFAULT '1' NOT NULL,
	CONSTRAINT "pk_attempt_question" PRIMARY KEY("attempt_id","question_id")
);
--> statement-breakpoint
CREATE TABLE "question" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "question_type" NOT NULL,
	"subject_id" uuid,
	"created_by_profile_id" uuid NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "question_option" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_id" uuid NOT NULL,
	"is_correct" boolean DEFAULT false NOT NULL,
	"weight" numeric(6, 3) DEFAULT '1',
	"order_index" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "question_option_translation" (
	"option_id" uuid NOT NULL,
	"locale" varchar(8) NOT NULL,
	"text" text NOT NULL,
	CONSTRAINT "pk_question_option_translation" PRIMARY KEY("option_id","locale")
);
--> statement-breakpoint
CREATE TABLE "question_translation" (
	"question_id" uuid NOT NULL,
	"locale" varchar(8) NOT NULL,
	"stem_md" text NOT NULL,
	"explanation_md" text,
	CONSTRAINT "pk_question_translation" PRIMARY KEY("question_id","locale")
);
--> statement-breakpoint
CREATE TABLE "quiz" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_by_profile_id" uuid NOT NULL,
	"subject_id" uuid,
	"status" "quiz_status" DEFAULT 'DRAFT' NOT NULL,
	"time_limit_sec" integer,
	"max_attempts" integer DEFAULT 1 NOT NULL,
	"shuffle_questions" boolean DEFAULT true NOT NULL,
	"shuffle_options" boolean DEFAULT true NOT NULL,
	"open_at" timestamp with time zone,
	"close_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "quiz_attempt" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quiz_id" uuid NOT NULL,
	"student_profile_id" uuid NOT NULL,
	"status" "attempt_status" DEFAULT 'CREATED' NOT NULL,
	"started_at" timestamp with time zone,
	"submitted_at" timestamp with time zone,
	"score" numeric(8, 2),
	"max_score" numeric(8, 2),
	"time_limit_sec" integer,
	"seed" integer,
	"ip" varchar(64),
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quiz_audience" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quiz_id" uuid NOT NULL,
	"scope" "quiz_audience_scope" NOT NULL,
	"grade_level_id" uuid,
	"class_section_id" uuid,
	"subject_id" uuid
);
--> statement-breakpoint
CREATE TABLE "quiz_question" (
	"quiz_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"points" numeric(6, 2) DEFAULT '1' NOT NULL,
	"order_index" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "pk_quiz_question" PRIMARY KEY("quiz_id","question_id")
);
--> statement-breakpoint
CREATE TABLE "quiz_translation" (
	"quiz_id" uuid NOT NULL,
	"locale" varchar(8) NOT NULL,
	"title" text NOT NULL,
	"description_md" text,
	CONSTRAINT "pk_quiz_translation" PRIMARY KEY("quiz_id","locale")
);
--> statement-breakpoint
ALTER TABLE "attempt_answer" ADD CONSTRAINT "attempt_answer_attempt_id_quiz_attempt_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."quiz_attempt"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempt_answer" ADD CONSTRAINT "attempt_answer_question_id_question_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."question"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempt_question" ADD CONSTRAINT "attempt_question_attempt_id_quiz_attempt_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."quiz_attempt"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempt_question" ADD CONSTRAINT "attempt_question_question_id_question_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."question"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question" ADD CONSTRAINT "question_subject_id_subject_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subject"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question" ADD CONSTRAINT "question_created_by_profile_id_profiles_id_fk" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_option" ADD CONSTRAINT "question_option_question_id_question_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."question"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_option_translation" ADD CONSTRAINT "question_option_translation_option_id_question_option_id_fk" FOREIGN KEY ("option_id") REFERENCES "public"."question_option"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_translation" ADD CONSTRAINT "question_translation_question_id_question_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."question"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz" ADD CONSTRAINT "quiz_created_by_profile_id_profiles_id_fk" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz" ADD CONSTRAINT "quiz_subject_id_subject_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subject"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_attempt" ADD CONSTRAINT "quiz_attempt_quiz_id_quiz_id_fk" FOREIGN KEY ("quiz_id") REFERENCES "public"."quiz"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_attempt" ADD CONSTRAINT "quiz_attempt_student_profile_id_profiles_id_fk" FOREIGN KEY ("student_profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_audience" ADD CONSTRAINT "quiz_audience_quiz_id_quiz_id_fk" FOREIGN KEY ("quiz_id") REFERENCES "public"."quiz"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_audience" ADD CONSTRAINT "quiz_audience_grade_level_id_grade_level_id_fk" FOREIGN KEY ("grade_level_id") REFERENCES "public"."grade_level"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_audience" ADD CONSTRAINT "quiz_audience_class_section_id_class_section_id_fk" FOREIGN KEY ("class_section_id") REFERENCES "public"."class_section"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_audience" ADD CONSTRAINT "quiz_audience_subject_id_subject_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subject"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_question" ADD CONSTRAINT "quiz_question_quiz_id_quiz_id_fk" FOREIGN KEY ("quiz_id") REFERENCES "public"."quiz"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_question" ADD CONSTRAINT "quiz_question_question_id_question_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."question"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_translation" ADD CONSTRAINT "quiz_translation_quiz_id_quiz_id_fk" FOREIGN KEY ("quiz_id") REFERENCES "public"."quiz"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint