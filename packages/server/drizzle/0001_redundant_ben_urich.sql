CREATE TABLE "academic_year" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "academic_year_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "class_section" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"academic_year_id" uuid NOT NULL,
	"grade_level_id" uuid NOT NULL,
	"name" text NOT NULL,
	"capacity" integer,
	"room" text,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "class_section_subject" (
	"class_section_id" uuid NOT NULL,
	"subject_id" uuid NOT NULL,
	CONSTRAINT "pk_class_section_subject" PRIMARY KEY("class_section_id","subject_id")
);
--> statement-breakpoint
CREATE TABLE "education_stage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"order_index" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "education_stage_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "grade_level" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stage_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"order_index" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subject" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"stage_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "subject_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "term" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"academic_year_id" uuid NOT NULL,
	"name" text NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"order_index" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "class_section" ADD CONSTRAINT "class_section_academic_year_id_academic_year_id_fk" FOREIGN KEY ("academic_year_id") REFERENCES "public"."academic_year"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_section" ADD CONSTRAINT "class_section_grade_level_id_grade_level_id_fk" FOREIGN KEY ("grade_level_id") REFERENCES "public"."grade_level"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_section_subject" ADD CONSTRAINT "class_section_subject_class_section_id_class_section_id_fk" FOREIGN KEY ("class_section_id") REFERENCES "public"."class_section"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_section_subject" ADD CONSTRAINT "class_section_subject_subject_id_subject_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subject"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grade_level" ADD CONSTRAINT "grade_level_stage_id_education_stage_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."education_stage"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subject" ADD CONSTRAINT "subject_stage_id_education_stage_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."education_stage"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "term" ADD CONSTRAINT "term_academic_year_id_academic_year_id_fk" FOREIGN KEY ("academic_year_id") REFERENCES "public"."academic_year"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_class_section_triple" ON "class_section" USING btree ("academic_year_id","grade_level_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_grade_level_stage_code" ON "grade_level" USING btree ("stage_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_term_year_name" ON "term" USING btree ("academic_year_id","name");