-- Module 7: Content & File Sharing
-- Create enums
CREATE TYPE "public"."file_status" AS ENUM('PENDING', 'READY', 'DELETED');
CREATE TYPE "public"."note_audience_scope" AS ENUM('ALL', 'ROLE', 'STAGE', 'GRADE_LEVEL', 'CLASS_SECTION', 'SUBJECT', 'STUDENT', 'GUARDIAN');

-- file_object table
CREATE TABLE IF NOT EXISTS "file_object" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"storage_key" text NOT NULL,
	"filename" text NOT NULL,
	"mime" text NOT NULL,
	"size_bytes" integer,
	"sha256" text,
	"uploaded_by_profile_id" uuid,
	"status" "file_status" DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ready_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"meta" jsonb,
	CONSTRAINT "file_object_storage_key_unique" UNIQUE("storage_key")
);

-- note table
CREATE TABLE IF NOT EXISTS "note" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_by_profile_id" uuid NOT NULL,
	"academic_year_id" uuid,
	"term_id" uuid,
	"is_published" boolean DEFAULT false NOT NULL,
	"published_at" timestamp with time zone,
	"pin_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone
);

-- note_translation table
CREATE TABLE IF NOT EXISTS "note_translation" (
	"note_id" uuid NOT NULL,
	"locale" varchar(8) NOT NULL,
	"title" text NOT NULL,
	"body_md" text,
	CONSTRAINT "pk_note_translation" PRIMARY KEY("note_id","locale")
);

-- note_attachment table
CREATE TABLE IF NOT EXISTS "note_attachment" (
	"note_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	CONSTRAINT "pk_note_attachment" PRIMARY KEY("note_id","file_id")
);

-- note_audience table
CREATE TABLE IF NOT EXISTS "note_audience" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"note_id" uuid NOT NULL,
	"scope" "note_audience_scope" NOT NULL,
	"role" text,
	"stage_id" uuid,
	"grade_level_id" uuid,
	"class_section_id" uuid,
	"subject_id" uuid,
	"student_profile_id" uuid,
	"guardian_profile_id" uuid
);

-- note_read table
CREATE TABLE IF NOT EXISTS "note_read" (
	"note_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"read_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pk_note_read" PRIMARY KEY("note_id","profile_id")
);

-- Add foreign key constraints
DO $$ BEGIN
 ALTER TABLE "file_object" ADD CONSTRAINT "file_object_uploaded_by_profile_id_profiles_id_fk" FOREIGN KEY ("uploaded_by_profile_id") REFERENCES "profiles"("id") ON DELETE set null;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "note" ADD CONSTRAINT "note_created_by_profile_id_profiles_id_fk" FOREIGN KEY ("created_by_profile_id") REFERENCES "profiles"("id") ON DELETE restrict;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "note" ADD CONSTRAINT "note_academic_year_id_academic_year_id_fk" FOREIGN KEY ("academic_year_id") REFERENCES "academic_year"("id") ON DELETE set null;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "note" ADD CONSTRAINT "note_term_id_term_id_fk" FOREIGN KEY ("term_id") REFERENCES "term"("id") ON DELETE set null;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "note_translation" ADD CONSTRAINT "note_translation_note_id_note_id_fk" FOREIGN KEY ("note_id") REFERENCES "note"("id") ON DELETE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "note_attachment" ADD CONSTRAINT "note_attachment_note_id_note_id_fk" FOREIGN KEY ("note_id") REFERENCES "note"("id") ON DELETE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "note_attachment" ADD CONSTRAINT "note_attachment_file_id_file_object_id_fk" FOREIGN KEY ("file_id") REFERENCES "file_object"("id") ON DELETE restrict;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "note_audience" ADD CONSTRAINT "note_audience_note_id_note_id_fk" FOREIGN KEY ("note_id") REFERENCES "note"("id") ON DELETE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "note_audience" ADD CONSTRAINT "note_audience_grade_level_id_grade_level_id_fk" FOREIGN KEY ("grade_level_id") REFERENCES "grade_level"("id") ON DELETE set null;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "note_audience" ADD CONSTRAINT "note_audience_class_section_id_class_section_id_fk" FOREIGN KEY ("class_section_id") REFERENCES "class_section"("id") ON DELETE set null;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "note_audience" ADD CONSTRAINT "note_audience_subject_id_subject_id_fk" FOREIGN KEY ("subject_id") REFERENCES "subject"("id") ON DELETE set null;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "note_audience" ADD CONSTRAINT "note_audience_student_profile_id_profiles_id_fk" FOREIGN KEY ("student_profile_id") REFERENCES "profiles"("id") ON DELETE set null;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "note_audience" ADD CONSTRAINT "note_audience_guardian_profile_id_profiles_id_fk" FOREIGN KEY ("guardian_profile_id") REFERENCES "profiles"("id") ON DELETE set null;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "note_read" ADD CONSTRAINT "note_read_note_id_note_id_fk" FOREIGN KEY ("note_id") REFERENCES "note"("id") ON DELETE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "note_read" ADD CONSTRAINT "note_read_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS "idx_file_object_created_at" ON "file_object" ("created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_file_storage_key" ON "file_object" ("storage_key");
CREATE INDEX IF NOT EXISTS "idx_note_published" ON "note" ("is_published", "published_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_note_pin" ON "note" ("pin_until" DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS "idx_note_audience_note" ON "note_audience" ("note_id");
CREATE INDEX IF NOT EXISTS "idx_note_audience_scope" ON "note_audience" ("scope");
CREATE INDEX IF NOT EXISTS "idx_note_read_profile" ON "note_read" ("profile_id");