-- Optional indices for attendance tables
-- These can be added as a migration or run manually for better query performance

-- Attendance session indexes
CREATE INDEX IF NOT EXISTS idx_attendance_session_class_section ON attendance_session(class_section_id);
CREATE INDEX IF NOT EXISTS idx_attendance_session_academic_year ON attendance_session(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_attendance_session_term ON attendance_session(term_id);
CREATE INDEX IF NOT EXISTS idx_attendance_session_subject ON attendance_session(subject_id);
CREATE INDEX IF NOT EXISTS idx_attendance_session_date ON attendance_session(date);
CREATE INDEX IF NOT EXISTS idx_attendance_session_taken_by ON attendance_session(taken_by_profile_id);

-- Attendance record indexes
CREATE INDEX IF NOT EXISTS idx_attendance_record_session ON attendance_record(session_id);
CREATE INDEX IF NOT EXISTS idx_attendance_record_enrollment ON attendance_record(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_attendance_record_status ON attendance_record(status);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_attendance_session_section_date ON attendance_session(class_section_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_session_section_subject_date ON attendance_session(class_section_id, subject_id, date);

-- Unique constraint for session uniqueness (already handled by schema but adding comment)
-- UNIQUE constraint on (class_section_id, date, COALESCE(subject_id, '00000000-0000-0000-0000-000000000000'))
-- is already defined in the schema

-- Unique constraint for attendance record uniqueness (already handled by schema)
-- UNIQUE constraint on (session_id, enrollment_id) is already defined in the schema