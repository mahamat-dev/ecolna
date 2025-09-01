-- Optional indices for teaching_assignment table
-- These can be added as a migration or run manually for better query performance

CREATE INDEX IF NOT EXISTS idx_ta_teacher ON teaching_assignment(teacher_profile_id);
CREATE INDEX IF NOT EXISTS idx_ta_section ON teaching_assignment(class_section_id);
CREATE INDEX IF NOT EXISTS idx_ta_year ON teaching_assignment(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_ta_term ON teaching_assignment(term_id);
CREATE INDEX IF NOT EXISTS idx_ta_subject ON teaching_assignment(subject_id);

-- Unique partial indexes for business rules enforcement
-- One lead teacher per (section, subject, term)
CREATE UNIQUE INDEX IF NOT EXISTS uq_lead_per_slot
ON teaching_assignment(class_section_id, subject_id, COALESCE(term_id, '00000000-0000-0000-0000-000000000000'::uuid))
WHERE is_lead = true;

-- One homeroom teacher per (section, academic_year)
CREATE UNIQUE INDEX IF NOT EXISTS uq_homeroom_per_section_year
ON teaching_assignment(class_section_id, academic_year_id)
WHERE is_homeroom = true;